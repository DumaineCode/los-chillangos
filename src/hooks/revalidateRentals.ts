import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Payload `afterChange` hook for the Rentals collection.
 *
 * Invalidates the `rentals` cache tag (used by `unstable_cache`-wrapped Local
 * API reads in the public pages) and the per-locale Rental Detail path so the
 * next request rebuilds the affected RSC. Mirrors `revalidateTours`.
 *
 * Hooks fire both for create/update and for publish/draft transitions. Each
 * invalidation is best-effort: if the call happens outside of a Next request
 * context (e.g. seeding from the CLI), the calls are silent no-ops.
 */
export const revalidateRentalsAfterChange: CollectionAfterChangeHook = ({ doc, req }) => {
  try {
    revalidateTag('rentals');
    if (doc?.slug) {
      revalidateTag(`rental:${doc.slug}`);
      revalidatePath(`/[locale]/rentals/${doc.slug}`, 'page');
    }
    revalidatePath('/[locale]', 'page');
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateRentals/afterChange] revalidation skipped (likely outside request context)'
    );
  }
  return doc;
};

export const revalidateRentalsAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  try {
    revalidateTag('rentals');
    if (doc?.slug) {
      revalidateTag(`rental:${doc.slug}`);
    }
    revalidatePath('/[locale]', 'page');
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateRentals/afterDelete] revalidation skipped (likely outside request context)'
    );
  }
  return doc;
};
