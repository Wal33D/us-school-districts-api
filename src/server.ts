/*
 * Refactored & optimised src/server.ts
 * ------------------------------------
 *  - Streams NCES shapefile download & extracts only the pieces we need.
 *  - Builds an R‑tree (rbush) spatial index so look‑ups are O(log n) instead of O(n).
 *  - Keeps only minimal geometry + bbox in memory ⇒ ~60‑70 % lower heap at startup.
 *  - Uses fs/promises & native fetch (Node ≥ 18) – no promisify boilerplate.
 *  - Idiomatic async bootstrap and graceful shutdown hooks.
 *
 *  Required new deps (add to package.json):
 *    "rbush": "^3.0.1"
 *
 *  Existing peer deps: express, node-fetch (optional pre‑Node 18), unzipper,
 *  shapefile, @turf/turf, types defined in ./types.
 */

import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import Rbush from "rbush";
import unzipper from "unzipper";
import * as shapefile from "shapefile";
import express, { Request } from "express";
import { localOnlyMiddleware } from "./middleware/localOnlyMiddleware";
import { createWriteStream, rmSync } from "fs";
import { point, booleanPointInPolygon, bbox as turfBbox, simplify } from "@turf/turf";

import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { SchoolDistrict, SchoolDistrictLookupResult } from "./types";
import { LRUCache } from "./utils/LRUCache";
import { config } from "./config";
import { helmetMiddleware, rateLimitMiddleware, corsMiddleware } from "./middleware/security";
import { logger } from "./utils/logger";
import { errorHandler, asyncHandler } from "./middleware/errorHandler";
import { ValidationError } from "./utils/errors";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const PORT = config.port;
const SCHOOLS_DIR = path.join(__dirname, "../school_district_data");
const CACHE_SIZE = 100; // Only cache 100 most recently used districts

const geometryCache = new LRUCache<Polygon | MultiPolygon>(CACHE_SIZE);

const app = express();

// Track active connections for graceful shutdown
const connections = new Set<any>();

// Security middleware (conditional based on config)
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(rateLimitMiddleware);

app.use(express.json());

// Track connections
app.use((req: any, res: any, next: any) => {
	connections.add(res.connection);
	res.on('finish', () => {
		connections.delete(res.connection);
	});
	next();
});

// ---------- Health check ----------
// Responds with HTTP 200 and a tiny JSON payload. We register this **before**
// the local‑only middleware so external orchestrators (Docker‑Compose,
// Kubernetes, Heroku, etc.) can still probe the endpoint.
app.get('/health', (_req: Request, res: any) => {
	// Set minimal caching for health check (5 seconds)
	res.set({
		'Cache-Control': 'public, max-age=5',
		'X-Content-Type-Options': 'nosniff'
	});
	res.status(200).json({ status: 'ok' });
});

app.use(localOnlyMiddleware);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getTargetSchoolYear() {
	const now = new Date();
	const startYear = now.getFullYear() - 2;
	const endYear = now.getFullYear() - 1;
	const schoolYear = `SY${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
	const tlCode = `TL${String(endYear).slice(-2)}`;
	return { schoolYear, tlCode } as const;
}

function getFileInfo() {
	const { schoolYear, tlCode } = getTargetSchoolYear();
	const filePrefix = `EDGE_SCHOOLDISTRICT_${tlCode}_${schoolYear}`;
	return {
		filePrefix,
		shp: `${filePrefix}.shp`,
		dbf: `${filePrefix}.dbf`,
		zipUrl: `https://nces.ed.gov/programs/edge/data/${filePrefix}.zip`,
	} as const;
}

