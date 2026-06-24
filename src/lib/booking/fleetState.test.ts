import { describe, expect, it, vi } from 'vitest';

import { evaluateBikeSlot, getBikeFleetState } from './fleet';

/**
 * Async-wrapper tests for the fleet layer. These exercise the 2-query DB read
 * (`getBikeFleetState`) and the single shared evaluator (`evaluateBikeSlot`)
 * that BOTH the availability GET and checkout POST routes call, so the verdict
 * can never drift between read and write.
 *
 * Payload is faked at the call boundary (findGlobal + find), mirroring the
 * route-test mock pattern. We assert real verdicts derived from real fleet
 * state, not mock-call internals.
 */

const NOW = new Date('2026-06-15T13:00:00Z'); // 07:00 CDMX Mon — well before 09:00 slots
const DATE = new Date('2026-06-15T12:00:00Z'); // noon-UTC anchor → CDMX 2026-06-15

type FindArgs = { collection: string };

/**
 * Build a payload double whose `find` dispatches by collection so a single
 * Promise.all over {tours, bookings} resolves deterministically.
 */
function makePayload({
  totalBikes = 8,
  bufferMinutes = 120,
  tours = [] as Array<Record<string, unknown>>,
  bookings = [] as Array<Record<string, unknown>>,
}: {
  totalBikes?: number;
  bufferMinutes?: number;
  tours?: Array<Record<string, unknown>>;
  bookings?: Array<Record<string, unknown>>;
} = {}) {
  return {
    findGlobal: vi.fn(async () => ({ totalBikes, bufferMinutes })),
    find: vi.fn(async ({ collection }: FindArgs) => {
      if (collection === 'tours') return { docs: tours };
      if (collection === 'bookings') return { docs: bookings };
      return { docs: [] };
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('getBikeFleetState', () => {
  it('builds occurrences from existing bookings using each tour duration + slot capacity', async () => {
    const payload = makePayload({
      tours: [
        { id: 1, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '09:00', capacity: 8 }] },
      ],
      bookings: [{ tour: 1, time: '09:00', date: '2026-06-15T15:00:00.000Z' }],
    });

    const state = await getBikeFleetState({ payload, date: DATE, now: NOW });

    expect(state.cfg).toEqual({ totalBikes: 8, bufferMinutes: 120 });
    expect(state.occurrences).toEqual([
      { tourId: 1, time: '09:00', durationMinutes: 120, capacity: 8 },
    ]);
  });

  it('falls back to defaults (8 bikes / 120 min) when the global omits them', async () => {
    const payload = {
      findGlobal: vi.fn(async () => ({})),
      find: vi.fn(async ({ collection }: FindArgs) =>
        collection === 'tours' ? { docs: [] } : { docs: [] }
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const state = await getBikeFleetState({ payload, date: DATE, now: NOW });
    expect(state.cfg).toEqual({ totalBikes: 8, bufferMinutes: 120 });
  });
});

describe('evaluateBikeSlot', () => {
  it('returns ok immediately for a non-bike tour without reading fleet state', async () => {
    const payload = makePayload();
    const verdict = await evaluateBikeSlot({
      payload,
      tour: { id: 5, usesBikes: false, durationMinutes: null },
      date: DATE,
      time: '09:00',
      now: NOW,
    });
    expect(verdict).toEqual({ ok: true });
    // Exempt tours must NOT trigger the 2-query read.
    expect(payload.find).not.toHaveBeenCalled();
    expect(payload.findGlobal).not.toHaveBeenCalled();
  });

  it('blocks a bike slot when an overlapping booking fills the fleet', async () => {
    // Existing full-fleet (cupo 8) bike booking at 09:00; candidate bike tour
    // (cupo 8) overlapping at 09:00 → fleet rule rejects.
    const payload = makePayload({
      tours: [
        { id: 1, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '09:00', capacity: 8 }] },
        { id: 2, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '09:00', capacity: 8 }] },
      ],
      bookings: [{ tour: 1, time: '09:00', date: '2026-06-15T15:00:00.000Z' }],
    });

    const verdict = await evaluateBikeSlot({
      payload,
      tour: { id: 2, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '09:00', capacity: 8 }] },
      date: DATE,
      time: '09:00',
      now: NOW,
    });
    expect(verdict).toEqual({ ok: false, reason: 'fleet' });
  });

  it('excludes the candidate own (tour,time) booking so re-evaluation does not self-block', async () => {
    // The only booking IS the candidate's own (tour 1 @ 09:00). After self-
    // exclusion there are no others, so an 8-cupo candidate fits (8 <= 8).
    const payload = makePayload({
      tours: [
        { id: 1, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '09:00', capacity: 8 }] },
      ],
      bookings: [{ tour: 1, time: '09:00', date: '2026-06-15T15:00:00.000Z' }],
    });

    const verdict = await evaluateBikeSlot({
      payload,
      tour: { id: 1, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '09:00', capacity: 8 }] },
      date: DATE,
      time: '09:00',
      now: NOW,
    });
    expect(verdict).toEqual({ ok: true });
  });

  it('blocks a bike tour with null durationMinutes as unevaluatable (fail-safe)', async () => {
    const payload = makePayload({
      tours: [{ id: 3, usesBikes: true, durationMinutes: null, timeSlots: [{ time: '09:00', capacity: 4 }] }],
      bookings: [],
    });

    const verdict = await evaluateBikeSlot({
      payload,
      tour: { id: 3, usesBikes: true, durationMinutes: null, timeSlots: [{ time: '09:00', capacity: 4 }] },
      date: DATE,
      time: '09:00',
      now: NOW,
    });
    expect(verdict).toEqual({ ok: false, reason: 'unevaluatable' });
  });
});
