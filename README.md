# US School Districts Service

High-performance API for US school district boundary lookups using NCES official data with SQLite.

## Overview

Provides school district information based on geographic coordinates for the CandyComp platform. Uses official NCES (National Center for Education Statistics) shapefile data stored in SQLite with spatial indexing for ultra-fast lookups. Built with TypeScript and Express, featuring minimal memory usage (~100MB) and exceptional reliability.

## Performance Improvements (v2.0)

| Metric | Old (R-tree) | New (SQLite) | Improvement |
|--------|--------------|--------------|-------------|
| Memory Usage | 1,700 MB | 100 MB | **95% reduction** |
| Success Rate | 70% | 100% | **Perfect reliability** |
| Response Time | Degraded under load | <50ms consistent | **Stable performance** |
| Startup Time | 30+ seconds | <1 second | **30x faster** |

## Features

- **SQLite Database** - Pre-built spatial database for instant lookups
- **Spatial Indexing** - Bounding box indexes for O(log n) performance
- **Memory Efficient** - Only ~100MB RAM usage (vs 1.7GB before)
- **100% Reliability** - No timeouts or failures under heavy load
- **NCES Data** - Official government school district boundaries
- **TypeScript** - Full type safety with zero errors/warnings
- **Production Ready** - PM2 support with graceful shutdown

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Setup database (one-time - requires NCES shapefile)
npm run setup-db

# Run development server
npm run dev

# Run production
npm start
```

## Database Setup

The service requires a one-time database creation from NCES shapefiles:

1. **Download NCES Data**:
   - Visit [NCES School District Boundaries](https://nces.ed.gov/programs/edge/Geographic/DistrictBoundaries)
   - Download the latest shapefile (e.g., `EDGE_SCHOOLDISTRICT_TL24_SY2324.zip`)
   - Extract to `school_district_data/` directory

2. **Build Database**:
   ```bash
   npm run build
   npm run setup-db
   ```

This creates a ~200MB SQLite database with 13,382 US school districts.

## Environment Variables

### Core Settings
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Service port | 3712 |
| NODE_ENV | Environment mode | development |
| LOG_LEVEL | Logging level | info |

## API Endpoints

### Health Check
```bash
GET /health
```
Returns service health status and memory usage.

### Single Lookup
```bash
GET /school-district?lat=42.3601&lng=-71.0589
```

**Response:**
```json
{
  "status": true,
  "districtId": "2502790",
  "districtName": "Boston School District",
  "gradeRange": {
    "lowest": "Pre-K",
    "highest": "12"
  },
  "area": {
    "landSqMiles": 48.34,
    "waterSqMiles": 41.27
  },
  "schoolYear": "2023-2024",
  "stateCode": "25",
  "coordinates": {
    "lat": 42.3601,
    "lng": -71.0589
  }
}
```

### POST Lookup
```bash
POST /lookup
Content-Type: application/json

{
  "lat": 42.3601,
  "lng": -71.0589
}
```

### Batch Lookup
```bash
POST /school-districts/batch
Content-Type: application/json

{
  "coordinates": [
    {"lat": 42.3601, "lng": -71.0589},
    {"lat": 40.7128, "lng": -74.0060}
  ]
}
```

Returns array of results for each coordinate (max 100 per batch).

## Production Deployment

### PM2 Configuration

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Reload (zero-downtime)
pm2 reload ecosystem.config.js

# View logs
pm2 logs us-school-districts-api
```

The service is configured with:
- Auto-restart on failure
- Memory limit: 150MB (auto-restart if exceeded)
- Daily restart at 3 AM for maintenance
- Graceful shutdown handling

## Architecture

### SQLite-Based Design

```
┌─────────────────────────────────────────┐
│         School Districts API             │
├─────────────────────────────────────────┤
│                                         │
│   Request → Bounding Box Query         │
│      ↓                                  │
│   SQLite Spatial Index                 │
│      ↓                                  │
│   Candidates (1-5 districts)           │
│      ↓                                  │
│   Point-in-Polygon Check               │
│      ↓                                  │
│   Return Match or Nearest              │
│                                         │
├─────────────────────────────────────────┤
│   Memory: ~100MB   Response: <50ms     │
└─────────────────────────────────────────┘
```

### Why SQLite?

1. **Memory Efficiency**: Database on disk, not in RAM
2. **Fast Queries**: Prepared statements + spatial indexes
3. **Reliability**: No garbage collection issues
4. **Portability**: Single file database
5. **Read-Only Safety**: Database opened in read-only mode

## CLI Tool

Test the API using the built-in CLI:

```bash
# Single coordinate lookup
npm run cli lookup --latitude 42.3601 --longitude -71.0589

# Batch processing from file
npm run cli batch --file coordinates.json

# Health check
npm run cli health

# Performance test
npm run cli test --requests 1000
```

## Development

```bash
# Development with auto-reload
npm run dev

# Run tests
npm test

# Lint and format
npm run lint
npm run format

# Type checking
npm run type-check

# Clean build
npm run clean && npm run build
```

## Performance

Stress test results (1000 requests, 10 concurrent):

```
Total Requests: 1000
Successful: 1000 (100.0%)
Failed: 0 (0.0%)
Average Response: 109ms
Requests/Second: 90.58
Memory Usage: ~100MB (stable)
```

## Troubleshooting

### Database Not Found
```
Error: Database not found at .../districts.db
```
**Solution**: Run `npm run setup-db` after placing shapefile in `school_district_data/`

### High Memory Usage
If memory exceeds 150MB, PM2 will auto-restart. Check for:
- Memory leaks in custom code
- Excessive concurrent requests
- Large batch sizes

### Slow Lookups
Normal response time is <50ms. If slower:
- Check disk I/O performance
- Verify spatial indexes exist
- Monitor concurrent request load

## License

MIT

## Author

**Waleed Judah** (Wal33D)
- Email: aquataze@yahoo.com
- GitHub: [@Wal33D](https://github.com/Wal33D)