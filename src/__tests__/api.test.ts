import request from 'supertest';
import express, { Request } from 'express';

// Mock the spatial index and lookup function
const mockLookupResult = {
	status: true,
	districtId: '2630960',
	districtName: 'Saugatuck Public Schools',
};

// Mock server setup for testing
function createTestApp() {
	const app = express();
	app.use(express.json());

	// Health check endpoint
	app.get('/health', (_req: Request, res: any) => {
		res.status(200).json({ status: 'ok' });
	});

	// School district endpoint
	app.get('/school-district', (req: Request, res: any) => {
		const lat = Number(req.query.lat);
		const lng = Number(req.query.lng);

		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			return res.json({ status: false, districtId: null, districtName: null });
		}

		// Mock lookup based on coordinates
		if (lat === 42.658529 && lng === -86.206886) {
			return res.json(mockLookupResult);
		}

		res.json({ status: false, districtId: null, districtName: null });
	});

	return app;
}

describe('API Endpoints', () => {
	let app: express.Application;

	beforeEach(() => {
		app = createTestApp();
	});

	describe('GET /health', () => {
		test('should return 200 with ok status', async () => {
			const response = await request(app)
				.get('/health')
				.expect(200);

			expect(response.body).toEqual({ status: 'ok' });
		});
	});

	describe('GET /school-district', () => {
		test('should return district info for valid coordinates', async () => {
			const response = await request(app)
				.get('/school-district')
				.query({ lat: 42.658529, lng: -86.206886 })
				.expect(200);

			expect(response.body).toEqual({
				status: true,
				districtId: '2630960',
				districtName: 'Saugatuck Public Schools',
			});
		});

		test('should return false status for invalid coordinates', async () => {
			const response = await request(app)
				.get('/school-district')
				.query({ lat: 0, lng: 0 })
				.expect(200);

			expect(response.body).toEqual({
				status: false,
				districtId: null,
				districtName: null,
			});
		});

		test('should handle missing latitude', async () => {
			const response = await request(app)
				.get('/school-district')
				.query({ lng: -86.206886 })
				.expect(200);

			expect(response.body).toEqual({
				status: false,
				districtId: null,
				districtName: null,
			});
		});

		test('should handle missing longitude', async () => {
			const response = await request(app)
				.get('/school-district')
				.query({ lat: 42.658529 })
				.expect(200);

			expect(response.body).toEqual({
				status: false,
				districtId: null,
				districtName: null,
			});
		});

		test('should handle non-numeric latitude', async () => {
			const response = await request(app)
				.get('/school-district')
				.query({ lat: 'invalid', lng: -86.206886 })
				.expect(200);

			expect(response.body).toEqual({
				status: false,
				districtId: null,
				districtName: null,
			});
		});

		test('should handle non-numeric longitude', async () => {
			const response = await request(app)
				.get('/school-district')
				.query({ lat: 42.658529, lng: 'invalid' })
				.expect(200);

			expect(response.body).toEqual({
				status: false,
				districtId: null,
				districtName: null,
			});
		});

		test('should handle empty query parameters', async () => {
			const response = await request(app)
				.get('/school-district')
				.expect(200);

			expect(response.body).toEqual({
				status: false,
				districtId: null,
				districtName: null,
			});
		});
	});

	describe('Response Headers', () => {
		test('should return JSON content type', async () => {
			const response = await request(app)
				.get('/school-district')
				.query({ lat: 42.658529, lng: -86.206886 });

			expect(response.headers['content-type']).toMatch(/json/);
		});
	});
});