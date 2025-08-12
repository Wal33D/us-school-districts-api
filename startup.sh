#!/bin/bash
# Startup script for US School Districts API
# This script ensures native modules are rebuilt and database exists

echo "Starting US School Districts API..."

# Always rebuild native modules to prevent Node version mismatch
echo "Rebuilding native modules..."
npm rebuild better-sqlite3 2>/dev/null || npm install better-sqlite3

# Ensure database exists
if [ ! -f "school_district_data/districts.db" ]; then
  echo "Database not found, creating from shapefile..."
  npm run setup-db
fi

# Verify database exists and is valid
if [ -f "school_district_data/districts.db" ]; then
  DB_SIZE=$(stat -f%z "school_district_data/districts.db" 2>/dev/null || stat -c%s "school_district_data/districts.db" 2>/dev/null)
  if [ -n "$DB_SIZE" ] && [ "$DB_SIZE" -gt 100000000 ]; then
    echo "Database verified ($(($DB_SIZE / 1024 / 1024))MB)"
  else
    echo "Database seems invalid, recreating..."
    rm -f school_district_data/districts.db
    npm run setup-db
  fi
else
  echo "Failed to create database!"
  exit 1
fi

# Start the actual server
echo "Starting server on port ${PORT:-3712}..."
exec node dist/server.js