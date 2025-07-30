# School District CLI

A command-line interface for testing the US School Districts API.

## Installation

```bash
npm install -g us-school-districts-api
```

Or run locally:
```bash
npm run cli -- [command] [options]
```

## Commands

### `lookup` - Look up a single school district

```bash
# Using global install
school-district-cli lookup --latitude 40.7128 --longitude -74.0060

# Using npm run
npm run cli -- lookup --latitude 40.7128 --longitude -74.0060

# Custom host
npm run cli -- lookup --latitude 40.7128 --longitude -74.0060 --host http://localhost:8080
```

### `batch` - Look up multiple school districts

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

### `test` - Run sample test coordinates

```bash
npm run cli -- test
```

This will test the API with coordinates for:
- New York City
- Los Angeles
- Chicago
- Houston
- Phoenix

### `health` - Check API health

```bash
npm run cli -- health
```

## Options

- `-h, --host <string>`: API host URL (default: http://localhost:3000)
- `-V, --version`: Show version
- `--help`: Show help for any command

## Examples

```bash
# Check if API is running
npm run cli -- health

# Look up a specific coordinate
npm run cli -- lookup --latitude 29.7604 --longitude -95.3698

# Test with sample cities
npm run cli -- test

# Batch lookup from file
npm run cli -- batch --file my-coordinates.json

# Use a different API host
npm run cli -- lookup --latitude 40.7128 --longitude -74.0060 --host https://api.example.com
```