import { describe, expect, it, vi } from 'vitest';

import type { Tour } from '../../payload-types';
import { countSeatsTaken, getDayAvailability } from './capacity';

/**
 * Hand-rolled Payload mock. Only `find` + `update` are touched.
 *   - `find` is configured per-test to return the docs that match a given
 *     where shape (we don't try to actually filter — we just return what the
 *     test author wired).
 *   - `update` is a no-op stub so the lazy sweep doesn't blow up.
 */
function makePayload(opts: {
  find?: (args: unknown) => Promise<{ docs: unknown[]; totalDocs?: number }>;
  update?: (args: unknown) => Promise<{ docs: unknown[] }>;
}): { find: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } {
  return {
    find: vi.fn(opts.find ?? (async () => ({ docs: [], totalDocs: 0 }))),
    update: vi.fn(opts.update ?? (async () => ({ docs: [] }))),
  };
}

const NOW = new Date('2026-06-15T14:00:00Z'); // 08:00 CDMX, Mon 2026-06-15

function makeTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 42,
    slug: 'ebike-classic',
    title: 'E-bike classic',
    category: 'ebike',
    duration: '3.5h',
    price: 89,
    shortDescription: 's',
    heroImage: 1,
    availableDays: ['1', '3', '5'], // Mon Wed Fri
    timeSlots: [
      { time: '09:00', capacity: 8 },
      { time: '14:00', capacity: 6 },
    ],
    updatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('countSeatsTaken', () => {
  it('sums totalPersons over paid + non-expired pending; ignores expired/cancelled', async () => {
    const payload = makePayload({
      // We assert query shape inside the mock — but for clarity we just hand
      // back the docs we want the helper to sum.
      find: async () => ({
        docs: [{ totalPersons: 2 }, { totalPersons: 3 }],
      }),
    });

     
    const total = await countSeatsTaken({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: payload as any,
      tourId: 42,
      date: new Date('2026-06-15T14:00:00Z'),
      time: '09:00',
      now: NOW,
    });

    expect(total).toBe(5);
    expect(payload.find).toHaveBeenCalledTimes(1);
    const call = payload.find.mock.calls[0]?.[0] as {
      collection: string;
      where: Record<string, unknown>;
      pagination: boolean;
      overrideAccess: boolean;
    };
    expect(call.collection).toBe('bookings');
    expect(call.pagination).toBe(false);
    expect(call.overrideAccess).toBe(true);
    // Shape: AND( tour, dateRange, time, OR(paid, AND(pending, holdExpiresAt > now)) )
    expect(call.where).toMatchObject({
      and: expect.arrayContaining([
        { tour: { equals: 42 } },
        { time: { equals: '09:00' } },
        {
          or: [
            { status: { equals: 'paid' } },
            {
              and: [
                { status: { equals: 'pending' } },
                { holdExpiresAt: { greater_than: NOW.toISOString() } },
              ],
            },
          ],
        },
      ]),
    });
  });

  it('returns 0 when no bookings match', async () => {
    const payload = makePayload({ find: async () => ({ docs: [] }) });
     
    const total = await countSeatsTaken({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: payload as any,
      tourId: 1,
      date: NOW,
      time: '09:00',
      now: NOW,
    });
    expect(total).toBe(0);
  });

  it('does not call payload.update — the sweep is owned by the cron route now', async () => {
    const payload = makePayload({
      find: async () => ({ docs: [{ totalPersons: 4 }] }),
    });
     
    const total = await countSeatsTaken({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: payload as any,
      tourId: 7,
      date: NOW,
      time: '09:00',
      now: NOW,
    });
    expect(total).toBe(4);
    expect(payload.update).not.toHaveBeenCalled();
  });

  it('coerces missing totalPersons to 0 defensively', async () => {
    const payload = makePayload({
      find: async () => ({ docs: [{ totalPersons: 2 }, {}, { totalPersons: 'bad' }] }),
    });
     
    const total = await countSeatsTaken({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: payload as any,
      tourId: 7,
      date: NOW,
      time: '09:00',
      now: NOW,
    });
    expect(total).toBe(2);
  });
});

describe('getDayAvailability', () => {
  it('returns [] without querying when the weekday is not available', async () => {
    // 2026-06-16 = Tuesday CDMX; tour only runs Mon/Wed/Fri → short-circuit.
    const payload = makePayload({});
    const tour = makeTour({ availableDays: ['1', '3', '5'] });
    const date = new Date('2026-06-16T14:00:00Z');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slots = await getDayAvailability({ payload: payload as any, tour, date, now: NOW });
    expect(slots).toEqual([]);
    expect(payload.find).not.toHaveBeenCalled();
  });

  it('returns per-slot rows with seatsTaken + remaining + cutoffPassed', async () => {
    // 2026-06-15 = Monday CDMX; tour runs Monday. We mock find() to return
    // different counts based on the queried time so we exercise aggregation.
    const payload = makePayload({
      find: async (rawArgs) => {
        const args = rawArgs as { where: { and: Array<Record<string, unknown>> } };
        const timeClause = args.where.and.find((c) => 'time' in c) as
          | { time: { equals: string } }
          | undefined;
        const time = timeClause?.time.equals;
        if (time === '09:00') return { docs: [{ totalPersons: 5 }] };
        if (time === '14:00') return { docs: [{ totalPersons: 0 }] };
        return { docs: [] };
      },
    });
    const tour = makeTour();
    const date = new Date('2026-06-15T14:00:00Z'); // Monday CDMX

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slots = await getDayAvailability({ payload: payload as any, tour, date, now: NOW });
    expect(slots).toEqual([
      // 09:00 → seatsTaken 5, capacity 8, remaining 3; cutoff at NOW=08:00 < 2h before 09:00 → true
      { time: '09:00', capacity: 8, seatsTaken: 5, remaining: 3, cutoffPassed: true },
      // 14:00 → seatsTaken 0, remaining 6; cutoff 14:00 - 08:00 = 6h → false
      { time: '14:00', capacity: 6, seatsTaken: 0, remaining: 6, cutoffPassed: false },
    ]);
    expect(payload.find).toHaveBeenCalledTimes(2);
  });

  it('returns [] when the tour has no time slots', async () => {
    const payload = makePayload({});
    const tour = makeTour({ timeSlots: [] });
    const date = new Date('2026-06-15T14:00:00Z'); // valid weekday
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slots = await getDayAvailability({ payload: payload as any, tour, date, now: NOW });
    expect(slots).toEqual([]);
    expect(payload.find).not.toHaveBeenCalled();
  });
});
