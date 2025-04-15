/**
 * src/utils/shapefileHelpers.ts
 *
 * Utility functions for handling file directories, downloads,
 * and extraction of shapefile data.
 *
 * These helpers are used by the school-district-cache module.
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import unzipper from 'unzipper';
import { promisify } from 'util';

const accessAsync = promisify(fs.access);
const readdirAsync = promisify(fs.readdir);
const unlinkAsync = promisify(fs.unlink);

// Define the directory where shapefile data will be stored.
export const SCHOOLS_DIR = path.join(__dirname, "../../school_district_data");

/**
 * Ensures that the specified directory exists.
 * If the directory does not exist, it is created recursively.
 * @param directory - The directory path to ensure
 */
export async function ensureDirectoryExists(directory: string): Promise<void> {
    try {
        await fs.promises.mkdir(directory, { recursive: true });
    } catch (err) {
        console.error(`Error creating directory ${directory}:`, err);
        throw err;
    }
}

/**
 * Computes and returns the target school year based on the current date.
 * For example, if the current year is 2025, returns { schoolYear: "SY2324", tlCode: "TL24" }.
 */
export function getTargetSchoolYear(): { schoolYear: string; tlCode: string } {
    const now = new Date();
    const startYear = now.getFullYear() - 2;
    const endYear = now.getFullYear() - 1;
    const schoolYear = `SY${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
    const tlCode = `TL${String(endYear).slice(-2)}`;
    return { schoolYear, tlCode };
}

/**
 * Returns file information for the shapefile based on the target school year.
 */
export function getFileInfo(): { filePrefix: string; expectedFiles: string[]; zipUrl: string } {
    const { schoolYear, tlCode } = getTargetSchoolYear();
    const filePrefix = `EDGE_SCHOOLDISTRICT_${tlCode}_${schoolYear}`;
    const expectedFiles = [`${filePrefix}.shp`, `${filePrefix}.dbf`];
    const zipUrl = `https://nces.ed.gov/programs/edge/data/${filePrefix}.zip`;
    return { filePrefix, expectedFiles, zipUrl };
}

/**
 * Checks if all expected files exist in SCHOOLS_DIR.
 * @param expectedFiles - An array of expected file names.
 */
export async function filesExist(expectedFiles: string[]): Promise<boolean> {
    try {
        for (const file of expectedFiles) {
            const filePath = path.join(SCHOOLS_DIR, file);
            await accessAsync(filePath, fs.constants.F_OK);
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Clears all files in the SCHOOLS_DIR.
 */
export async function clearSchoolsDirectory(): Promise<void> {
    try {
        const files = await readdirAsync(SCHOOLS_DIR);
        await Promise.all(files.map((f) => unlinkAsync(path.join(SCHOOLS_DIR, f))));
        console.info("[CLEANUP] Cleared old files in school_district_data.");
    } catch (err) {
        console.error("Error clearing schools directory:", err);
        throw err;
    }
}

/**
 * Downloads a zip file from the provided URL to the destination path.
 * @param url - The URL to download from.
 * @param destination - The path where the downloaded zip will be saved.
 */
export async function downloadZip(url: string, destination: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to download file from ${url}: ${res.statusText}`);
    }
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(destination);
        res.body?.pipe(fileStream);
        res.body?.on("error", reject);
        fileStream.on("finish", resolve);
    });
}

/**
 * Checks if a remote file is accessible via an HTTP HEAD request.
 * @param url - The URL to check.
 */
export async function remoteFileExists(url: string): Promise<boolean> {
    try {
        const res = await fetch(url, { method: "HEAD" });
        return res.ok;
    } catch (err) {
        console.error("Error checking remote file:", err);
        return false;
    }
}

/**
 * Ensures that the latest shapefile data is available locally.
 * If the expected files are not present, downloads and extracts them.
 */
export async function ensureLatestData(): Promise<void> {
    await ensureDirectoryExists(SCHOOLS_DIR);
    const { filePrefix, expectedFiles, zipUrl } = getFileInfo();
    if (await filesExist(expectedFiles)) {
        console.info("[DATA] Latest shapefile files exist locally.");
        return;
    }
    console.info("[DATA] Shapefiles not found locally. Checking remote...");
    if (!(await remoteFileExists(zipUrl))) {
        throw new Error(`Remote zip file not available: ${zipUrl}`);
    }
    console.info("[DATA] Remote file found. Downloading...");
    await clearSchoolsDirectory();
    const zipPath = path.join(SCHOOLS_DIR, `${filePrefix}.zip`);
    try {
        await downloadZip(zipUrl, zipPath);
        console.info(`[DATA] Downloaded zip to ${zipPath}`);
        await extractNeededFiles(zipPath, expectedFiles);
        console.info("[DATA] Extracted expected shapefile files.");
    } catch (err) {
        console.error("[DATA] Error during download or extraction:", err);
        throw err;
    } finally {
        fs.unlink(zipPath, (err) => {
            if (err) console.error("[DATA] Error removing zip file:", err);
        });
    }
}

/**
 * Extracts only the expected files (.shp and .dbf) from the zip archive.
 * @param zipPath - The path to the zip file.
 * @param expectedFiles - An array of expected file names.
 */
export async function extractNeededFiles(zipPath: string, expectedFiles: string[]): Promise<void> {
    const directory = await unzipper.Open.file(zipPath);
    await Promise.all(
        directory.files.map((file) => {
            if (expectedFiles.includes(file.path)) {
                const destPath = path.join(SCHOOLS_DIR, file.path);
                return new Promise<void>((resolve, reject) => {
                    file
                        .stream()
                        .pipe(fs.createWriteStream(destPath))
                        .on("close", resolve)
                        .on("error", reject);
                });
            }
            if (typeof (file as any).autodrain === "function") {
                (file as any).autodrain();
            }
            return Promise.resolve();
        })
    );
}
