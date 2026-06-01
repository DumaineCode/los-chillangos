import type { Payload } from 'payload';

/**
 * Lazy sweep of expired booking holds (Sub-etapa B).
 *
 * Pending bookings carry a `holdExpiresAt`. When that timestamp lapses
 * without payment, the row should flip to `expired` so it no longer counts
 * against capacity. This helper performs that flip in bulk.
 *
 * TODO Sub-etapa C: replace this lazy call with a Vercel cron at
 * `/api/cron/sweep-bookings` so we don't pay sweep cost on every read.
 */
export async function sweepExpiredHolds(
  payload: Payload,
  now: Date = new Date()
): Promise<{ swept: number }> {
  const result = await payload.update({
    collection: 'bookings',
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