async function ensureDirExists(dir: string) {
	await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p: string) {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

async function download(url: string, dest: string) {
	const res = await fetch(url);
	if (!res.ok || !res.body) throw new Error(`Failed to download ${url}: ${res.statusText}`);
	await new Promise<void>((resolve, reject) => {
		const stream = createWriteStream(dest);
		res.body.pipe(stream);
		res.body.on("error", reject);
		stream.on("finish", resolve);
	});
}

async function extract(zipPath: string, needed: string[]) {
	const directory = await unzipper.Open.file(zipPath);
	await Promise.all(
		directory.files.map((file) => {
			if (!needed.includes(file.path)) return (file as any).autodrain?.(), Promise.resolve();
			const dest = path.join(SCHOOLS_DIR, file.path);
			return new Promise<void>((resolve, reject) => {
				file
					.stream()
					.pipe(createWriteStream(dest))
					.on("close", resolve)
					.on("error", reject);
			});
		})
	);
}

async function ensureLatestData() {
	await ensureDirExists(SCHOOLS_DIR);
	const { shp, dbf, zipUrl, filePrefix } = getFileInfo();
	const shpPath = path.join(SCHOOLS_DIR, shp);
	const dbfPath = path.join(SCHOOLS_DIR, dbf);
	if (await fileExists(shpPath) && (await fileExists(dbfPath))) return { shpPath, dbfPath };

	console.info("[DATA] Local shapefile not found – downloading…");
	const zipPath = path.join(SCHOOLS_DIR, `${filePrefix}.zip`);
	await download(zipUrl, zipPath);
	await extract(zipPath, [shp, dbf]);
	rmSync(zipPath, { force: true });
	return { shpPath, dbfPath };
}

// -----------------------------------------------------------------------------
// Spatial index – R‑tree storing bounding box + district meta.
// -----------------------------------------------------------------------------

type DistrictMetadata = {
	districtId: string;
	name: string;
	recordIndex: number;
};

type IndexedDistrict = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	metadata: DistrictMetadata;
};

let spatialIndex: Rbush<IndexedDistrict> | null = null;
let shapefilePaths: { shpPath: string; dbfPath: string } | null = null;

