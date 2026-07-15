import { type CallTypeResultData } from '@/models/v4/callTypes/callTypeResultData';

// Baked-in fallback, used if /call-description-type-map.json can't be
// fetched at runtime (offline, native platforms, invalid override file, etc).
// See public/call-description-type-map.json for the editable runtime copy.
export const DEFAULT_CALL_DESCRIPTION_TYPE_MAP: Record<string, string[]> = {
  Fire: ['Structure Fire'],
  Drowning: ['Drowning'],
  Flood: ['Flood', 'Chemical spill'],
  'Car Incident': ['Car Incident'],
};

// '', 'Other', and any legacy/unmapped description all fall through to the
// unfiltered list by design - this single rule covers "Other" and legacy
// edit data with no special-casing needed at the call sites.
export function getTypesForDescription(description: string, allTypes: CallTypeResultData[], map: Record<string, string[]>): CallTypeResultData[] {
  const mappedNames = map[description];
  if (!mappedNames) return allTypes;
  const filtered = allTypes.filter((t) => mappedNames.includes(t.Name));
  return filtered.length > 0 ? filtered : allTypes;
}
