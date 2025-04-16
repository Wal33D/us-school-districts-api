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
 *
 * @param feature - The shapefile feature destructured into properties and geometry.
 * @returns An object with a status property and, on success, the district record.
 */
const transformDistrict = (
    { properties, geometry }: Feature<Polygon | MultiPolygon, any>
): { status: string; district?: SchoolDistrict; error?: string } => {
    // Return object variables are implicit here since this function is small.
    if (!properties || !properties.GEOID || !properties.NAME) {
        return { status: "failure", error: "Missing required properties" };
    }
    const district: SchoolDistrict = {
        districtId: properties.GEOID,
        name: properties.NAME,
        geometry: geometry
    };
    return { status: "success", district };
};

/**
 * Loads all school district data into memory by reading the shapefile.
 * Logs the number of records loaded and the current memory usage.
 *
 * @returns An object with a status property, and on success, a message detailing the outcome.
 */
export const loadDistrictsIntoCache = async (): Promise<{ status: string; message?: string; error?: any }> => {
    // Declare the return object at the very start.
    let returnObj: { status: string; message?: string; error?: any } = { status: "failure" };
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
            if (
                feature.geometry &&
                (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")
            ) {
                const transformation = transformDistrict(feature);
                if (transformation.status === "success" && transformation.district) {
                    districts.push(transformation.district);
                }
            }
            result = await source.read();
        }
        districtsCache = districts;
        console.info(`[CACHE] Loaded ${districts.length} school district records into memory.`);
        const memoryUsage = process.memoryUsage();
        console.info(
            `Memory Usage: Heap Used ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB, Heap Total ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
        );
        returnObj = { status: "success", message: `Loaded ${districts.length} records into cache` };
    } catch (err) {
        console.error("[CACHE] Error loading districts into cache:", err);
        // A sprinkle of humor for those tough cache days.
        returnObj = { status: "error", error: "Don't panic, it's just caching! " + err };
    }
    return returnObj;
};
