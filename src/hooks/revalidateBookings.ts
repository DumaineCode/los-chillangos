import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Payload `afterChange` / `afterDelete` hooks for the Bookings collection.
 *
 * A booking change (create, status flip, cancellation) affects the public
 * availability shown on the linked tour's detail/booking page. We invalidate:
 *   - the global `tours` tag (any list that aggregates availability),
 *   - the per-slug `tour:<slug>` tag and the `/[locale]/tours/<slug>` path
 *     when we can resolve the tour slug.
 *
 * The `tour` relationship may arrive as a numeric ID (the Payload default for
 * postgres) or as a populated object depending on the depth setting at write
 * time. We handle both. If we only have an ID, we look up the slug via the
 * Local API — best-effort, wrapped in try/catch.
 *
 * All revalidation calls are best-effort: if the hook fires outside a Next
 * request context (e.g. a CLI sweep job in Sub-etapa B), revalidate* throws
 * silently and we log a warning.
 */

type BookingDocLike = {
  tour?: number | string | { id?: number | string; slug?: string } | null;
};

async function resolveSlug(doc: BookingDocLike, req: Parameters<CollectionAfterChangeHook>[0]['req']): Promise<string | null> {
  const t = doc?.tour;
  if (!t) return null;

  if (typeof t === 'object') {
    if (typeof t.slug === 'string' && t.slug.length > 0) return t.slug;
    const id = t.id;
    if (id === undefined || id === null) return null;
    return lookupSlug(req, id);
  }

  return lookupSlug(req, t);
}

async function lookupSlug(
  req: Parameters<CollectionAfterChangeHook>[0]['req'],
  id: number | string,
): Promise<string | null> {
  try {
    const tour = await req.payload.findByID({ collection: 'tours', id, depth: 0 });
    return typeof tour?.slug === 'string' ? tour.slug : null;
  } catch {
    return null;
  }
}

export const revalidateBookingsAfterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    revalidateTag('tours');
    const slug = await resolveSlug(doc as BookingDocLike, req);
    if (slug) {
      revalidateTag(`tour:${slug}`);
      revalidatePath(`/[locale]/tours/${slug}`, 'page');
    }
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateBookings/afterChange] revalidation skipped (likely outside request context)',
    );
  }
  return doc;
};

export const revalidateBookingsAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    revalidateTag('tours');
    const slug = await resolveSlug(doc as BookingDocLike, req);
    if (slug) {
      revalidateTag(`tour:${slug}`);
    }
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateBookings/afterDelete] revalidation skipped (likely outside request context)',
    );
  }
  return doc;
};
