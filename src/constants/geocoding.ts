// Biases Google Geocoding results toward Mpumalanga, South Africa (this deployment's
// service area) without excluding matches elsewhere - `bounds` is a soft viewport bias,
// not a hard filter, so it also lets short-form Plus Codes (e.g. "9G8F+6X") resolve
// against a sensible reference location instead of failing with no results.
const MPUMALANGA_BOUNDS_SW = '-27.9,29.0';
const MPUMALANGA_BOUNDS_NE = '-24.7,32.2';

export const GEOCODING_BIAS_PARAMS = `&region=za&bounds=${MPUMALANGA_BOUNDS_SW}|${MPUMALANGA_BOUNDS_NE}`;

// Mapbox's bbox takes lon,lat corners (opposite axis order from Google's bounds above).
// No radius cap like the legacy Places API, so this covers the full Mpumalanga box.
const MAPBOX_BBOX = `29.0,-27.9,32.2,-24.7`;

export const MAPBOX_SEARCH_BIAS_PARAMS = `&bbox=${MAPBOX_BBOX}&country=za&autocomplete=true`;
