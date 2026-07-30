import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Payload `afterChange` hook for the Tours collection.
 *
 * Invalidates the `tours` cache tag (used by `unstable_cache`-wrapped Local
 * API reads in the public pages) and the per-locale Tour Detail path so the
 * next request rebuilds the affected RSC.
 *
 * Hooks fire both for create/update and for publish/draft transitions. Each
 * invalidation is best-effort: if the call happens outside of a Next request
 * context (e.g. seeding from the CLI), the calls are silent no-ops.
 */
export const revalidateToursAfterChange: CollectionAfterChangeHook = ({ doc, req }) => {
  try {
    revalidateTag('tours');
    if (doc?.slug) {
      revalidateTag(`tour:${doc.slug}`);
      // Dynamic routes must be revalidated with the ROUTE PATTERN, not a mix
      // of placeholder + concrete slug (`/[locale]/tours/${slug}` matches
      // nothing and silently no-ops). The per-slug `tour:${slug}` tag above
      // keeps the data-cache invalidation scoped to this tour.
      revalidatePath('/[locale]/tours/[slug]', 'page');
    }
    revalidatePath('/[locale]', 'page');
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateTours/afterChange] revalidation skipped (likely outside request context)'
    );
  }
  return doc;
};

export const revalidateToursAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  try {
    revalidateTag('tours');
    if (doc?.slug) {
      revalidateTag(`tour:${doc.slug}`);
    }
    revalidatePath('/[locale]', 'page');
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateTours/afterDelete] revalidation skipped (likely outside request context)'
    );
  }
  return doc;
};
