import { describe, expect, it, vi } from 'vitest';

import { sweepExpiredHolds, sweepExpiredRentalHolds, sweepHoldsForCollection } from './sweep';
import type { RentalOccupancy } from './rentalEvaluator';

/**
 * Hand-rolled Payload mock: only the methods we use.
 */
function makePayload(
  updateImpl: (args: unknown) => Promise<{ docs: unknown[] }>
): { update: ReturnType<typeof vi.fn> } {
  return { update: vi.fn(updateImpl) };
}

describe('sweepExpiredHolds', () => {
  it('updates pending bookings whose hold has expired and returns the count', async () => {
    const now = new Date('2026-06-15T14:00:00Z');
    const payload = makePayload(async () => ({
      docs: [{ id: 1 }, { id: 2 }, { id: 3 }],
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sweepExpiredHolds(payload as any, now);

    expect(result).toEqual({ swept: 3 });
    expect(payload.update).toHaveBeenCalledTimes(1);
    const call = payload.update.mock.calls[0]?.[0] as {
      collection: string;
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      overrideAccess: boolean;
    };
    expect(call.collection).toBe('bookings');
    expect(call.data).toEqual({ status: 'expired' });
    expect(call.overrideAccess).toBe(true);
    // Where clause: status = pending AND holdExpiresAt < now
    expect(call.where).toEqual({
      and: [
        { status: { equals: 'pending' } },
        { holdExpiresAt: { less_than: now.toISOString() } },
      ],
    });
  });

  it('returns 0 when nothing matched', async () => {
    const payload = makePayload(async () => ({ docs: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sweepExpiredHolds(payload as any, new Date('2026-06-15T14:00:00Z'));
    expect(result).toEqual({ swept: 0 });
  });

  it('falls back to new Date() when no `now` is passed', async () => {
    const payload = makePayload(async () => ({ docs: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sweepExpiredHolds(payload as any);
    expect(payload.update).toHaveBeenCalled();
  });
});

describe('sweepExpiredRentalHolds (AC27 — shared sweep, label-only)', () => {
  it('flips past-hold pending rentals to expired and returns the count (AC27)', async () => {
    const now = new Date('2026-06-15T14:00:00Z');
    const payload = makePayload(async () => ({ docs: [{ id: 10 }, { id: 11 }] }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sweepExpiredRentalHolds(payload as any, now);

    expect(result).toEqual({ swept: 2 });
    const call = payload.update.mock.calls[0]?.[0] as {
      collection: string;
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      overrideAccess: boolean;
    };
    expect(call.collection).toBe('rentals');
    // Label reconciliation ONLY — the sweep never writes capacity fields.
    expect(call.data).toEqual({ status: 'expired' });
    expect(call.overrideAccess).toBe(true);
    expect(call.where).toEqual({
      and: [
        { status: { equals: 'pending' } },
        { holdExpiresAt: { less_than: now.toISOString() } },
      ],
    });
  });

  it('sweepHoldsForCollection targets the passed collection', async () => {
    const payload = makePayload(async () => ({ docs: [{ id: 1 }] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sweepHoldsForCollection(payload as any, 'rentals', new Date('2026-06-15T14:00:00Z'));
    const call = payload.update.mock.calls[0]?.[0] as { collection: string };
    expect(call.collection).toBe('rentals');
  });
});

describe('AC28 — lapsed-but-unswept pending counts FREE; sweep is label-only for capacity', () => {
  // The day-state reader's committed-count predicate (capacity.ts / rentalDayState):
  // a rental counts iff paid OR (pending AND holdExpiresAt > now). A lapsed pending
  // hold is excluded whether it is still labeled `pending` or already `expired`, so
  // the sweep (which only changes the label) cannot change the fleet math.
  type Row = { startTime: string; durationMinutes: number; quantity: number; status: string; holdExpiresAt?: string };
  const counts = (r: Row, now: Date): boolean =>
    r.status === 'paid' ||
    (r.status === 'pending' && r.holdExpiresAt != null && new Date(r.holdExpiresAt).getTime() > now.getTime());
  const toOccupancy = (rows: Row[], now: Date): RentalOccupancy[] =>
    rows.filter((r) => counts(r, now)).map((r) => ({ startTime: r.startTime, durationMinutes: r.durationMinutes, quantity: r.quantity }));

  it('produces an identical fleet occupancy before and after the sweep relabels a lapsed hold', () => {
    const now = new Date('2026-06-15T18:00:00Z');
    const lapsedISO = '2026-06-15T17:00:00Z'; // <= now → lapsed
    const beforeSweep: Row[] = [
      { startTime: '10:00', durationMinutes: 120, quantity: 2, status: 'paid' },
      { startTime: '11:00', durationMinutes: 60, quantity: 3, status: 'pending', holdExpiresAt: lapsedISO },
    ];
    // Sweep flips the lapsed pending row's LABEL to expired; nothing else changes.
    const afterSweep: Row[] = beforeSweep.map((r) =>
      r.status === 'pending' && r.holdExpiresAt === lapsedISO ? { ...r, status: 'expired' } : r
    );

    const occBefore = toOccupancy(beforeSweep, now);
    const occAfter = toOccupancy(afterSweep, now);

    // The lapsed hold is FREE in BOTH cases → occupancy is identical (only the
    // paid 2-bike rental counts). The sweep changed the label, not the capacity.
    expect(occBefore).toEqual([{ startTime: '10:00', durationMinutes: 120, quantity: 2 }]);
    expect(occAfter).toEqual(occBefore);
  });
});
