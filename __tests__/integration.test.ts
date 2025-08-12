import request from 'supertest';
import { app } from '../src/server';
import fs from 'fs';
import path from 'path';

describe('School District API Integration Tests', () => {
  // Verify database exists before running tests
  beforeAll(() => {
    const dbPath = path.join(__dirname, '../school_district_data/districts.db');
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database not found. Run: npm run setup-db');
    }
  });

  describe('GET /health', () => {
    test('should return healthy status with database connected', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        database: {
          connected: true,
        },
      });
      expect(response.body.memory).toBeDefined();
      expect(response.body.memory.heapUsed).toBeLessThan(150); // Should be under 150MB
    });
  });

  describe('GET /school-district', () => {
    test('should return exact district match for Boston coordinates', async () => {
      const response = await request(app)
        .get('/school-district')
        .query({ lat: 42.3601, lng: -71.0589 })
        .expect(200);

      expect(response.body).toMatchObject({
        status: true,
        districtId: '2502790',
        districtName: 'Boston School District',
        gradeRange: {
          lowest: 'Pre-K',
          highest: '12',
        },
        stateCode: '25',
      });
      expect(response.body.area).toBeDefined();
      expect(response.body.area.landSqMiles).toBeGreaterThan(0);
    });

    test('should return district for NYC coordinates', async () => {
      const response = await request(app)
        .get('/school-district')
        .query({ lat: 40.7128, lng: -74.006 })
        .expect(200);

      expect(response.body).toMatchObject({
        status: true,
        stateCode: '36', // New York state
      });
      expect(response.body.districtName).toBeTruthy();
    });

    test('should return nearest district for ocean coordinates', async () => {
      const response = await request(app)
        .get('/school-district')
        .query({ lat: 0, lng: 0 })
        .expect(200);

      // With the new implementation, we always find the nearest district
      expect(response.body.status).toBe(true);
      expect(response.body.districtId).toBeTruthy();
      expect(response.body.districtName).toBeTruthy();
      expect(response.body.isApproximate).toBe(true);
      expect(response.body.approximateDistance).toBeGreaterThan(1000); // Very far away
    });

    test('should return error for invalid coordinates', async () => {
      const response = await request(app)
        .get('/school-district')
        .query({ lat: 'invalid', lng: 'invalid' })
        .expect(400);

      expect(response.body).toMatchObject({
        status: false,
        error: 'Invalid coordinates',
      });
    });

    test('should return error for missing coordinates', async () => {
      const response = await request(app).get('/school-district').query({}).expect(400);

      expect(response.body).toMatchObject({
        status: false,
        error: 'Invalid coordinates',
      });
    });

    test('should set proper cache headers', async () => {
      const response = await request(app)
        .get('/school-district')
        .query({ lat: 42.3601, lng: -71.0589 });

      expect(response.headers['cache-control']).toBe('public, max-age=86400, s-maxage=86400');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('POST /lookup', () => {
    test('should return district for valid coordinates', async () => {
      const response = await request(app)
        .post('/lookup')
        .send({ lat: 42.3601, lng: -71.0589 })
        .expect(200);

      expect(response.body).toMatchObject({
        status: true,
        districtId: '2502790',
        districtName: 'Boston School District',
      });
    });

    test('should return error for non-numeric coordinates', async () => {
      const response = await request(app)
        .post('/lookup')
        .send({ lat: 'invalid', lng: -71.0589 })
        .expect(400);

      expect(response.body).toMatchObject({
        status: false,
        error: 'Invalid coordinates',
      });
    });

    test('should return error for missing body', async () => {
      const response = await request(app).post('/lookup').expect(400);

      expect(response.body).toMatchObject({
        status: false,
        error: 'Invalid coordinates',
      });
    });
  });

  describe('POST /school-districts/batch', () => {
    test('should process multiple coordinates successfully', async () => {
      const coordinates = [
        { lat: 42.3601, lng: -71.0589 }, // Boston
        { lat: 40.7128, lng: -74.006 }, // NYC
        { lat: 41.8781, lng: -87.6298 }, // Chicago
      ];

      const response = await request(app)
        .post('/school-districts/batch')
        .send({ coordinates })
        .expect(200);

      expect(response.body.count).toBe(3);
      expect(response.body.results).toHaveLength(3);

      // Check each result has required fields
      response.body.results.forEach((result: any, index: number) => {
        expect(result.index).toBe(index);
        expect(result.status).toBeDefined();
        expect(result.districtId).toBeDefined();
        expect(result.districtName).toBeDefined();
      });

      // All major US cities should have districts
      const successful = response.body.results.filter((r: any) => r.status);
      expect(successful.length).toBe(3);
    });

    test('should handle invalid coordinates in batch', async () => {
      const coordinates = [
        { lat: 42.3601, lng: -71.0589 }, // Valid
        { lat: 'invalid', lng: -71.0589 }, // Invalid
        { lat: 40.7128, lng: -74.006 }, // Valid
      ];

      const response = await request(app)
        .post('/school-districts/batch')
        .send({ coordinates })
        .expect(200);

      expect(response.body.count).toBe(3);
      expect(response.body.results[0].status).toBe(true);
      expect(response.body.results[1].status).toBe(false);
      expect(response.body.results[1].error).toBe('Invalid coordinate');
      expect(response.body.results[2].status).toBe(true);
    });

    test('should reject batch larger than 100 coordinates', async () => {
      const coordinates = Array(101).fill({ lat: 42.3601, lng: -71.0589 });

      const response = await request(app)
        .post('/school-districts/batch')
        .send({ coordinates })
        .expect(400);

      expect(response.body).toMatchObject({
        status: false,
        error: 'Maximum 100 coordinates per batch',
      });
    });

    test('should reject non-array coordinates', async () => {
      const response = await request(app)
        .post('/school-districts/batch')
        .send({ coordinates: 'not-an-array' })
        .expect(400);

      expect(response.body).toMatchObject({
        status: false,
        error: 'coordinates must be an array',
      });
    });
  });

  describe('GET /stats', () => {
    test('should return statistics', async () => {
      const response = await request(app).get('/stats').expect(200);

      expect(response.body.districts).toBeGreaterThan(13000); // Should have ~13,382 districts
      expect(response.body.memory).toBeDefined();
      expect(response.body.memory.heapUsed).toBeLessThan(150); // Under 150MB
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle coordinates near district boundaries', async () => {
      // Test a point that might be on a boundary
      const response = await request(app)
        .get('/school-district')
        .query({ lat: 42.3556, lng: -71.0696 }) // Near Boston boundary
        .expect(200);

      expect(response.body.status).toBeDefined();
      if (response.body.status) {
        expect(response.body.districtName).toBeTruthy();
        // Check if it's marked as approximate if using nearest district
        if (response.body.isApproximate) {
          expect(response.body.approximateDistance).toBeDefined();
        }
      }
    });

    test('should handle coordinates in US territories', async () => {
      // Puerto Rico coordinates
      const response = await request(app)
        .get('/school-district')
        .query({ lat: 18.4655, lng: -66.1057 })
        .expect(200);

      // Might or might not have district data for territories
      expect(response.body.status).toBeDefined();
    });

    test('should handle coordinates at extreme latitudes/longitudes', async () => {
      // Alaska coordinates
      const response = await request(app)
        .get('/school-district')
        .query({ lat: 64.8378, lng: -147.7164 })
        .expect(200);

      expect(response.body.status).toBeDefined();
      if (response.body.status) {
        expect(response.body.stateCode).toBe('02'); // Alaska
      }
    });
  });
});
