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

// Use a fixed port.
const PORT: number = 3712;

const app = express();
app.use(express.json());
//app.use(localOnlyMiddleware);

/**
 * GET /school-district route handler.
 * Returns a lookup result for the provided latitude and longitude.
 * Follows guidelines with a single return statement.
 */
app.get('/school-district', (req: Request, res: any) => {
	let responsePayload: any = {};

	try {
		// Destructure and validate query parameters.
		const { lat, lng } = req.query;
		if (!lat || !lng) {
			responsePayload = { status: false, error: 'Missing required query parameters: lat and lng' };
		} else {
			const latNum: number = Number(lat);
			const lngNum: number = Number(lng);
			if (isNaN(latNum) || isNaN(lngNum)) {
				responsePayload = { status: false, error: 'Invalid query parameter values: lat and lng must be numbers' };
			} else {
				const lookupResult = lookupSchoolDistrict({ lat: latNum, lng: lngNum });
				if (!lookupResult.status) {
					responsePayload = { status: false, error: 'No school district found for the provided location' };
				} else {
					responsePayload = lookupResult;
				}
			}
		}
	} catch (error: any) {
		console.error('Error in /school-district route:', error);
		responsePayload = { status: false, error: error.message || 'Internal Server Error' };
	}

	return res.json(responsePayload);
});

// Load district data into memory and then start the server.
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

// Graceful shutdown handlers.
process.on('SIGINT', () => {
	console.info('\n[SHUTDOWN] Caught SIGINT. Exiting...');
	process.exit(0);
});
process.on('SIGTERM', () => {
	console.info('\n[SHUTDOWN] Caught SIGTERM. Exiting...');
	process.exit(0);
});