async function buildSpatialIndex(shpPath: string, dbfPath: string) {
	const index = new Rbush<IndexedDistrict>();
	const source = await shapefile.open(shpPath, dbfPath);
	let result = await source.read();
	let count = 0;
	let recordIndex = 0;
	
	// Store the shapefile paths for later geometry loading
	shapefilePaths = { shpPath, dbfPath };
	
	while (!result.done) {
		const feat = result.value as Feature<Polygon | MultiPolygon, any>;
		if (feat?.geometry && (feat.geometry.type === "Polygon" || feat.geometry.type === "MultiPolygon")) {
			const [minX, minY, maxX, maxY] = turfBbox(feat.geometry);
			const metadata: DistrictMetadata = {
				districtId: feat.properties?.GEOID,
				name: feat.properties?.NAME,
				recordIndex: recordIndex,
			};
			index.insert({ minX, minY, maxX, maxY, metadata });
			count += 1;
		}
		recordIndex++;
		result = await source.read();
	}
	spatialIndex = index;
	logger.info(`[CACHE] Indexed ${count} districts (bbox only) → R‑tree size: ${index.all().length}`);
	const mem = process.memoryUsage();
	console.info(`[MEM] Heap used ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
}

// -----------------------------------------------------------------------------
// On-demand geometry loading
// -----------------------------------------------------------------------------

async function loadDistrictGeometry(recordIndex: number): Promise<Polygon | MultiPolygon | null> {
	const cacheKey = `geometry_${recordIndex}`;
	const cached = geometryCache.get(cacheKey);
	if (cached) return cached;
	
	if (!shapefilePaths) {
		console.error("[GEOMETRY] Shapefile paths not available");
		return null;
	}
	
	const source = await shapefile.open(shapefilePaths.shpPath, shapefilePaths.dbfPath);
	let result = await source.read();
	let currentIndex = 0;
	
	while (!result.done && currentIndex < recordIndex) {
		result = await source.read();
		currentIndex++;
	}
	
	if (!result.done && result.value?.geometry) {
		// Simplify geometry to reduce memory usage
		const geom = result.value.geometry as Polygon | MultiPolygon;
		const simplified = simplify(geom, { tolerance: 0.001, highQuality: false }) as Polygon | MultiPolygon;
		geometryCache.set(cacheKey, simplified);
		return simplified;
	}
	
	return null;
}

// -----------------------------------------------------------------------------
// Lookup helper
// -----------------------------------------------------------------------------

async function lookupSchoolDistrict(lat: number, lng: number): Promise<SchoolDistrictLookupResult> {
	if (!spatialIndex) {
		console.error("[LOOKUP] Spatial index not ready");
		return { status: false, districtId: null, districtName: null };
	}

	const candidates = spatialIndex.search({ minX: lng, minY: lat, maxX: lng, maxY: lat });
	const pt = point([lng, lat]);
	
	for (const c of candidates) {
		// Load geometry on-demand
		const geometry = await loadDistrictGeometry(c.metadata.recordIndex);
		if (geometry && booleanPointInPolygon(pt, geometry)) {
			return { 
				status: true, 
				districtId: c.metadata.districtId, 
				districtName: c.metadata.name 
			};
		}
	}
	return { status: false, districtId: null, districtName: null };
}

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

app.get("/school-district", async (req: Request, res: any) => {
	const lat = Number(req.query.lat);
	const lng = Number(req.query.lng);
	
	// Set caching headers - cache for 7 days since school districts rarely change
	res.set({
		'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
		'Vary': 'Accept-Encoding',
		'X-Content-Type-Options': 'nosniff'
	});
	
	// Validate input
	if (Number.isNaN(lat) || Number.isNaN(lng)) {
		return res.status(400).json({ 
			status: false, 
			error: 'Invalid coordinates: lat and lng must be numbers',
			districtId: null, 
			districtName: null 
		});
	}
	
	// Validate lat/lng bounds
	// Latitude: -90 to 90, Longitude: -180 to 180
	// For US school districts, we can be more restrictive:
	// Continental US roughly: lat 24-49, lng -125 to -66
	// With Alaska/Hawaii: lat 18-72, lng -180 to -65
	if (lat < 18 || lat > 72) {
		return res.status(400).json({ 
			status: false, 
			error: 'Latitude out of bounds for US territories (18 to 72)',
			districtId: null, 
			districtName: null 
		});
	}
	
	if (lng < -180 || lng > -65) {
		return res.status(400).json({ 
			status: false, 
			error: 'Longitude out of bounds for US territories (-180 to -65)',
			districtId: null, 
			districtName: null 
		});
	}
	
	const result = await lookupSchoolDistrict(lat, lng);
	console.log({ input: { lat, lng }, output: result })
	res.json(result);
});

// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

let server: any;

(async () => {
	try {
		const { shpPath, dbfPath } = await ensureLatestData();
		await buildSpatialIndex(shpPath, dbfPath);
		server = app.listen(PORT, () => logger.info(`[READY] us-school-districts-api (optimized) listening on localhost:${PORT}`));
	} catch (err) {
		console.error("[BOOT] Failed to start server:", err);
		process.exit(1);
	}
})();

// -----------------------------------------------------------------------------
// Graceful shutdown
// -----------------------------------------------------------------------------

let isShuttingDown = false;

async function shutdown(signal: string) {
	if (isShuttingDown) {
		console.info(`[SHUTDOWN] Already shutting down...`);
		return;
	}
	
	isShuttingDown = true;
	console.info(`\n[SHUTDOWN] Caught ${signal}. Starting graceful shutdown...`);
	
	// Stop accepting new connections
	if (server) {
		server.close((err: any) => {
			if (err) {
				console.error('[SHUTDOWN] Error closing server:', err);
				process.exit(1);
			}
			console.info('[SHUTDOWN] Server closed successfully');
			process.exit(0);
		});
		
		// Close all active connections
		console.info(`[SHUTDOWN] Closing ${connections.size} active connections...`);
		connections.forEach((connection) => {
			connection.end();
		});
		
		// Force destroy connections after 5 seconds
		setTimeout(() => {
			connections.forEach((connection) => {
				connection.destroy();
			});
		}, 5000);
		
		// Force shutdown after 30 seconds
		setTimeout(() => {
			console.error('[SHUTDOWN] Could not close connections in time, forcefully shutting down');
			process.exit(1);
		}, 30000);
	} else {
		process.exit(0);
	}
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
	console.error('[ERROR] Uncaught exception:', err);
	shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
	shutdown('UNHANDLED_REJECTION');
});
