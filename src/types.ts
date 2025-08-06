import type { Polygon, MultiPolygon } from 'geojson';

export interface SchoolDistrict {
  districtId: string;
  name: string;
  geometry: Polygon | MultiPolygon;
}

export interface SchoolDistrictLookupResult {
  status: boolean;
  districtId: string | null;
  districtName: string | null;
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
  [key: string]: unknown;
}
