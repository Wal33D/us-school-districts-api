#!/usr/bin/env node

import { Command } from 'commander';
import fetch from 'node-fetch';
import { config } from './config';

const program = new Command();

program
  .name('school-district-cli')
  .description('CLI tool for testing US School Districts API')
  .version('1.0.0');

program
  .command('lookup')
  .description('Look up a school district by coordinates')
  .option('--lat, --latitude <number>', 'Latitude coordinate')
  .option('--lng, --longitude <number>', 'Longitude coordinate')
  .option('--host <string>', 'API host', `http://localhost:${config.port}`)
  .action(async (options: any) => {
    if (!options.latitude || !options.longitude) {
      console.error('Error: Both --latitude and --longitude are required');
      process.exit(1);
    }
    try {
      const lat = parseFloat(options.latitude);
      const lng = parseFloat(options.longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        console.error('Error: Latitude and longitude must be valid numbers');
        process.exit(1);
      }
      
      console.log(`Looking up school district for: ${lat}, ${lng}`);
      console.log(`Using API at: ${options.host}`);
      
      const response = await fetch(`${options.host}/school-district?lat=${lat}&lng=${lng}`);
      const data = await response.json();
      
      console.log('\nResult:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.status) {
        console.log(`\n✓ Found district: ${data.districtName} (ID: ${data.districtId})`);
      } else {
        console.log('\n✗ No district found at these coordinates');
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Look up multiple school districts from a JSON file')
  .option('-f, --file <path>', 'Path to JSON file with coordinates array')
  .option('--host <string>', 'API host', `http://localhost:${config.port}`)
  .action(async (options: any) => {
    if (!options.file) {
      console.error('Error: --file is required');
      process.exit(1);
    }
    try {
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(options.file, 'utf-8');
      const coordinates = JSON.parse(fileContent);
      
      if (!Array.isArray(coordinates)) {
        console.error('Error: File must contain a JSON array of coordinate objects');
        console.error('Example: [{"lat": 40.7128, "lng": -74.0060}, {"lat": 34.0522, "lng": -118.2437}]');
        process.exit(1);
      }
      
      console.log(`Processing ${coordinates.length} coordinates...`);
      console.log(`Using API at: ${options.host}`);
      
      const response = await fetch(`${options.host}/school-districts/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(coordinates),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error:', data.error || 'Unknown error');
        process.exit(1);
      }
      
      console.log(`\nProcessed ${data.count} coordinates:`);
      
      data.results.forEach((result: any) => {
        if (result.status) {
          console.log(`  [${result.index}] ✓ ${result.districtName} (${result.districtId}) - ${result.coordinates.lat}, ${result.coordinates.lng}`);
        } else {
          console.log(`  [${result.index}] ✗ No district found - ${result.error || 'Unknown location'}`);
        }
      });
      
      const successful = data.results.filter((r: any) => r.status).length;
      console.log(`\nSummary: ${successful}/${data.count} successful lookups`);
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Run a quick test with sample coordinates')
  .option('--host <string>', 'API host', `http://localhost:${config.port}`)
  .action(async (options: any) => {
    console.log('Running test with sample US coordinates...\n');
    
    const testCoordinates = [
      { name: 'New York City', lat: 40.7128, lng: -74.0060 },
      { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
      { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
      { name: 'Houston', lat: 29.7604, lng: -95.3698 },
      { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
    ];
    
    for (const coord of testCoordinates) {
      try {
        const response = await fetch(`${options.host}/school-district?lat=${coord.lat}&lng=${coord.lng}`);
        const data = await response.json();
        
        if (data.status) {
          console.log(`✓ ${coord.name}: ${data.districtName} (${data.districtId})`);
        } else {
          console.log(`✗ ${coord.name}: No district found`);
        }
      } catch (error) {
        console.log(`✗ ${coord.name}: Error - ${error}`);
      }
    }
  });

program
  .command('health')
  .description('Check if the API is running')
  .option('--host <string>', 'API host', `http://localhost:${config.port}`)
  .action(async (options: any) => {
    try {
      console.log(`Checking API health at: ${options.host}`);
      const response = await fetch(`${options.host}/health`);
      const data = await response.json();
      
      if (response.ok && data.status === 'ok') {
        console.log('✓ API is healthy and running');
      } else {
        console.log('✗ API health check failed');
        process.exit(1);
      }
    } catch (error) {
      console.log('✗ Could not connect to API');
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);