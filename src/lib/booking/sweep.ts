import type { Payload } from 'payload';

/**
 * Bulk sweep of expired booking holds.
 *
 * Pending bookings carry a `holdExpiresAt`. When that timestamp lapses
 * without payment, the row should flip to `expired` so it no longer counts
 * against capacity. This helper performs that flip in bulk.
 *
 * Owned by the Vercel cron at `/api/cron/sweep-bookings` (Sub-etapa C).
 * Earlier (Sub-etapa B), this was called lazily on every capacity read,
 * which paid a write cost for every availability check. The cron decouples
 * sweep cadence (1 min) from read traffic.
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
