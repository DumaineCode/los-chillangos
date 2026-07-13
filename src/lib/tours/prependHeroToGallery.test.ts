import { describe, expect, it } from 'vitest';

import { prependHeroToGallery } from './prependHeroToGallery';

/**
 * Unit tests for the pure backfill transform used by the
 * `backfill_tour_hero_into_gallery` migration.
 *
 * The migration file itself is a thin DB shell (no live DB in vitest); the risky
 * order-preserving + idempotent logic lives here and IS unit-tested (AC2).
 */

describe('prependHeroToGallery', () => {
  it('prepends the hero at index 0 before existing items, preserving order', () => {
    const result = prependHeroToGallery(7, [{ image: 1 }, { image: 2 }]);
    expect(result).toEqual([{ image: 7 }, { image: 1 }, { image: 2 }]);
  });

  it('turns an empty gallery into a single-element result', () => {
    expect(prependHeroToGallery(7, [])).toEqual([{ image: 7 }]);
  });

  it('is idempotent when gallery[0].image already equals the hero id', () => {
    const gallery = [{ image: 7 }, { image: 1 }];
    const result = prependHeroToGallery(7, gallery);
    // Returns the same reference (no-op) so the migration can skip the write.
    expect(result).toBe(gallery);
    expect(result).toEqual([{ image: 7 }, { image: 1 }]);
  });

  it('prepends again when the hero exists later in the gallery but not at index 0', () => {
    const result = prependHeroToGallery(7, [{ image: 1 }, { image: 7 }]);
    expect(result).toEqual([{ image: 7 }, { image: 1 }, { image: 7 }]);
  });
});
