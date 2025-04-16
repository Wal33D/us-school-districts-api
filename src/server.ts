/**
 * src/server.ts
 *
 * This module creates an Express server that provides a school district lookup
 * endpoint. It loads district data into memory at startup, applies middleware to
 * allow only local requests, and listens on a fixed port (3712).
 */

import express, { Request } from 'express';
import { localOnlyMiddleware } from './middleware/localOnlyMiddleware';
import { lookupSchoolDistrict } from './functions/lookupSchoolDistrict';
import { loadDistrictsIntoCache } from './lib/school-district-cache';
import type { SchoolDistrictLookupResult } from './types';

const PORT: number = 3712;
const app = express();

app.use(express.json());
app.use(localOnlyMiddleware);

/**
 * GET /school-district route handler.
 * Returns a lookup result for the provided latitude and longitude.
 * Always returns {status, districtId, districtName}.
 */
app.get('/school-district', (req: Request, res: any) => {
	// Default the response to { status: false, districtId: null, districtName: null }
	let responsePayload: SchoolDistrictLookupResult = {
		status: false,
		districtId: null,
		districtName: null
	};

	try {
		// Validate that lat and lng are provided
		const { lat, lng } = req.query;
		if (!lat || !lng) {
			// We do not populate an "error" field; we keep the shape minimal
			// e.g., { status: false, districtId: null, districtName: null }
		} else {
			const latNum = Number(lat);
			const lngNum = Number(lng);

			if (!isNaN(latNum) && !isNaN(lngNum)) {
				// Use lookup function
				const lookupResult = lookupSchoolDistrict({ lat: latNum, lng: lngNum });
				// Overwrite responsePayload with the shape from lookupResult
				responsePayload = lookupResult;
			}
		}
	} catch (error) {
		console.error('Error in /school-district route:', error);
		// Any error still yields the same shape with status=false
	}

	// Log the lookup result to the console before responding
	console.info('School District Lookup Result:', responsePayload);

	return res.json(responsePayload);
});

// Load district data into memory and then start the server
loadDistrictsIntoCache()
	.then(() => {
		app.listen(PORT, () => {
			console.info(`Server running on port ${PORT}`);
		});
	})
	.catch((error) => {
		console.error('[ERROR] Failed to load districts into cache:', error);
		process.exit(1);
	});

// Graceful shutdown
process.on('SIGINT', () => {
	console.info('\n[SHUTDOWN] Caught SIGINT. Exiting...');
	process.exit(0);
});
process.on('SIGTERM', () => {
	console.info('\n[SHUTDOWN] Caught SIGTERM. Exiting...');
	process.exit(0);
});
