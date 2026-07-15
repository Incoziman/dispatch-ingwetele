import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { DEFAULT_CALL_DESCRIPTION_TYPE_MAP } from '@/constants/callDescriptionTypeMap';

let cachedMap: Record<string, string[]> | null = null;
let inFlight: Promise<Record<string, string[]>> | null = null;

function isValidMap(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every((v) => Array.isArray(v) && v.every((entry) => typeof entry === 'string'));
}

function loadCallDescriptionTypeMap(): Promise<Record<string, string[]>> {
  if (cachedMap) return Promise.resolve(cachedMap);
  if (!inFlight) {
    inFlight = fetch('/call-description-type-map.json')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('call-description-type-map.json not found'))))
      .then((data) => (isValidMap(data) ? data : Promise.reject(new Error('call-description-type-map.json has an invalid shape'))))
      .catch(() => DEFAULT_CALL_DESCRIPTION_TYPE_MAP)
      .then((map) => {
        cachedMap = map;
        return map;
      });
  }
  return inFlight;
}

// Loads the description->type map from /call-description-type-map.json at
// runtime so it can be edited/overridden on a deployed container without a
// rebuild (see public/call-description-type-map.json and nginx.conf's
// no-cache rule for it). Falls back to DEFAULT_CALL_DESCRIPTION_TYPE_MAP on
// native platforms or if the fetch/parse fails.
export function useCallDescriptionTypeMap(): Record<string, string[]> {
  const [map, setMap] = useState<Record<string, string[]>>(cachedMap ?? DEFAULT_CALL_DESCRIPTION_TYPE_MAP);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let isMounted = true;
    loadCallDescriptionTypeMap().then((loaded) => {
      if (isMounted) setMap(loaded);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return map;
}
