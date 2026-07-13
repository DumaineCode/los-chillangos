import { resolveMediaImage, type ResolvedImage } from '../media';
import type { Tour } from '../../payload-types';

/**
 * Pick the focal-point-aware thumbnail for a tour's home-grid card.
 *
 * Priority:
 *   1. `gallery[0].image` — the standard cover (position 0 of the single ordered
 *      gallery; applies to every standard tour).
 *   2. `seasonal.seasonalHero.image` — seasonal still, only for seasonal tours.
 *   3. `seasonal.seasonalHero.poster` — covers the seasonal-video case (the
 *      video itself is NEVER used in the grid; the poster is its still).
 *   4. `null` — caller keeps the gray placeholder block.
 *
 * Returns the shared resolver's `{ url, objectPosition, alt }` so the card can
 * frame the thumbnail by its focal point. Non-seasonal tours NEVER read
 * seasonal media. Pure and deterministic.
 */
export function selectCardThumbnail(tour: Tour): ResolvedImage | null {
  // Position 0 of the standard gallery is the cover. Null-safe for empty/undefined
  // galleries: `tour.gallery?.[0]?.image` yields `undefined` → resolver returns null.
  const cover = resolveMediaImage(tour.gallery?.[0]?.image);
  if (cover) return cover;

  if (tour.isSeasonal === true) {
    const seasonalHero = tour.seasonal?.seasonalHero;
    return resolveMediaImage(seasonalHero?.image) ?? resolveMediaImage(seasonalHero?.poster);
  }

  return null;
}
