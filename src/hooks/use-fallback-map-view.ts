import { useMemo } from 'react';

import { type FallbackMapView, getFallbackMapView } from '@/lib/map-defaults';
import { useCallsStore } from '@/stores/calls/store';

/**
 * Where a map should open when the device location is unknown: the most recent
 * call, else the service area. Recomputes as calls stream in, so a map that
 * opened before the calls list loaded can slide over to the latest incident.
 */
export const useFallbackMapView = (): FallbackMapView => {
  const calls = useCallsStore((state) => state.calls);

  return useMemo(() => getFallbackMapView(calls), [calls]);
};
