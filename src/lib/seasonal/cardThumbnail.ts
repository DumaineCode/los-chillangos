import type { Tour } from '../../payload-types';

import { resolveMediaUrl } from './resolveMediaUrl';

/**
 * Pick the thumbnail URL for a tour's home-grid card.
 *
 * Priority:
 *   1. `heroImage` — the standard hero (applies to every tour).
 *   2. `seasonal.seasonalHero.image` — seasonal still, only for seasonal tours.
 *   3. `seasonal.seasonalHero.poster` — covers the seasonal-video case (the
 *      video itself is NEVER used in the grid; the poster is its still).
 *   4. `null` — caller keeps the gray placeholder block.
 *
 * Non-seasonal tours NEVER read seasonal media. Pure and deterministic.
 */
export function selectCardThumbnailUrl(tour: Tour): string | null {
  const heroUrl = resolveMediaUrl(tour.heroImage);
  if (heroUrl) return heroUrl;

  if (tour.isSeasonal === true) {
    const seasonalHero = tour.seasonal?.seasonalHero;
    return resolveMediaUrl(seasonalHero?.image) ?? resolveMediaUrl(seasonalHero?.poster);
  }

  return null;
}
