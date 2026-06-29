import { afterEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { revalidateRentalsAfterChange, revalidateRentalsAfterDelete } from './revalidateRentals';

/**
 * revalidateRentals — afterChange/afterDelete cache invalidation for Rentals.
 *
 * Mirrors revalidateTours: invalidates the collection-wide `rentals` tag, the
 * per-slug `rental:<slug>` tag, the localized detail path, and the localized
 * home path so the next request rebuilds the affected RSC.
 */
describe('revalidateRentals', () => {
  afterEach(() => {
    revalidateTag.mockClear();
    revalidatePath.mockClear();
  });

  const req = { payload: { logger: { warn: vi.fn() } } } as never;

  describe('afterChange', () => {
    it('invalidates the rentals tag, the per-slug tag, and the locale + detail paths', () => {
      const doc = { slug: 'urban-cruiser' };
      const result = revalidateRentalsAfterChange({ doc, req } as never);

      expect(revalidateTag).toHaveBeenCalledWith('rentals');
      expect(revalidateTag).toHaveBeenCalledWith('rental:urban-cruiser');
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/rentals/urban-cruiser', 'page');
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
      expect(result).toBe(doc);
    });

    it('skips the per-slug invalidation when the doc has no slug', () => {
      const doc = {};
      revalidateRentalsAfterChange({ doc, req } as never);

      expect(revalidateTag).toHaveBeenCalledWith('rentals');
      expect(revalidateTag).not.toHaveBeenCalledWith('rental:undefined');
      expect(revalidatePath).not.toHaveBeenCalledWith(
        '/[locale]/rentals/undefined',
        'page'
      );
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
    });
  });

  describe('afterDelete', () => {
    it('invalidates the rentals tag, the per-slug tag, and the locale path', () => {
      const doc = { slug: 'mountain-e' };
      const result = revalidateRentalsAfterDelete({ doc, req } as never);

      expect(revalidateTag).toHaveBeenCalledWith('rentals');
      expect(revalidateTag).toHaveBeenCalledWith('rental:mountain-e');
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
      expect(result).toBe(doc);
    });

    it('skips the per-slug tag when the deleted doc has no slug', () => {
      revalidateRentalsAfterDelete({ doc: {}, req } as never);

      expect(revalidateTag).toHaveBeenCalledWith('rentals');
      expect(revalidateTag).not.toHaveBeenCalledWith('rental:undefined');
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
    });
  });
});
