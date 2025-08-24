#!/usr/bin/env node

/**
 * Verify shapefile integrity and completeness
 * Run this to check if the shapefile has all states and districts
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const SCHOOLS_DIR = path.join(__dirname, 'school_district_data');
const DB_PATH = path.join(SCHOOLS_DIR, 'districts.db');
const SHP_PATH = path.join(SCHOOLS_DIR, 'EDGE_SCHOOLDISTRICT_TL24_SY2324.shp');
const DBF_PATH = path.join(SCHOOLS_DIR, 'EDGE_SCHOOLDISTRICT_TL24_SY2324.dbf');

console.log('🔍 School Districts Verification Report');
console.log('='.repeat(60));

// Check shapefile existence and size
console.log('\n📁 Shapefile Status:');
if (fs.existsSync(SHP_PATH)) {
  const shpStats = fs.statSync(SHP_PATH);
  const shpSizeMB = (shpStats.size / 1024 / 1024).toFixed(2);
  console.log(`  ✓ .shp file exists: ${shpSizeMB} MB`);

  // Expected size is around 298MB for complete file
  if (shpStats.size < 200 * 1024 * 1024) {
    console.log(`  ⚠️  WARNING: File seems too small! Expected ~298MB`);
  }
} else {
  console.log('  ✗ .shp file NOT FOUND');
}

if (fs.existsSync(DBF_PATH)) {
  const dbfStats = fs.statSync(DBF_PATH);
  const dbfSizeMB = (dbfStats.size / 1024 / 1024).toFixed(2);
  console.log(`  ✓ .dbf file exists: ${dbfSizeMB} MB`);

  // Expected size is around 2.8MB for complete file
  if (dbfStats.size < 2 * 1024 * 1024) {
    console.log(`  ⚠️  WARNING: DBF file seems too small! Expected ~2.8MB`);
  }
} else {
  console.log('  ✗ .dbf file NOT FOUND');
}

// Check database
console.log('\n📊 Database Status:');
if (fs.existsSync(DB_PATH)) {
  const dbStats = fs.statSync(DB_PATH);
  const dbSizeMB = (dbStats.size / 1024 / 1024).toFixed(2);
  console.log(`  ✓ Database exists: ${dbSizeMB} MB`);

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Count total districts
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM districts').get();
    console.log(`  Total districts: ${totalCount.count}`);

    // Count by state
    const stateCount = db
      .prepare('SELECT COUNT(DISTINCT state_code) as count FROM districts')
      .get();
    console.log(`  Unique states: ${stateCount.count}`);

    // Check for Michigan specifically (state code 26)
    const michiganCount = db
      .prepare('SELECT COUNT(*) as count FROM districts WHERE state_code = ?')
      .get('26');
    console.log(`  Michigan districts: ${michiganCount.count}`);

    // List all states with counts
    console.log('\n📍 Districts by State:');
    const states = db
      .prepare(
        `
      SELECT state_code, COUNT(*) as count 
      FROM districts 
      GROUP BY state_code 
      ORDER BY state_code
    `
      )
      .all();

    const stateNames = {
      '01': 'AL',
      '02': 'AK',
      '04': 'AZ',
      '05': 'AR',
      '06': 'CA',
      '08': 'CO',
      '09': 'CT',
      10: 'DE',
      11: 'DC',
      12: 'FL',
      13: 'GA',
      15: 'HI',
      16: 'ID',
      17: 'IL',
      18: 'IN',
      19: 'IA',
      20: 'KS',
      21: 'KY',
      22: 'LA',
      23: 'ME',
      24: 'MD',
      25: 'MA',
      26: 'MI',
      27: 'MN',
      28: 'MS',
      29: 'MO',
      30: 'MT',
      31: 'NE',
      32: 'NV',
      33: 'NH',
      34: 'NJ',
      35: 'NM',
      36: 'NY',
      37: 'NC',
      38: 'ND',
      39: 'OH',
      40: 'OK',
      41: 'OR',
      42: 'PA',
      44: 'RI',
      45: 'SC',
      46: 'SD',
      47: 'TN',
      48: 'TX',
      49: 'UT',
      50: 'VT',
      51: 'VA',
      53: 'WA',
      54: 'WV',
      55: 'WI',
      56: 'WY',
    };

    let missingStates = [];
    for (const [code, name] of Object.entries(stateNames)) {
      const state = states.find(s => s.state_code === code);
      if (state) {
        console.log(`  ${code} (${name}): ${state.count} districts`);
      } else {
        missingStates.push(`${code} (${name})`);
      }
    }

    if (missingStates.length > 0) {
      console.log('\n⚠️  MISSING STATES:');
      missingStates.forEach(state => console.log(`  - ${state}`));
    }

    db.close();

    // Summary
    console.log('\n📋 Summary:');
    if (totalCount.count < 13000) {
      console.log('  ❌ Database appears INCOMPLETE');
      console.log('  Expected: ~13,382 districts from 56 states/territories');
      console.log(`  Found: ${totalCount.count} districts from ${stateCount.count} states`);
      console.log('\n  ACTION REQUIRED: Download complete shapefile from NCES');
      console.log('  https://nces.ed.gov/programs/edge/Geographic/DistrictBoundaries');
    } else {
      console.log('  ✅ Database appears COMPLETE');
      console.log(`  ${totalCount.count} districts from ${stateCount.count} states/territories`);
    }
  } catch (error) {
    console.log(`  ✗ Error reading database: ${error.message}`);
  }
} else {
  console.log('  ✗ Database NOT FOUND');
  console.log('  Run: npm run setup-database');
}
