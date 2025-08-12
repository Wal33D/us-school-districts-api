# US School Districts Service

High-performance API for US school district boundary lookups using NCES official data.

## Overview

Provides school district information based on geographic coordinates for the CandyComp platform. Uses official NCES (National Center for Education Statistics) shapefile data with R-tree spatial indexing for fast lookups. Built with TypeScript and Express, featuring ultra-low memory usage (~40MB) and LRU caching.

## Features

- **R-tree Spatial Index** - O(log n) performance for boundary lookups
- **Memory Optimization** - Custom simplified geometries (~40MB total)
- **LRU Cache** - Frequently accessed districts cached in memory
- **NCES Data** - Official government school district boundaries
- **TypeScript** - Full type safety with zero errors/warnings
- **High Performance** - Handles 1000+ RPS with <10ms lookups

## Installation

```bash
# Install dependencies
npm install

# Download NCES shapefile data (first run)
npm run download-data

# Build TypeScript
npm run build

# Run development server
npm run dev

# Run production
npm start
```

## Environment Variables

### Core Settings
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Service port | 3712 |
| NODE_ENV | Environment mode | development |
| LOG_LEVEL | Logging level | info |

### Performance Tuning
| Variable | Description | Default |
|----------|-------------|---------|
| GEOMETRY_SIMPLIFICATION_TOLERANCE | Boundary accuracy (decimal degrees) | 0.001 |
| MAX_BATCH_SIZE | Max coordinates per batch request | 50 |
| GEOMETRY_CACHE_SIZE | Number of districts to cache | 10 |

### Security (Optional)
| Variable | Description | Default |
|----------|-------------|---------|
| ENABLE_SECURITY_MIDDLEWARE | Enable helmet/CORS/rate limiting | false |
| RATE_LIMIT_WINDOW_MS | Rate limit time window | 60000 |
| RATE_LIMIT_MAX_REQUESTS | Max requests per window | 100 |
| CORS_ALLOWED_ORIGINS | Allowed CORS origins | * |

## API Endpoints

### `POST /lookup`

Find school district by coordinates

**Request:**
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

### `POST /batch-lookup`

Lookup multiple coordinates

**Request:**
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

### `GET /health`

Health check endpoint

### `GET /stats`

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
npm run lint:fix

# Format code
npm run format
npm run format:check

# Download latest NCES data
npm run download-data

# Clean build
npm run clean
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

### Data Processing

1. Downloads NCES shapefile data
2. Simplifies complex geometries
3. Builds R-tree spatial index
4. Caches simplified boundaries
5. Performs point-in-polygon tests

### Performance Metrics

- **Memory Usage** - ~40MB (97% reduction from raw data)
- **Lookup Speed** - <10ms average
- **Startup Time** - ~2-3 seconds
- **Concurrent Requests** - Handles 1000+ RPS

## Production Deployment

### Using PM2

```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs service-us-school-districts

# Restart
pm2 restart service-us-school-districts
```

### Manual Start

```bash
npm start
```

## GitHub Actions Deployment

The repository includes a GitHub Actions workflow that automatically builds and deploys the service when you push to the `main` branch.

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

#### SSH Connection
- `LINODE_HOST` - Server IP or hostname
- `LINODE_USERNAME` - SSH username (e.g., `puppeteer-user`)
- `LINODE_PASSWORD` - SSH password for authentication

#### Application Environment
- `PORT` - Service port (default: 3712)
- `NODE_ENV` - Environment setting (e.g., `production`)
- `LOG_LEVEL` - Logging level (e.g., `info`)
- `GEOMETRY_SIMPLIFICATION_TOLERANCE` - Boundary accuracy
- `MAX_BATCH_SIZE` - Max batch size
- `GEOMETRY_CACHE_SIZE` - Cache size

### Deployment Process

1. Builds TypeScript project
2. Copies built files to server
3. Downloads NCES data if not present
4. Creates `.env` file from GitHub secrets
5. Installs production dependencies
6. Restarts PM2 process

## Performance Optimization

- **Spatial Indexing** - R-tree index for O(log n) lookups
- **Geometry Simplification** - Reduces memory by 97%
- **LRU Caching** - Caches frequently accessed districts
- **Connection Pooling** - Optimized HTTP connections
- **Async Processing** - Non-blocking operations

## Security

- **Input Validation** - All coordinates validated
- **Rate Limiting** - Optional request throttling
- **Error Sanitization** - Safe error responses
- **CORS Support** - Configurable origins
- **Helmet.js** - Security headers when enabled

## License

© 2024 Waleed Judah. All rights reserved.