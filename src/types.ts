import type { Polygon, MultiPolygon } from 'geojson';

// School District types
export interface SchoolDistrict {
  districtId: string;
  name: string;
  geometry: Polygon | MultiPolygon;
}

export interface SchoolDistrictLookupResult {
  status: boolean;
  districtId: string | null;
  districtName: string | null;
  // Priority fields for real estate applications
  gradeRange?: {
    lowest: string;
    highest: string;
  };
  area?: {
    landSqMiles: number;
    waterSqMiles: number;
  };
  schoolYear?: string;
  stateCode?: string;
}

export interface SchoolDistrictLookupResultWithCoordinates extends SchoolDistrictLookupResult {
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface SchoolDistrictFeatureProperties {
  GEOID: string;
  NAME: string;
  LOGRADE?: string;
  HIGRADE?: string;
  ALAND?: number;
  AWATER?: number;
  SCHOOLYEAR?: string;
  STATEFP?: string;
  [key: string]: unknown;
}

// Stored properties for each district (memory-efficient)
export interface DistrictProperties {
  gradeLowest: string | null;
  gradeHighest: string | null;
  landAreaSqMeters: number;
  waterAreaSqMeters: number;
  schoolYear: string | null;
  stateCode: string | null;
}

// Spatial indexing types (from server.ts)
export type DistrictMetadata = {
  districtId: string;
  name: string;
  recordIndex: number;
};

export type IndexedDistrict = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  metadata: DistrictMetadata;
};

// CLI types (from cli.ts)
export interface LookupOptions {
  latitude?: string;
  longitude?: string;
  host: string;
}

export interface BatchOptions {
  file?: string;
  host: string;
}

export interface TestOptions {
  host: string;
}

export interface HealthOptions {
  host: string;
}

export interface BatchResult {
  index: number;
  status: boolean;
  districtName?: string;
  districtId?: string;
  error?: string;
  coordinates?: { lat: number; lng: number };
}
