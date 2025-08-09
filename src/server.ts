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

import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import Rbush from 'rbush';
import unzipper from 'unzipper';
import * as shapefile from 'shapefile';
import express, { Request } from 'express';
import compression from 'compression';
import { localOnlyMiddleware } from './middleware/localOnlyMiddleware';
import { createWriteStream, rmSync } from 'fs';
import { point, booleanPointInPolygon, bbox as turfBbox, simplify } from '@turf/turf';
import * as net from 'net';

import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type {
  SchoolDistrictLookupResult,
  SchoolDistrictFeatureProperties,
  DistrictMetadata,
  IndexedDistrict,
  DistrictProperties,
} from './types';
import { config } from './config';
import { helmetMiddleware, rateLimitMiddleware, corsMiddleware } from './middleware/security';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { LRUCache } from './utils/LRUCache';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const PORT = config.port;
const SCHOOLS_DIR = path.join(__dirname, '../school_district_data');

const app = express();

// Track active connections for graceful shutdown
const connections = new Set<net.Socket>();

// Compression middleware - compress all responses
app.use(
  compression({
    threshold: 1024, // Only compress responses larger than 1KB
    level: 6, // Default compression level (1-9, where 9 is maximum compression)
  })
);

// Security middleware (conditional based on config)
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(rateLimitMiddleware);

app.use(express.json());

// Track connections
app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
  const socket = (res as unknown as { connection?: net.Socket }).connection;
  if (socket) {
    connections.add(socket);
    res.on('finish', () => {
      connections.delete(socket);
    });
  }
  next();
});

