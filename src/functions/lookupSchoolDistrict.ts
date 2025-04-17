/**
 * src/functions/lookupSchoolDistrict.ts
 *
 * This module provides a function to lookup the school district that contains
 * a given latitude/longitude coordinate. It uses the in-memory district cache loaded
 * by the school-district-cache module and Turf’s booleanPointInPolygon for spatial tests.
 */

import { districtsCache } from '../lib/school-district-cache';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { SchoolDistrictLookupResult } from '../types';

/**
 * Looks up the school district that contains the provided coordinates.
 *
 * @param param0 - An object with latitude and longitude values.
 * @returns A SchoolDistrictLookupResult indicating whether a match was found.
 */
export const lookupSchoolDistrict = ({
    lat,
    lng
}: {
    lat: number;
    lng: number;
}): SchoolDistrictLookupResult => {
    let result: SchoolDistrictLookupResult = {
        status: false,
        districtId: null,
        districtName: null
    };

    if (!districtsCache) {
        console.error(
            "District cache is empty. Ensure that loadDistrictsIntoCache() has been called on startup."
        );
    } else {
        const pt = point([lng, lat]); // [longitude, latitude]
        for (const district of districtsCache) {
            if (booleanPointInPolygon(pt, district.geometry)) {
                result = {
                    status: true,
                    districtId: district.districtId,
                    districtName: district.name
                };
                break;
            }
        }
    }

    return result;
};
