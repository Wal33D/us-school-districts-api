import request from 'supertest';
import { app } from '../src/server';

describe('Performance and Stress Tests', () => {
  // Skip these tests in CI environments
  const runPerformanceTests = process.env.RUN_PERF_TESTS === 'true' || process.env.CI !== 'true';

  describe('Memory Usage', () => {
    test('should maintain low memory footprint', async () => {
      if (!runPerformanceTests) {
        console.log('Skipping performance test (set RUN_PERF_TESTS=true to run)');
        return;
      }

      // Make several requests to ensure memory doesn't grow
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/school-district')
          .query({ lat: 40.7128 + i * 0.1, lng: -74.006 });
      }

      const response = await request(app).get('/health');
      const memoryUsage = response.body.memory;

      expect(memoryUsage.heapUsed).toBeLessThanOrEqual(150); // Should stay under 150MB
      expect(memoryUsage.rss).toBeLessThanOrEqual(300); // RSS should be reasonable
    });
  });

  describe('Response Time', () => {
    test('single lookup should be fast', async () => {
      if (!runPerformanceTests) {
        console.log('Skipping performance test');
        return;
      }

      const startTime = Date.now();

      await request(app).get('/school-district').query({ lat: 42.3601, lng: -71.0589 }).expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(100); // Should respond in under 100ms
    });

    test('batch lookup should handle 100 coordinates efficiently', async () => {
      if (!runPerformanceTests) {
        console.log('Skipping performance test');
        return;
      }

      // Generate 100 random US coordinates
      const coordinates = Array.from({ length: 100 }, () => ({
        lat: 25 + Math.random() * 25, // 25-50 latitude (covers most of US)
        lng: -125 + Math.random() * 60, // -125 to -65 longitude
      }));

      const startTime = Date.now();

      const response = await request(app)
        .post('/school-districts/batch')
        .send({ coordinates })
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.count).toBe(100);
      expect(responseTime).toBeLessThan(10000); // Should handle 100 in under 10 seconds

      console.log(`Batch of 100: ${responseTime}ms (${responseTime / 100}ms per lookup)`);
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle concurrent requests without errors', async () => {
      if (!runPerformanceTests) {
        console.log('Skipping performance test');
        return;
      }

      const coordinates = [
        { lat: 42.3601, lng: -71.0589 }, // Boston
        { lat: 40.7128, lng: -74.006 }, // NYC
        { lat: 41.8781, lng: -87.6298 }, // Chicago
        { lat: 29.7604, lng: -95.3698 }, // Houston
        { lat: 33.4484, lng: -112.074 }, // Phoenix
      ];

      // Make 5 concurrent requests
      const promises = coordinates.map(coord =>
        request(app).get('/school-district').query(coord).expect(200)
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.body.status).toBeDefined();
      });

      // Check memory didn't spike
      const healthResponse = await request(app).get('/health');
      expect(healthResponse.body.memory.heapUsed).toBeLessThanOrEqual(150);
    });

    test('should handle rapid sequential requests', async () => {
      if (!runPerformanceTests) {
        console.log('Skipping performance test');
        return;
      }

      const iterations = 50;
      const startTime = Date.now();
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        const response = await request(app)
          .get('/school-district')
          .query({
            lat: 40 + (i % 10),
            lng: -100 + (i % 20),
          });

        if (response.status === 200) {
          successCount++;
        }
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;

      expect(successCount).toBe(iterations); // All should succeed
      expect(avgTime).toBeLessThan(100); // Average should be under 100ms

      console.log(
        `${iterations} sequential requests: ${totalTime}ms total, ${avgTime.toFixed(2)}ms average`
      );
    });
  });

  describe('Edge Case Performance', () => {
    test('should handle coordinates outside US efficiently', async () => {
      if (!runPerformanceTests) {
        console.log('Skipping performance test');
        return;
      }

      // International coordinates that won't match any district
      const coordinates = [
        { lat: 51.5074, lng: -0.1278 }, // London
        { lat: 48.8566, lng: 2.3522 }, // Paris
        { lat: 35.6762, lng: 139.6503 }, // Tokyo
      ];

      const startTime = Date.now();

      for (const coord of coordinates) {
        const response = await request(app).get('/school-district').query(coord).expect(200);

        // International coordinates should return false (too far from US)
        expect(response.body.status).toBe(false);
        expect(response.body.districtId).toBeNull();
        expect(response.body.districtName).toBeNull();
      }

      const totalTime = Date.now() - startTime;

      // Should handle out-of-bounds coordinates efficiently
      expect(totalTime).toBeLessThan(1000); // All 3 should complete in under 1 second
    });

    test('should handle malformed requests gracefully', async () => {
      if (!runPerformanceTests) {
        console.log('Skipping performance test');
        return;
      }

      const malformedRequests = [
        { lat: 'not-a-number', lng: -71.0589 },
        { lat: null, lng: -71.0589 },
        { lat: undefined, lng: -71.0589 },
        { lat: Infinity, lng: -71.0589 },
        { lat: NaN, lng: -71.0589 },
      ];

      for (const coord of malformedRequests) {
        const response = await request(app)
          .get('/school-district')
          .query(coord as any)
          .expect(400);

        expect(response.body.error).toBe('Invalid coordinates');
      }

      // Memory should still be low after handling bad requests
      const healthResponse = await request(app).get('/health');
      expect(healthResponse.body.memory.heapUsed).toBeLessThanOrEqual(150);
    });
  });

  describe('Database Performance', () => {
    test('should maintain consistent query performance', async () => {
      if (!runPerformanceTests) {
        console.log('Skipping performance test');
        return;
      }

      const timings: number[] = [];

      // Test various US locations
      const testLocations = [
        { lat: 42.3601, lng: -71.0589 }, // Boston
        { lat: 34.0522, lng: -118.2437 }, // Los Angeles
        { lat: 41.8781, lng: -87.6298 }, // Chicago
        { lat: 29.7604, lng: -95.3698 }, // Houston
        { lat: 33.4484, lng: -112.074 }, // Phoenix
        { lat: 39.7392, lng: -104.9903 }, // Denver
        { lat: 47.6062, lng: -122.3321 }, // Seattle
        { lat: 25.7617, lng: -80.1918 }, // Miami
      ];

      for (const location of testLocations) {
        const start = Date.now();
        await request(app).get('/school-district').query(location).expect(200);
        timings.push(Date.now() - start);
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);

      expect(avgTime).toBeLessThan(50); // Average should be under 50ms
      expect(maxTime).toBeLessThan(100); // No single query should exceed 100ms

      console.log(`Query timings - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime}ms`);
    });
  });

  describe('Long Running Stability', () => {
    test('should remain stable over many requests', async () => {
      if (!runPerformanceTests || process.env.SKIP_LONG_TESTS === 'true') {
        console.log('Skipping long-running test');
        return;
      }

      const iterations = 500;
      const checkpoints = [100, 250, 500];
      const memoryAtCheckpoints: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Random US coordinate
        const lat = 30 + Math.random() * 15;
        const lng = -120 + Math.random() * 50;

        await request(app).get('/school-district').query({ lat, lng });

        // Check memory at checkpoints
        if (checkpoints.includes(i + 1)) {
          const health = await request(app).get('/health');
          memoryAtCheckpoints.push(health.body.memory.heapUsed);
          console.log(`After ${i + 1} requests: ${health.body.memory.heapUsed}MB heap`);
        }
      }

      // Memory should not grow significantly
      const memoryGrowth =
        memoryAtCheckpoints[memoryAtCheckpoints.length - 1] - memoryAtCheckpoints[0];
      expect(memoryGrowth).toBeLessThanOrEqual(25); // Should not grow more than 25MB

      // Final memory should still be under limit
      expect(memoryAtCheckpoints[memoryAtCheckpoints.length - 1]).toBeLessThan(150);
    });
  });
});
