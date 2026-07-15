import { type CallTypeResultData } from '@/models/v4/callTypes/callTypeResultData';

export const CALL_DESCRIPTION_OPTIONS = ['Fire', 'Drowning', 'Flood', 'Car Incident'] as const;

export const CALL_DESCRIPTION_TYPE_MAP: Record<string, string[]> = {
  Fire: ['Structure Fire'],
  Drowning: ['Drowning'],
  Flood: ['Flood', 'Chemical spill'],
  'Car Incident': ['Car Incident'],
};

// '', 'Other', and any legacy/unmapped description all fall through to the
// unfiltered list by design - this single rule covers "Other" and legacy
// edit data with no special-casing needed at the call sites.
export function getTypesForDescription(description: string, allTypes: CallTypeResultData[]): CallTypeResultData[] {
  const mappedNames = CALL_DESCRIPTION_TYPE_MAP[description];
  if (!mappedNames) return allTypes;
  const filtered = allTypes.filter((t) => mappedNames.includes(t.Name));
  return filtered.length > 0 ? filtered : allTypes;
}
