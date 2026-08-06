import { SERVICE_AREA_BOUNDS } from '@/constants/geocoding';
import { isCallActive } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';

/**
 * Where maps open when we have nothing better to show: [longitude, latitude] of
 * Mbombela (Nelspruit), Mpumalanga - this deployment's service area. Sits inside
 * the geocoding bias box in `@/constants/geocoding`, so search and the map agree
 * on where "here" is.
 */
export const DEFAULT_MAP_CENTER: [number, number] = [30.9694, -25.4753];

/** Regional view, wide enough to cover the Mpumalanga service area. */
export const DEFAULT_MAP_ZOOM = 8;

/** Zoom used once we can point the map at a real place (the user, or a call). */
export const KNOWN_LOCATION_ZOOM = 12;

export interface FallbackMapView {
  center: [number, number];
  zoom: number;
  /** What the center came from - `call` means we're looking at real incident, not a guess. */
  source: 'call' | 'default';
}

const parseCoordinate = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Pulls [longitude, latitude] off a call, falling back to its "lat,lng"
 * Geolocation string. Treats 0,0 as missing - it's what the API sends for calls
 * that were never geocoded, and it would drop the map in the Atlantic.
 */
export const getCallCoordinate = (call: CallResultData | null | undefined): [number, number] | null => {
  if (!call) return null;

  const latitude = parseCoordinate(call.Latitude);
  const longitude = parseCoordinate(call.Longitude);
  if (latitude !== null && longitude !== null && (latitude !== 0 || longitude !== 0)) {
    return [longitude, latitude];
  }

  const [geoLatitude, geoLongitude] = (call.Geolocation ?? '').split(',');
  const parsedGeoLatitude = parseCoordinate(geoLatitude?.trim());
  const parsedGeoLongitude = parseCoordinate(geoLongitude?.trim());
  if (parsedGeoLatitude !== null && parsedGeoLongitude !== null && (parsedGeoLatitude !== 0 || parsedGeoLongitude !== 0)) {
    return [parsedGeoLongitude, parsedGeoLatitude];
  }

  return null;
};

const getLoggedOnTime = (call: CallResultData): number => {
  const timestamp = Date.parse(call.LoggedOnUtc || call.LoggedOn || '');
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

const byMostRecentlyLogged = (a: CallResultData, b: CallResultData): number => getLoggedOnTime(b) - getLoggedOnTime(a);

/**
 * Coordinate of the most recently logged call, preferring calls that are still
 * active - a dispatcher cares about where the work is. Returns null when no call
 * carries usable coordinates.
 */
export const getLastCallCoordinate = (calls: CallResultData[] | null | undefined): [number, number] | null => {
  if (!calls?.length) return null;

  const locatable = calls.filter((call) => getCallCoordinate(call) !== null);
  if (locatable.length === 0) return null;

  const mostRecentActive = locatable.filter((call) => isCallActive(call.State)).sort(byMostRecentlyLogged)[0];
  const mostRecent = mostRecentActive ?? [...locatable].sort(byMostRecentlyLogged)[0];

  return getCallCoordinate(mostRecent);
};

/**
 * Whether a coordinate falls in the service area. Used to sanity-check centers
 * that come from the API: a department that never had its map center configured
 * reports the Resgrid stock one (Carson City, NV), and honoring that drops
 * dispatchers on the other side of the planet.
 */
export const isWithinServiceArea = (longitude: number, latitude: number): boolean =>
  longitude >= SERVICE_AREA_BOUNDS.west && longitude <= SERVICE_AREA_BOUNDS.east && latitude >= SERVICE_AREA_BOUNDS.south && latitude <= SERVICE_AREA_BOUNDS.north;

/** The view a map should open with when the device location is unknown. */
export const getFallbackMapView = (calls: CallResultData[] | null | undefined): FallbackMapView => {
  const lastCallCenter = getLastCallCoordinate(calls);

  return lastCallCenter ? { center: lastCallCenter, zoom: KNOWN_LOCATION_ZOOM, source: 'call' } : { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM, source: 'default' };
};
