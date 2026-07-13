/** A minimal gallery row: an `image` referenced by its media id. */
export type GalleryRow = { image: number };

/**
 * Prepend the former hero image id to a gallery as `gallery[0]` (the cover),
 * preserving the existing order of the remaining rows.
 *
 * Pure, order-preserving, and idempotent: when the gallery already starts with
 * the hero (`gallery[0].image === heroId`) the SAME array reference is returned
 * so the backfill migration can detect the no-op and skip the write.
 *
 * Deterministic: same input → same output, no side effects.
 */
export function prependHeroToGallery(heroId: number, gallery: GalleryRow[]): GalleryRow[] {
  if (gallery[0]?.image === heroId) return gallery; // already prepended → no-op
  return [{ image: heroId }, ...gallery];
}
