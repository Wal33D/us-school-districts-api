// School District lookup result type
export interface SchoolDistrictLookupResult {
  status: boolean;
  districtId: string | null;
  districtName: string | null;
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
  // Indicates if this is an approximation (nearest district)
  isApproximate?: boolean;
  // Distance to the district boundary in meters (when approximate)
  approximateDistance?: number;
}

// CLI types
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

export interface BatchResult extends SchoolDistrictLookupResult {
  index: number;
  coordinates?: { lat: number; lng: number };
  error?: string;
}
