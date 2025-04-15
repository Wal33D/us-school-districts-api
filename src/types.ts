import type { Polygon, MultiPolygon } from 'geojson';

export interface SchoolDistrict {
    districtId: string;
    name: string;
    geometry: Polygon | MultiPolygon;
}

export interface SchoolDistrictLookupResult {
    status: boolean;
    districtId?: string;
    districtName?: string;
}