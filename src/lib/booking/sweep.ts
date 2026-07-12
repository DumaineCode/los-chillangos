import type { Payload } from 'payload';

/** Collections that carry an expiring `pending` hold governed by `holdExpiresAt`. */
export type SweepableCollection = 'bookings' | 'rentals';

/**
 * Bulk sweep of expired holds for a single collection.
 *
 * A `pending` row carries `holdExpiresAt`. When that timestamp lapses without
 * payment, the row should flip to `expired` so it no longer LOOKS live in the
 * admin. This is a LABEL reconciliation only — capacity reads already treat a
 * lapsed-but-unswept `pending` hold as FREE via the `holdExpiresAt > now`
 * predicate, so the sweep has NO capacity effect (AC28).
 *
 * Owned by the Vercel cron at `/api/cron/sweep-bookings`.
 */
export async function sweepHoldsForCollection(
  payload: Payload,
  collection: SweepableCollection,
  now: Date = new Date()
): Promise<{ swept: number }> {
  const result = await payload.update({
    collection,
    where: {
      and: [
        { status: { equals: 'pending' } },
        { holdExpiresAt: { less_than: now.toISOString() } },
      ],
    },
    data: { status: 'expired' },
    overrideAccess: true,
  });
  const docs = (result as { docs?: unknown[] }).docs ?? [];
  return { swept: docs.length };
}

/** Sweep expired tour-booking holds (back-compat wrapper). */
export async function sweepExpiredHolds(
  payload: Payload,
  now: Date = new Date()
): Promise<{ swept: number }> {
  return sweepHoldsForCollection(payload, 'bookings', now);
}

/** Sweep expired standalone-rental holds (AC27). */
export async function sweepExpiredRentalHolds(
  payload: Payload,
  now: Date = new Date()
): Promise<{ swept: number }> {
  return sweepHoldsForCollection(payload, 'rentals', now);
}
