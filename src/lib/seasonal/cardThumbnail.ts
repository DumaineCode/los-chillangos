import { resolveMediaImage, type ResolvedImage } from '../media';
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

/**
 * Structured, focal-point-aware variant of {@link selectCardThumbnailUrl}.
 *
 * Same priority chain (heroImage → seasonal image → seasonal poster → null),
 * but returns the shared resolver's `{ url, objectPosition, alt }` so the card
 * can frame the thumbnail by its focal point. Pure and deterministic.
 */
export function selectCardThumbnail(tour: Tour): ResolvedImage | null {
  const hero = resolveMediaImage(tour.heroImage);
  if (hero) return hero;

  if (tour.isSeasonal === true) {
    const seasonalHero = tour.seasonal?.seasonalHero;
    return resolveMediaImage(seasonalHero?.image) ?? resolveMediaImage(seasonalHero?.poster);
  }

  return null;
}
