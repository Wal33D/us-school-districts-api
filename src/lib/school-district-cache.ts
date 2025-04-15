/**
 * src/lib/school-district-cache.ts
 *
 * This module loads school district shapefile data into memory and provides
 * geospatial lookups using Turf. It downloads and extracts the shapefile data
 * (via utilities in the utils directory) if necessary and caches each district record.
 *
 * We assume the government-provided data is verified and clean, so no additional
 * sanitization is performed, xD lol.
 */

import path from 'path';
import * as shapefile from 'shapefile';
import { SchoolDistrict } from '../types';
import { ensureLatestData, getFileInfo, SCHOOLS_DIR } from '../utils/shapefileHelpers';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

// -------------------------
// In-Memory District Cache
// -------------------------
// Exporting the cache so that the lookup function can access it.
export let districtsCache: SchoolDistrict[] | null = null;

/**
 * Transforms a shapefile feature into a SchoolDistrict record.
 * Assumes that the data has been verified (i.e., GEOID and NAME exist).
 * @param feature - The shapefile feature.
 * @returns A SchoolDistrict record or null if required properties are missing.
 */
function transformDistrict(feature: Feature<Polygon | MultiPolygon, any>): SchoolDistrict | null {
    if (!feature.properties || !feature.properties.GEOID || !feature.properties.NAME) {
        return null;
    }
    return {
        districtId: feature.properties.GEOID,
        name: feature.properties.NAME,
        geometry: feature.geometry
    };
}

/**
 * Loads all school district data into memory by reading the shapefile.
 * Logs the number of records loaded and the current memory usage.
 */
export async function loadDistrictsIntoCache(): Promise<void> {
    try {
        await ensureLatestData();
        const { filePrefix } = getFileInfo();
        const shpPath = path.join(SCHOOLS_DIR, `${filePrefix}.shp`);
        const dbfPath = path.join(SCHOOLS_DIR, `${filePrefix}.dbf`);
        const source = await shapefile.open(shpPath, dbfPath);
        const districts: SchoolDistrict[] = [];
        let result = await source.read();
        while (!result.done) {
            const feature = result.value as Feature<Polygon | MultiPolygon, any>;
            if (feature.geometry && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
                const district = transformDistrict(feature);
                if (district) {
                    districts.push(district);
                }
            }
            result = await source.read();
        }
        districtsCache = districts;
        console.info(`[CACHE] Loaded ${districts.length} school district records into memory.`);

        // Log memory usage after loading.
        const memoryUsage = process.memoryUsage();
        console.info(
            `Memory Usage: Heap Used ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB, Heap Total ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
        );
    } catch (err) {
        console.error("[CACHE] Error loading districts into cache:", err);
        throw err;
    }
}