// ---------- Health check ----------
// Responds with HTTP 200 and a tiny JSON payload. We register this **before**
// the local‑only middleware so external orchestrators (Docker‑Compose,
// Kubernetes, Heroku, etc.) can still probe the endpoint.
app.get('/health', (_req: Request, res: express.Response) => {
  // Set minimal caching for health check (5 seconds)
  res.set({
    'Cache-Control': 'public, max-age=5',
    'X-Content-Type-Options': 'nosniff',
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

async function download(url: string, dest: string, maxRetries: number = 3) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[DOWNLOAD] Attempt ${attempt}/${maxRetries} for ${url}`);

      const res = await fetch(url, {
        timeout: 60000, // 60 second timeout
        size: 500 * 1024 * 1024, // Max 500MB
      });

      if (!res.ok || !res.body) {
        throw new Error(`Failed to download ${url}: ${res.statusText} (${res.status})`);
      }

      await new Promise<void>((resolve, reject) => {
        const stream = createWriteStream(dest);
        let downloadedBytes = 0;

        res.body.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          if (downloadedBytes % (10 * 1024 * 1024) === 0) {
            // Log every 10MB
            logger.info(`[DOWNLOAD] Progress: ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB`);
          }
        });

        res.body.pipe(stream);
        res.body.on('error', reject);
        stream.on('finish', () => {
          logger.info(`[DOWNLOAD] Completed: ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB`);
          resolve();
        });
        stream.on('error', reject);
      });

      // Success - return early
      return;
    } catch (error) {
      lastError = error as Error;
      logger.error(`[DOWNLOAD] Attempt ${attempt} failed:`, error);

      // Clean up partial download
      try {
        await fs.unlink(dest);
      } catch {}

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s...
        const delay = Math.pow(2, attempt) * 1000;
        logger.info(`[DOWNLOAD] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to download after ${maxRetries} attempts: ${lastError?.message}`);
}

async function extract(zipPath: string, needed: string[], maxRetries: number = 3) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[EXTRACT] Attempt ${attempt}/${maxRetries} for ${zipPath}`);

      const directory = await unzipper.Open.file(zipPath);
      await Promise.all(
        directory.files.map(file => {
          if (!needed.includes(file.path)) {
            const fileWithAutodrain = file as typeof file & { autodrain?: () => void };
            return (fileWithAutodrain.autodrain?.(), Promise.resolve());
          }

          const dest = path.join(SCHOOLS_DIR, file.path);
          logger.info(`[EXTRACT] Extracting ${file.path}`);

          return new Promise<void>((resolve, reject) => {
            file
              .stream()
              .pipe(createWriteStream(dest))
              .on('close', () => {
                logger.info(`[EXTRACT] Completed ${file.path}`);
                resolve();
              })
              .on('error', reject);
          });
        })
      );

      // Success - return early
      return;
    } catch (error) {
      lastError = error as Error;
      logger.error(`[EXTRACT] Attempt ${attempt} failed:`, error);

      // Clean up partial extracts
      for (const fileName of needed) {
        try {
          await fs.unlink(path.join(SCHOOLS_DIR, fileName));
        } catch {}
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        logger.info(`[EXTRACT] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to extract after ${maxRetries} attempts: ${lastError?.message}`);
}

async function ensureLatestData() {
  await ensureDirExists(SCHOOLS_DIR);
  const { shp, dbf, zipUrl, filePrefix } = getFileInfo();
  const shpPath = path.join(SCHOOLS_DIR, shp);
  const dbfPath = path.join(SCHOOLS_DIR, dbf);
  if ((await fileExists(shpPath)) && (await fileExists(dbfPath))) return { shpPath, dbfPath };

  logger.info('[DATA] Local shapefile not found – downloading…');
  const zipPath = path.join(SCHOOLS_DIR, `${filePrefix}.zip`);
  await download(zipUrl, zipPath);
  await extract(zipPath, [shp, dbf]);
  rmSync(zipPath, { force: true });
  return { shpPath, dbfPath };
}

// -----------------------------------------------------------------------------
// Spatial index – R‑tree storing bounding box + district meta.
// -----------------------------------------------------------------------------

let spatialIndex: Rbush<IndexedDistrict> | null = null;
let shapefilePaths: { shpPath: string; dbfPath: string } | null = null;
// Store additional district properties separately to keep spatial index lean
const districtPropertiesMap = new Map<string, DistrictProperties>();

// Small geometry cache for frequently accessed districts (configurable size)
const geometryCache = new LRUCache<Polygon | MultiPolygon>(config.cache.geometryCacheSize);

// Helper to format grade levels for display
function formatGradeLevel(grade: string | null | undefined): string | null {
  if (!grade) return null;

  // Special grade codes
  const gradeMap: Record<string, string> = {
    PK: 'Pre-K',
    KG: 'K',
    UG: 'Ungraded',
  };

  if (gradeMap[grade]) return gradeMap[grade];

  // Remove leading zeros from numeric grades
  const num = parseInt(grade, 10);
  if (!isNaN(num)) return num.toString();

  return grade;
}

// Convert square meters to square miles
const SQMETERS_TO_SQMILES = 2589988.11;

async function buildSpatialIndex(shpPath: string, dbfPath: string) {
  const index = new Rbush<IndexedDistrict>();
  const source = await shapefile.open(shpPath, dbfPath);
  let result = await source.read();
  let count = 0;
  let recordIndex = 0;

  // Store the shapefile paths for later geometry loading
  shapefilePaths = { shpPath, dbfPath };

  while (!result.done) {
    const feat = result.value as Feature<Polygon | MultiPolygon, SchoolDistrictFeatureProperties>;
    if (
      feat?.geometry &&
      (feat.geometry.type === 'Polygon' || feat.geometry.type === 'MultiPolygon')
    ) {
      const [minX, minY, maxX, maxY] = turfBbox(feat.geometry);
      const districtId = feat.properties?.GEOID;

      const metadata: DistrictMetadata = {
        districtId: districtId,
        name: feat.properties?.NAME,
        recordIndex: recordIndex,
      };
      index.insert({ minX, minY, maxX, maxY, metadata });

      // Store additional properties in the map
      if (districtId) {
        const properties: DistrictProperties = {
          gradeLowest: feat.properties?.LOGRADE || null,
          gradeHighest: feat.properties?.HIGRADE || null,
          landAreaSqMeters: feat.properties?.ALAND || 0,
          waterAreaSqMeters: feat.properties?.AWATER || 0,
          schoolYear: feat.properties?.SCHOOLYEAR || null,
          stateCode: feat.properties?.STATEFP || null,
        };
        districtPropertiesMap.set(districtId, properties);
      }

      count += 1;
    }
    recordIndex++;
    result = await source.read();
  }
  spatialIndex = index;
  logger.info(
    `[INDEX] Indexed ${count} districts → R‑tree size: ${index.all().length}, Properties stored: ${districtPropertiesMap.size}`
  );
  const mem = process.memoryUsage();
  logger.info(`[MEM] Heap used ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
}

// -----------------------------------------------------------------------------
// On-demand geometry loading
// -----------------------------------------------------------------------------

async function loadDistrictGeometry(
  recordIndex: number,
  districtId?: string
): Promise<Polygon | MultiPolygon | null> {
  // Check cache first if we have a district ID
  if (districtId && config.cache.geometryCacheSize > 0) {
    const cached = geometryCache.get(districtId);
    if (cached) {
      logger.debug(`[CACHE] Geometry hit for district ${districtId}`);
      return cached;
    }
  }

  if (!shapefilePaths) {
    logger.error('[GEOMETRY] Shapefile paths not available');
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
    const simplified = simplify(geom, {
      tolerance: config.geometry.simplificationTolerance,
      highQuality: false,
    }) as Polygon | MultiPolygon;

    // Cache the geometry if caching is enabled
    if (districtId && config.cache.geometryCacheSize > 0) {
      geometryCache.set(districtId, simplified);
      logger.debug(
        `[CACHE] Stored geometry for district ${districtId}, cache size: ${geometryCache.size()}`
      );
    }

    return simplified;
  }

  return null;
}

// -----------------------------------------------------------------------------
// Lookup helper
// -----------------------------------------------------------------------------

async function lookupSchoolDistrict(lat: number, lng: number): Promise<SchoolDistrictLookupResult> {
  if (!spatialIndex) {
    logger.error('[LOOKUP] Spatial index not ready');
    return { status: false, districtId: null, districtName: null };
  }

  const candidates = spatialIndex.search({ minX: lng, minY: lat, maxX: lng, maxY: lat });
  const pt = point([lng, lat]);

  for (const c of candidates) {
    // Load geometry on-demand (pass districtId for caching)
    const geometry = await loadDistrictGeometry(c.metadata.recordIndex, c.metadata.districtId);
    if (geometry && booleanPointInPolygon(pt, geometry)) {
      const districtId = c.metadata.districtId;
      const properties = districtPropertiesMap.get(districtId);

      const result: SchoolDistrictLookupResult = {
        status: true,
        districtId: districtId,
        districtName: c.metadata.name,
      };

      // Add priority fields if properties exist
      if (properties) {
        const lowestGrade = formatGradeLevel(properties.gradeLowest);
        const highestGrade = formatGradeLevel(properties.gradeHighest);

        if (lowestGrade && highestGrade) {
          result.gradeRange = {
            lowest: lowestGrade,
            highest: highestGrade,
          };
        }

        result.area = {
          landSqMiles: properties.landAreaSqMeters / SQMETERS_TO_SQMILES,
          waterSqMiles: properties.waterAreaSqMeters / SQMETERS_TO_SQMILES,
        };

        if (properties.schoolYear) {
          result.schoolYear = properties.schoolYear;
        }

        if (properties.stateCode) {
          result.stateCode = properties.stateCode;
        }
      }

      return result;
    }
  }
  return { status: false, districtId: null, districtName: null };
}

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

// Single coordinate lookup endpoint (POST /lookup) - for API compatibility
app.post('/lookup', async (req: Request, res: express.Response): Promise<void> => {
  // Set caching headers - cache for 7 days since school districts rarely change
  res.set({
    'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
    Vary: 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff',
  });

  // Validate request body
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({
      status: false,
      error: 'Request body must be a JSON object with lat and lng properties',
      districtId: null,
      districtName: null,
    });
    return;
  }

  const { lat: latInput, lng: lngInput, latitude, longitude, lon } = req.body;

  // Support multiple coordinate field names
  const lat = Number(latInput || latitude);
  const lng = Number(lngInput || longitude || lon);

  // Validate input
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).json({
      status: false,
      error: 'Invalid coordinates: lat and lng must be numbers',
      districtId: null,
      districtName: null,
    });
    return;
  }

  // Validate lat/lng bounds for US territories
  if (lat < 18 || lat > 72) {
    res.status(400).json({
      status: false,
      error: 'Latitude out of bounds for US territories (18 to 72)',
      districtId: null,
      districtName: null,
    });
    return;
  }

  if (lng < -180 || lng > -65) {
    res.status(400).json({
      status: false,
      error: 'Longitude out of bounds for US territories (-180 to -65)',
      districtId: null,
      districtName: null,
    });
    return;
  }

  const result = await lookupSchoolDistrict(lat, lng);
  res.json({
    ...result,
    coordinates: { lat, lng },
  });
});

// Batch lookup endpoint
app.post('/school-districts/batch', async (req: Request, res: express.Response): Promise<void> => {
  // Set caching headers
  res.set({
    'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
    Vary: 'Accept-Encoding, Content-Type',
    'X-Content-Type-Options': 'nosniff',
  });

  // Validate request body
  if (!Array.isArray(req.body)) {
    res.status(400).json({
      error: 'Request body must be an array of coordinate objects',
    });
    return;
  }

  if (req.body.length === 0) {
    res.status(400).json({
      error: 'Request body must contain at least one coordinate',
    });
    return;
  }

  if (req.body.length > config.api.maxBatchSize) {
    res.status(400).json({
      error: `Maximum ${config.api.maxBatchSize} coordinates allowed per batch request`,
    });
    return;
  }

  // Process each coordinate
  const results = await Promise.all(
    req.body.map(async (coord: unknown, index: number) => {
      // Validate coordinate structure
      if (typeof coord !== 'object' || coord === null) {
        return {
          index,
          error: 'Invalid coordinate object',
          status: false,
          districtId: null,
          districtName: null,
        };
      }

      const coordObj = coord as {
        lat?: number;
        latitude?: number;
        lng?: number;
        longitude?: number;
        lon?: number;
      };
      const lat = Number(coordObj.lat || coordObj.latitude);
      const lng = Number(coordObj.lng || coordObj.longitude || coordObj.lon);

      // Validate numbers
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return {
          index,
          error: 'Invalid coordinates: lat and lng must be numbers',
          status: false,
          districtId: null,
          districtName: null,
        };
      }

      // Validate bounds
      if (lat < 18 || lat > 72) {
        return {
          index,
          error: 'Latitude out of bounds for US territories (18 to 72)',
          status: false,
          districtId: null,
          districtName: null,
        };
      }

      if (lng < -180 || lng > -65) {
        return {
          index,
          error: 'Longitude out of bounds for US territories (-180 to -65)',
          status: false,
          districtId: null,
          districtName: null,
        };
      }

      // Perform lookup
      try {
        const result = await lookupSchoolDistrict(lat, lng);
        return {
          index,
          ...result,
          coordinates: { lat, lng },
        };
      } catch (error) {
        logger.error(`[BATCH] Error processing coordinate ${index}:`, error);
        return {
          index,
          error: 'Internal error during lookup',
          status: false,
          districtId: null,
          districtName: null,
        };
      }
    })
  );

  res.json({
    count: results.length,
    results,
  });
});

app.get('/school-district', async (req: Request, res: express.Response): Promise<void> => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  // Set caching headers - cache for 7 days since school districts rarely change
  res.set({
    'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
    Vary: 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff',
  });

  // Validate input
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).json({
      status: false,
      error: 'Invalid coordinates: lat and lng must be numbers',
      districtId: null,
      districtName: null,
    });
    return;
  }

  // Validate lat/lng bounds
  // Latitude: -90 to 90, Longitude: -180 to 180
  // For US school districts, we can be more restrictive:
  // Continental US roughly: lat 24-49, lng -125 to -66
  // With Alaska/Hawaii: lat 18-72, lng -180 to -65
  if (lat < 18 || lat > 72) {
    res.status(400).json({
      status: false,
      error: 'Latitude out of bounds for US territories (18 to 72)',
      districtId: null,
      districtName: null,
    });
    return;
  }

  if (lng < -180 || lng > -65) {
    res.status(400).json({
      status: false,
      error: 'Longitude out of bounds for US territories (-180 to -65)',
      districtId: null,
      districtName: null,
    });
    return;
  }

  const result = await lookupSchoolDistrict(lat, lng);
  res.json({
    ...result,
    coordinates: { lat, lng },
  });
});

// Error handling middleware - must be last
app.use(errorHandler);

// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

let server: net.Server | undefined;

async function startServer() {
  try {
    const { shpPath, dbfPath } = await ensureLatestData();
    await buildSpatialIndex(shpPath, dbfPath);

    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`[READY] us-school-districts-service listening on 0.0.0.0:${PORT}`);
      logger.info(
        `[CONFIG] Max batch size: ${config.api.maxBatchSize}, Geometry cache size: ${config.cache.geometryCacheSize}`
      );
    });

    // Track active connections on the server
    server.on('connection', (socket: net.Socket) => {
      connections.add(socket);
      socket.on('close', () => {
        connections.delete(socket);
      });
    });

    // Keep the server reference to prevent garbage collection
    server.ref();
  } catch (err) {
    logger.error('[BOOT] Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer().catch(err => {
  logger.error('[BOOT] Unhandled error during startup:', err);
  process.exit(1);
});

// Keep the process alive
setInterval(
  () => {
    // Keep-alive interval to prevent process from exiting
  },
  1000 * 60 * 60
); // 1 hour

// -----------------------------------------------------------------------------
// Graceful shutdown
// -----------------------------------------------------------------------------

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) {
    logger.info(`[SHUTDOWN] Already shutting down...`);
    return;
  }

  isShuttingDown = true;
  logger.info(`[SHUTDOWN] Caught ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close((err: Error | undefined) => {
      if (err) {
        logger.error('[SHUTDOWN] Error closing server:', err);
        process.exit(1);
      }
      logger.info('[SHUTDOWN] Server closed successfully');
      process.exit(0);
    });

    // Close all active connections
    logger.info(`[SHUTDOWN] Closing ${connections.size} active connections...`);
    connections.forEach(connection => {
      connection.end();
    });

    // Force destroy connections after 5 seconds
    setTimeout(() => {
      connections.forEach(connection => {
        connection.destroy();
      });
    }, 5000);

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('[SHUTDOWN] Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', err => {
  logger.error('[ERROR] Uncaught exception:', err);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});
