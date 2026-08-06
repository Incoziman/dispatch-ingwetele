import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getCallCoordinate, getFallbackMapView, getLastCallCoordinate, isWithinServiceArea, KNOWN_LOCATION_ZOOM } from '@/lib/map-defaults';
import { CallResultData } from '@/models/v4/calls/callResultData';

const makeCall = (overrides: Partial<CallResultData>): CallResultData => Object.assign(new CallResultData(), overrides);

describe('getCallCoordinate', () => {
  it('returns [longitude, latitude] from the Latitude/Longitude strings', () => {
    expect(getCallCoordinate(makeCall({ Latitude: '-25.4753', Longitude: '30.9694' }))).toEqual([30.9694, -25.4753]);
  });

  it('falls back to the "lat,lng" Geolocation string', () => {
    expect(getCallCoordinate(makeCall({ Geolocation: '-25.0956, 30.4553' }))).toEqual([30.4553, -25.0956]);
  });

  it('treats missing, unparseable and 0,0 coordinates as no coordinate', () => {
    expect(getCallCoordinate(makeCall({}))).toBeNull();
    expect(getCallCoordinate(makeCall({ Latitude: 'not-a-number', Longitude: '30.9694' }))).toBeNull();
    expect(getCallCoordinate(makeCall({ Latitude: '0', Longitude: '0' }))).toBeNull();
    expect(getCallCoordinate(null)).toBeNull();
  });
});

describe('getLastCallCoordinate', () => {
  it('returns the most recently logged call', () => {
    const calls = [
      makeCall({ CallId: 'old', State: 0, LoggedOnUtc: '2026-08-01T08:00:00Z', Latitude: '-25.1', Longitude: '30.1' }),
      makeCall({ CallId: 'new', State: 0, LoggedOnUtc: '2026-08-05T08:00:00Z', Latitude: '-25.2', Longitude: '30.2' }),
    ];

    expect(getLastCallCoordinate(calls)).toEqual([30.2, -25.2]);
  });

  it('prefers an active call over a more recent closed one', () => {
    const calls = [
      makeCall({ CallId: 'closed', State: 4, LoggedOnUtc: '2026-08-05T08:00:00Z', Latitude: '-25.9', Longitude: '30.9' }),
      makeCall({ CallId: 'active', State: 0, LoggedOnUtc: '2026-08-01T08:00:00Z', Latitude: '-25.3', Longitude: '30.3' }),
    ];

    expect(getLastCallCoordinate(calls)).toEqual([30.3, -25.3]);
  });

  it('skips calls that were never geocoded', () => {
    const calls = [
      makeCall({ CallId: 'no-coords', State: 0, LoggedOnUtc: '2026-08-05T08:00:00Z' }),
      makeCall({ CallId: 'located', State: 0, LoggedOnUtc: '2026-08-01T08:00:00Z', Latitude: '-25.4', Longitude: '30.4' }),
    ];

    expect(getLastCallCoordinate(calls)).toEqual([30.4, -25.4]);
  });

  it('returns null when there is nothing to point at', () => {
    expect(getLastCallCoordinate([])).toBeNull();
    expect(getLastCallCoordinate(undefined)).toBeNull();
    expect(getLastCallCoordinate([makeCall({ Latitude: '0', Longitude: '0' })])).toBeNull();
  });
});

describe('isWithinServiceArea', () => {
  it('accepts places inside Mpumalanga', () => {
    expect(isWithinServiceArea(...DEFAULT_MAP_CENTER)).toBe(true);
    expect(isWithinServiceArea(30.4553, -25.0956)).toBe(true); // Mashishing
  });

  it('rejects the Resgrid stock center and other far-away points', () => {
    expect(isWithinServiceArea(-119.7674, 39.1638)).toBe(false); // Carson City, NV
    expect(isWithinServiceArea(-98.5795, 39.8283)).toBe(false); // Center of the USA
    expect(isWithinServiceArea(18.4241, -33.9249)).toBe(false); // Cape Town
    expect(isWithinServiceArea(0, 0)).toBe(false);
  });
});

describe('getFallbackMapView', () => {
  it('opens on the last call when there is one', () => {
    const calls = [makeCall({ State: 0, LoggedOnUtc: '2026-08-05T08:00:00Z', Latitude: '-25.5', Longitude: '30.5' })];

    expect(getFallbackMapView(calls)).toEqual({ center: [30.5, -25.5], zoom: KNOWN_LOCATION_ZOOM, source: 'call' });
  });

  it('opens on the service area when there are no located calls', () => {
    expect(getFallbackMapView([])).toEqual({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM, source: 'default' });
  });

  it('defaults inside the Mpumalanga service area, not the US', () => {
    const [longitude, latitude] = DEFAULT_MAP_CENTER;

    expect(longitude).toBeGreaterThan(29);
    expect(longitude).toBeLessThan(32.2);
    expect(latitude).toBeGreaterThan(-27.9);
    expect(latitude).toBeLessThan(-24.7);
  });
});
