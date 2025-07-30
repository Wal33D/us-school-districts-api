# US School Districts API

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-Jest-red.svg)](https://jestjs.io/)
[![Express](https://img.shields.io/badge/Express-5.1-lightgrey.svg)](https://expressjs.com/)

A high-performance, memory-optimized API service for looking up US school district boundaries based on geographic coordinates. This service uses official government shapefile data from the National Center for Education Statistics (NCES) to provide accurate district information.

## 🌟 Key Features

- **🚀 Ultra-Low Memory Usage**: Only ~40MB RAM (97% reduction from naive implementation)
- **⚡ Lightning-Fast Lookups**: R-tree spatial indexing for O(log n) performance
- **🔄 Auto-Updates**: Automatically downloads latest NCES shapefile data
- **💾 Smart Caching**: LRU cache for frequently accessed districts
- **🛡️ Production Ready**: Comprehensive security, compression, graceful shutdown
- **📊 Official Data**: Uses government EDGE geographic boundaries
- **🔧 CLI Tool**: Built-in command-line interface for testing
- **🎯 Batch Processing**: Support for multiple coordinate lookups

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [CLI Usage](#cli-usage)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- TypeScript 5.2+

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/Wal33D/us-school-districts-api.git
cd us-school-districts-api
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

4. **Start the server:**
```bash
npm start
```

The server will automatically download the latest NCES shapefile data on first run (~300MB download).

## ⚡ Quick Start

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start

# Run with PM2
pm2 start ecosystem.config.js

# Use the CLI
npm run cli -- health
```

### Example Request

```bash
curl "http://localhost:3712/school-district?lat=40.7128&lng=-74.0060"
```

### Example Response

```json
{
  "status": true,
  "districtId": "3620580",
  "districtName": "New York City Geographic District # 2",
  "coordinates": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

## 📚 API Documentation

### Endpoints

#### `GET /school-district`

Returns the school district information for a given coordinate.

**Query Parameters:**
- `lat` (required): Latitude (decimal degrees)
- `lng` (required): Longitude (decimal degrees)

**Response:**
```json
{
  "status": boolean,      // true if district found, false otherwise
  "districtId": string,   // NCES district ID (GEOID)
  "districtName": string, // Official district name
  "coordinates": {        // Echo of input coordinates
    "lat": number,
    "lng": number
  }
}
```

**Status Codes:**
- `200 OK`: Successful response
- `400 Bad Request`: Invalid or missing coordinates

**Validation:**
- Latitude must be between 18 and 72 (US territories range)
- Longitude must be between -180 and -65 (US territories range)

#### `POST /school-districts/batch`

Look up multiple school districts in a single request.

**Request Body:**
```json
[
  {"lat": 40.7128, "lng": -74.0060},
  {"lat": 34.0522, "lng": -118.2437}
]
```

**Response:**
```json
{
  "count": 2,
  "results": [
    {
      "index": 0,
      "status": true,
      "districtId": "3620580",
      "districtName": "New York City Geographic District # 2",
      "coordinates": {"lat": 40.7128, "lng": -74.0060}
    },
    {
      "index": 1,
      "status": true,
      "districtId": "0622710",
      "districtName": "Los Angeles Unified",
      "coordinates": {"lat": 34.0522, "lng": -118.2437}
    }
  ]
}
```

**Limits:**
- Maximum 100 coordinates per request
- Supports multiple coordinate formats: `lat/lng`, `latitude/longitude`, `lat/lon`

#### `GET /health`

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok"
}
```

## 🔧 CLI Usage

The project includes a comprehensive CLI tool for testing and development.

### Installation

```bash
# Global installation
npm install -g us-school-districts-api

# Or use locally with npm run
npm run cli -- [command] [options]
```

### Commands

#### `lookup` - Single coordinate lookup

```bash
# Basic usage
npm run cli -- lookup --latitude 40.7128 --longitude -74.0060

# Short flags
npm run cli -- lookup --lat 40.7128 --lng -74.0060

# Custom host
npm run cli -- lookup --lat 40.7128 --lng -74.0060 --host http://localhost:8080
```

#### `batch` - Multiple coordinate lookup

Create a JSON file with coordinates:
```json
[
  {"lat": 40.7128, "lng": -74.0060},
  {"lat": 34.0522, "lng": -118.2437},
  {"latitude": 41.8781, "longitude": -87.6298}
]
```

Then run:
```bash
npm run cli -- batch --file coordinates.json
```

#### `test` - Quick test with sample cities

```bash
npm run cli -- test
```

Tests coordinates for New York City, Los Angeles, Chicago, Houston, and Phoenix.

#### `health` - Check API status

```bash
npm run cli -- health
```

## 🏗️ Architecture

### Memory Optimization Strategy

The API uses an innovative approach to minimize memory usage while maintaining performance:

1. **Spatial Index**: Only bounding boxes are stored in memory using an R-tree structure
2. **On-Demand Loading**: Full geometry data is loaded from disk only when needed
3. **LRU Cache**: Recently accessed district geometries are cached (default: 100 districts)
4. **Geometry Simplification**: Complex polygons are simplified to reduce memory footprint

### Technology Stack

- **Runtime**: Node.js 18+ with TypeScript 5.2+
- **Framework**: Express.js 5.1
- **Spatial Operations**: Turf.js
- **Spatial Indexing**: rbush (R-tree implementation)
- **Data Format**: ESRI Shapefile
- **Process Manager**: PM2
- **Testing**: Jest
- **Linting**: ESLint + Prettier
- **Security**: Helmet, CORS, Rate Limiting

### Data Source

This API uses official school district boundary data from:
- **Source**: [NCES EDGE Geographic Data](https://nces.ed.gov/programs/edge/Geographic/DistrictBoundaries)
- **Update Frequency**: Annually
- **Coverage**: All US states and territories

## 💻 Development

### Project Structure

```
us-school-districts-api/
├── src/
│   ├── server.ts              # Main server file
│   ├── cli.ts                 # CLI tool
│   ├── types.ts               # TypeScript definitions
│   ├── config/
│   │   └── index.ts           # Configuration management
│   ├── middleware/
│   │   ├── errorHandler.ts    # Error handling
│   │   ├── localOnlyMiddleware.ts
│   │   └── security.ts        # Security middleware
│   └── utils/
│       ├── LRUCache.ts        # LRU cache implementation
│       ├── errors.ts          # Custom error classes
│       └── logger.ts          # Winston logger
├── dist/                      # Compiled JavaScript
├── school_district_data/      # Downloaded shapefiles (git-ignored)
├── __tests__/                 # Test files
├── ecosystem.config.js        # PM2 configuration
├── tsconfig.json             # TypeScript configuration
└── package.json
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3712` |
| `NODE_ENV` | Environment mode | `development` |
| `ENABLE_SECURITY_MIDDLEWARE` | Enable security features | `false` |
| `BYPASS_IPS` | IPs that bypass rate limiting | `127.0.0.1,::1` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit time window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `*` |
| `LOG_LEVEL` | Logging level | `info` |

### Scripts

```bash
# Development
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm run cli          # Run CLI tool

# Testing
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format with Prettier
npm run format:check # Check formatting

# Production
npm start            # Start server
pm2 start ecosystem.config.js
```

## 🧪 Testing

The project includes comprehensive test coverage using Jest:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Test files are located in `src/__tests__/` and cover:
- API endpoints
- Helper functions
- LRU cache implementation
- Error handling

## 🚀 Deployment

### Using PM2

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs us-school-districts-api

# Restart
pm2 restart us-school-districts-api

# Stop
pm2 stop us-school-districts-api
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY ecosystem.config.js ./
EXPOSE 3712
CMD ["npm", "start"]
```

### System Requirements

- **Memory**: ~50MB (after optimization)
- **Disk**: ~500MB (for shapefile storage)
- **CPU**: Minimal (benefits from multiple cores with PM2 cluster mode)

## 📊 Performance

- **Startup Time**: ~5-10 seconds (initial shapefile indexing)
- **Lookup Time**: <50ms average (cached), <200ms (uncached)
- **Concurrent Requests**: Handles thousands of requests per second
- **Memory Usage**: ~40MB baseline + LRU cache
- **Response Caching**: 7-day cache headers for CDN compatibility

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- National Center for Education Statistics (NCES) for providing the geographic data
- The Turf.js team for excellent geospatial tools
- The rbush team for the efficient R-tree implementation

## 📞 Support

For issues, questions, or contributions:
- GitHub Issues: [github.com/Wal33D/us-school-districts-api/issues](https://github.com/Wal33D/us-school-districts-api/issues)
- Email: waleed@glitchgaming.us

---

Made with ❤️ by [Waleed Judah](https://github.com/Wal33D)