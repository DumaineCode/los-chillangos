import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';
import { revalidateTag } from 'next/cache';

/**
 * Payload `afterChange` / `afterDelete` hooks for the Extras collection.
 *
 * Extras are assigned to tours via a `hasMany` relationship and surfaced on
 * every tour detail/booking page that references them. Editing an extra's
 * name, price or disclaimer therefore affects the public output of an unknown
 * set of tours, so we invalidate the global `tours` cache tag and let the next
 * request rebuild whichever pages reference the changed extra.
 *
 * We do NOT attempt to resolve which tours reference the extra (that would be a
 * reverse-relationship query on every write); invalidating the `tours` tag is
 * the cheap, correct superset. Each call is best-effort: if the hook fires
 * outside a Next request context (CLI/seed), revalidateTag is a silent no-op.
 */
export const revalidateExtrasAfterChange: CollectionAfterChangeHook = ({ doc, req }) => {
  try {
    revalidateTag('tours');
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateExtras/afterChange] revalidation skipped (likely outside request context)'
    );
  }
  return doc;
};

export const revalidateExtrasAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  try {
    revalidateTag('tours');
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateExtras/afterDelete] revalidation skipped (likely outside request context)'
    );
  }
  return doc;
};
