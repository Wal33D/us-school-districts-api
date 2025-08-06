# US School Districts API

High-performance API for US school district boundary lookups using NCES official data.

## Overview

Provides school district information based on geographic coordinates for the CandyComp platform. Uses official NCES (National Center for Education Statistics) shapefile data with R-tree spatial indexing for fast lookups. Built with TypeScript and Express, featuring ultra-low memory usage (~40MB) and LRU caching.

## Quick Start

```bash
# Install dependencies
npm install

# Download NCES shapefile data (first run)
npm run download-data

# Run development server
npm run dev

# Run production
npm run build && npm start
```

## Configuration

Required environment variables:

| Variable      | Description                 | Example         |
| ------------- | --------------------------- | --------------- |
| `PORT`        | Service port                | `3712`          |
| `ALLOWED_IPS` | Comma-separated allowed IPs | `::1,127.0.0.1` |
| `CACHE_SIZE`  | LRU cache size              | `100`           |
| `NODE_ENV`    | Environment mode            | `production`    |

## API Reference

### Endpoints

#### `POST /lookup`

Find school district by coordinates

**Request Body:**

```json
{
  "lat": 42.3601,
  "lng": -71.0589
}
```

**Response:**

```json
{
  "status": true,
  "districtId": "2502790",
  "districtName": "Boston Public Schools"
}
```

#### `POST /batch-lookup`

Lookup multiple coordinates

**Request Body:**

```json
{
  "coordinates": [
    { "lat": 42.3601, "lng": -71.0589 },
    { "lat": 40.7128, "lng": -74.006 }
  ]
}
```

**Response:**

```json
{
  "results": [
    {
      "status": true,
      "districtId": "2502790",
      "districtName": "Boston Public Schools"
    },
    {
      "status": true,
      "districtId": "3600001",
      "districtName": "New York City Department of Education"
    }
  ]
}
```

#### `GET /health`

Health check endpoint

#### `GET /stats`

Service statistics (cache hits, lookups, etc.)

## CLI Tool

```bash
# Run interactive CLI
npm run cli

# Direct lookup
npm run cli -- --lat 42.3601 --lng -71.0589

# Batch lookup from file
npm run cli -- --file coordinates.json
```

## Development

```bash
# Run with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format

# Download latest NCES data
npm run download-data
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Architecture

### Key Features

- **R-tree Spatial Index**: O(log n) performance for boundary lookups
- **Memory Optimization**: Custom simplified geometries (~40MB total)
- **LRU Cache**: Frequently accessed districts cached in memory
- **NCES Data**: Official government school district boundaries
- **Graceful Shutdown**: Proper cleanup of resources
- **Security**: IP whitelisting and rate limiting

### Data Processing

1. Downloads NCES shapefile data
2. Simplifies complex geometries
3. Builds R-tree spatial index
4. Caches simplified boundaries
5. Performs point-in-polygon tests

### Performance

- **Memory**: ~40MB (97% reduction from raw data)
- **Lookup Speed**: <10ms average
- **Startup Time**: ~2-3 seconds
- **Concurrent Requests**: Handles 1000+ RPS

## Deployment

Runs as a local service on port 3712:

```bash
# Start service
npm start

# Using PM2
pm2 start ecosystem.config.js
pm2 logs school-districts-api
```

## License

© 2024 Waleed Judah. All rights reserved.
