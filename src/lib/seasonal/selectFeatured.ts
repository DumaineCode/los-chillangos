import type { SeasonalFeature, Tour } from '../../payload-types';

/**
 * Pure resolution of the active seasonal tour.
 *
 * Given the `seasonalFeature` global and a map of tours keyed by id, decide
 * which tour (if any) should be featured. A tour qualifies only when ALL hold:
 *   - the feature is `enabled`
 *   - `featuredSeasonalTour` references a tour present in the map
 *   - that tour is `_status: 'published'`
 *   - that tour has `isSeasonal: true`
 *
 * Returns the resolved tour, or `null` when no tour qualifies. Side-effect free
 * and deterministic so it can be unit-tested without Payload.
 */
export function selectFeatured(
  global: SeasonalFeature | null | undefined,
  toursById: Map<number, Tour>
): Tour | null {
  if (!global?.enabled) return null;

  const ref = global.featuredSeasonalTour;
  const id = typeof ref === 'number' ? ref : (ref?.id ?? null);
  if (id == null) return null;

  const tour = toursById.get(id);
  if (!tour) return null;

  if (tour._status !== 'published') return null;
  if (!tour.isSeasonal) return null;

  return tour;
}
