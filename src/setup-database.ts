#!/usr/bin/env node

/**
 * One-time script to convert NCES shapefile to SQLite database
 *
 * Run this once to create the database, then use it forever.
 * The database is about 200MB and contains all US school districts.
 */

import Database from 'better-sqlite3';
import * as shapefile from 'shapefile';
import { bbox, center, simplify } from '@turf/turf';
import path from 'path';
import fs from 'fs';

const SCHOOLS_DIR = path.join(__dirname, '../school_district_data');
const DB_PATH = path.join(SCHOOLS_DIR, 'districts.db');

interface ShapefileProperties {
  GEOID?: string;
  NAME?: string;
  STATEFP?: string;
  LOGRADE?: string;
  HIGRADE?: string;
  ALAND?: string | number;
  AWATER?: string | number;
  SCHOOLYEAR?: string;
}

async function createDatabase(): Promise<void> {
  console.log('📦 Creating SQLite database from shapefile...');
  console.log(`   Source: ${SCHOOLS_DIR}`);
  console.log(`   Target: ${DB_PATH}`);

  // Ensure directory exists
  if (!fs.existsSync(SCHOOLS_DIR)) {
    fs.mkdirSync(SCHOOLS_DIR, { recursive: true });
  }

  // Remove old database if exists
  if (fs.existsSync(DB_PATH)) {
    console.log('⚠️  Removing existing database...');
    fs.unlinkSync(DB_PATH);
  }

  const db = new Database(DB_PATH);

  try {
    // Create table with all needed fields
    db.exec(`
      CREATE TABLE districts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        state_code TEXT,
        grade_lowest TEXT,
        grade_highest TEXT,
        land_area REAL,
        water_area REAL,
        school_year TEXT,
        -- Bounding box for fast filtering
        min_lng REAL NOT NULL,
        min_lat REAL NOT NULL, 
        max_lng REAL NOT NULL,
        max_lat REAL NOT NULL,
        -- Center point for distance calculations
        center_lng REAL,
        center_lat REAL,
        -- Geometry as JSON (simplified to reduce size)
        geometry TEXT NOT NULL
      );

      -- Create spatial index on bounding box for ultra-fast lookups
      CREATE INDEX idx_bbox ON districts(min_lng, max_lng, min_lat, max_lat);
      CREATE INDEX idx_state ON districts(state_code);
    `);

    // Prepare insert statement
    const insert = db.prepare(`
      INSERT INTO districts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Read shapefile
    const shpPath = path.join(SCHOOLS_DIR, 'EDGE_SCHOOLDISTRICT_TL24_SY2324.shp');

    if (!fs.existsSync(shpPath)) {
      throw new Error(`Shapefile not found at ${shpPath}. Please download from NCES.`);
    }

    const source = await shapefile.open(shpPath);

    let count = 0;
    let skipped = 0;
    const batch = db.transaction((rows: (string | number | null)[][]) => {
      for (const row of rows) insert.run(...row);
    });

    const rows: (string | number | null)[][] = [];

    console.log('🔄 Processing districts...');

    while (true) {
      const { done, value } = await source.read();
      if (done) break;

      if (value?.geometry && value?.properties) {
        const props = value.properties as ShapefileProperties;

        // Skip if no GEOID
        if (!props.GEOID) {
          skipped++;
          continue;
        }

        try {
          // Calculate bounding box
          const bboxArray = bbox(value);
          const [minLng, minLat, maxLng, maxLat] = bboxArray;

          // Calculate center point
          const centerFeature = center(value);
          const [centerLng, centerLat] = centerFeature.geometry.coordinates;

          // Simplify geometry to reduce storage (tolerance in degrees)
          const simplified = simplify(value, { tolerance: 0.0001, highQuality: true });

          rows.push([
            props.GEOID,
            props.NAME || 'Unknown District',
            props.STATEFP || null,
            props.LOGRADE || null,
            props.HIGRADE || null,
            parseFloat(String(props.ALAND || 0)),
            parseFloat(String(props.AWATER || 0)),
            props.SCHOOLYEAR || '2023-2024',
            minLng,
            minLat,
            maxLng,
            maxLat,
            centerLng,
            centerLat,
            JSON.stringify(simplified.geometry),
          ]);

          count++;
          if (count % 100 === 0) {
            process.stdout.write(`\r   Processed ${count} districts...`);
          }
        } catch (error) {
          console.error(`Error processing district ${props.GEOID}:`, error);
          skipped++;
        }
      }
    }

    // Insert all rows in one transaction for speed
    console.log('\n💾 Inserting into database...');
    batch(rows);

    console.log(`✅ Imported ${count} districts`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} invalid records`);
    }

    // Create views for common queries
    db.exec(`
      CREATE VIEW district_summary AS
      SELECT 
        id,
        name,
        state_code,
        grade_lowest || '-' || grade_highest as grade_range,
        ROUND(land_area / 2589988.11, 2) as land_sq_miles,
        ROUND(water_area / 2589988.11, 2) as water_sq_miles
      FROM districts;
    `);

    // Optimize database
    console.log('🔧 Optimizing database...');
    db.exec('VACUUM');
    db.exec('ANALYZE');

    // Test query
    const test = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM districts 
      WHERE min_lng <= ? AND max_lng >= ? 
      AND min_lat <= ? AND max_lat >= ?
    `
      )
      .get(-71.0589, -71.0589, 42.3601, 42.3601) as { count: number };

    // Get database stats
    const stats = db.prepare('SELECT COUNT(*) as total FROM districts').get() as { total: number };
    const dbSize = fs.statSync(DB_PATH).size;

    console.log('\n' + '='.repeat(50));
    console.log('✅ Database created successfully!');
    console.log('='.repeat(50));
    console.log(`📍 Location: ${DB_PATH}`);
    console.log(`📊 Districts: ${stats.total}`);
    console.log(`💾 Size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🧪 Test query: Found ${test.count} district(s) near Boston`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('❌ Error creating database:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run if called directly
if (require.main === module) {
  createDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
