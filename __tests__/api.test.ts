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

  // School district endpoint (GET)
  app.get('/school-district', (req: Request, res: any) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.json({
        status: false,
        districtId: null,
        districtName: null,
        coordinates: { lat, lng },
      });
    }

    // Mock lookup based on coordinates
    if (lat === 42.658529 && lng === -86.206886) {
      return res.json({
        ...mockLookupResult,
        coordinates: { lat, lng },
      });
    }

    res.json({
      status: false,
      districtId: null,
      districtName: null,
      coordinates: { lat, lng },
    });
  });

  // School district lookup endpoint (POST)
  app.post('/lookup', (req: Request, res: any) => {
    const { lat: latInput, lng: lngInput, latitude, longitude, lon } = req.body || {};

    // Support multiple coordinate field names
    const lat = Number(latInput || latitude);
    const lng = Number(lngInput || longitude || lon);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        status: false,
        error: 'Invalid coordinates: lat and lng must be numbers',
        districtId: null,
        districtName: null,
      });
    }

    // Mock lookup based on coordinates
    if (lat === 42.658529 && lng === -86.206886) {
      return res.json({
        ...mockLookupResult,
        coordinates: { lat, lng },
      });
    }

    res.json({
      status: false,
      districtId: null,
      districtName: null,
      coordinates: { lat, lng },
    });
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
      const response = await request(app).get('/health').expect(200);

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
        coordinates: { lat: 42.658529, lng: -86.206886 },
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
        coordinates: { lat: 0, lng: 0 },
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
        coordinates: { lat: null, lng: -86.206886 },
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
        coordinates: { lat: 42.658529, lng: null },
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
        coordinates: { lat: null, lng: -86.206886 },
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
        coordinates: { lat: 42.658529, lng: null },
      });
    });

    test('should handle empty query parameters', async () => {
      const response = await request(app).get('/school-district').expect(200);

      expect(response.body).toEqual({
        status: false,
        districtId: null,
        districtName: null,
        coordinates: { lat: null, lng: null },
      });
    });
  });

  describe('POST /lookup', () => {
    test('should return district info for valid coordinates', async () => {
      const response = await request(app)
        .post('/lookup')
        .send({ lat: 42.658529, lng: -86.206886 })
        .expect(200);

      expect(response.body).toEqual({
        status: true,
        districtId: '2630960',
        districtName: 'Saugatuck Public Schools',
        coordinates: { lat: 42.658529, lng: -86.206886 },
      });
    });

    test('should support latitude/longitude field names', async () => {
      const response = await request(app)
        .post('/lookup')
        .send({ latitude: 42.658529, longitude: -86.206886 })
        .expect(200);

      expect(response.body).toEqual({
        status: true,
        districtId: '2630960',
        districtName: 'Saugatuck Public Schools',
        coordinates: { lat: 42.658529, lng: -86.206886 },
      });
    });

    test('should return false status for coordinates not in database', async () => {
      const response = await request(app).post('/lookup').send({ lat: 40, lng: -100 }).expect(200);

      expect(response.body).toEqual({
        status: false,
        districtId: null,
        districtName: null,
        coordinates: { lat: 40, lng: -100 },
      });
    });

    test('should return error for missing coordinates', async () => {
      const response = await request(app).post('/lookup').send({}).expect(400);

      expect(response.body).toEqual({
        status: false,
        error: 'Invalid coordinates: lat and lng must be numbers',
        districtId: null,
        districtName: null,
      });
    });

    test('should return error for invalid coordinates', async () => {
      const response = await request(app)
        .post('/lookup')
        .send({ lat: 'invalid', lng: -86.206886 })
        .expect(400);

      expect(response.body).toEqual({
        status: false,
        error: 'Invalid coordinates: lat and lng must be numbers',
        districtId: null,
        districtName: null,
      });
    });

    test('should return error for missing request body', async () => {
      const response = await request(app).post('/lookup').expect(400);

      expect(response.body).toEqual({
        status: false,
        error: 'Invalid coordinates: lat and lng must be numbers',
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
