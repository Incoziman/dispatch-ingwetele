// The service area this deployment covers: Mpumalanga, South Africa. One box,
// used to bias address search and to decide where maps open (see
// `@/lib/map-defaults`), so search and the map agree on where "here" is.
export const SERVICE_AREA_BOUNDS = {
  south: -27.9,
  west: 29.0,
  north: -24.7,
  east: 32.2,
} as const;

const coordinate = (value: number): string => value.toFixed(1);

// Biases Google Geocoding results toward Mpumalanga without excluding matches
// elsewhere - `bounds` is a soft viewport bias, not a hard filter, so it also
// lets short-form Plus Codes (e.g. "9G8F+6X") resolve against a sensible
// reference location instead of failing with no results.
const MPUMALANGA_BOUNDS_SW = `${coordinate(SERVICE_AREA_BOUNDS.south)},${coordinate(SERVICE_AREA_BOUNDS.west)}`;
const MPUMALANGA_BOUNDS_NE = `${coordinate(SERVICE_AREA_BOUNDS.north)},${coordinate(SERVICE_AREA_BOUNDS.east)}`;

export const GEOCODING_BIAS_PARAMS = `&region=za&bounds=${MPUMALANGA_BOUNDS_SW}|${MPUMALANGA_BOUNDS_NE}`;

// Mapbox's bbox takes lon,lat corners (opposite axis order from Google's bounds above).
// No radius cap like the legacy Places API, so this covers the full Mpumalanga box.
const MAPBOX_BBOX = `${coordinate(SERVICE_AREA_BOUNDS.west)},${coordinate(SERVICE_AREA_BOUNDS.south)},${coordinate(SERVICE_AREA_BOUNDS.east)},${coordinate(SERVICE_AREA_BOUNDS.north)}`;

export const MAPBOX_SEARCH_BIAS_PARAMS = `&bbox=${MAPBOX_BBOX}&country=za&autocomplete=true`;
