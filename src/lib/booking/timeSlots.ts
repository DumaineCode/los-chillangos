import type { Tour } from '../../payload-types';

/**
 * Static time-slot map by tour category (PR 5 locked decision).
 *
 * Future improvement: surface these from the Payload Tours collection (per-
 * tour slots) so the client can customize without code changes. For PR 5
 * we mirror the legacy hardcoded slots from `data.js`.
 */
const SLOTS_BY_CATEGORY: Record<Tour['category'], readonly string[]> = {
  ebike: ['09:00', '14:00'],
  walking: ['10:00', '16:00'],
  daytrip: ['07:00'],
  food: ['11:00', '15:00'],
};

const FALLBACK_SLOTS = ['09:00', '14:00'] as const;

export function getTimeSlotsForCategory(category: Tour['category'] | undefined): readonly string[] {
  if (!category) return FALLBACK_SLOTS;
  return SLOTS_BY_CATEGORY[category] ?? FALLBACK_SLOTS;
}
