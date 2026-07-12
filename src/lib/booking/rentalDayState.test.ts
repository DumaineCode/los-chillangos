import { describe, expect, it, vi } from 'vitest';

import { getCDMXDayRange } from './availability';
import { getRentalDayState } from './rentalDayState';

/**
 * Day-state reader tests (Batch 2, PR2). The reader is the ONLY DB-touching
 * piece of the availability engine; it hands a plain RentalDayState to the pure
 * evaluator. We mock the Payload Local API and assert:
 *   - persons_sold basis (grouped booking persons, NOT slot cupo) — AC12
 *   - the committed-count predicate on both counting reads — AC4
 */

type FindArgs = { collection: string; where?: unknown };

function makePayload({
  settings,
  tours,
  bookings,
  rentals,
}: {
  settings?: Record<string, unknown>;
  tours?: unknown[];
  bookings?: unknown[];
  rentals?: unknown[];
}) {
  const calls: FindArgs[] = [];
  const payload = {
    findGlobal: vi.fn(async () => settings ?? { totalBikes: 8, bufferMinutes: 120, openTime: '09:00', closeTime: '19:00' }),
    find: vi.fn(async (args: FindArgs) => {
      calls.push(args);
      if (args.collection === 'tours') return { docs: tours ?? [] };
      if (args.collection === 'bookings') return { docs: bookings ?? [] };
      if (args.collection === 'rentals') return { docs: rentals ?? [] };
      return { docs: [] };
    }),
  };
  return { payload, calls };
}

const DATE = new Date('2026-06-15T12:00:00Z');
const NOW = new Date('2026-06-15T13:00:00Z');

describe('getRentalDayState — persons_sold basis (AC12)', () => {
  it('groups counting bookings to personsSold, not slot capacity', async () => {
    const { payload } = makePayload({
      tours: [{ id: 1, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '12:00', capacity: 8 }] }],
      // Two paid bookings on the same (tour, time) sum to 5 persons — cupo is 8.
      bookings: [
        { tour: 1, time: '12:00', totalPersons: 3, status: 'paid' },
        { tour: 1, time: '12:00', totalPersons: 2, status: 'paid' },
      ],
    });

    const { day } = await getRentalDayState({
      payload: payload as never,
      date: DATE,
      now: NOW,
    });

    expect(day.tours).toEqual([{ startTime: '12:00', durationMinutes: 120, personsSold: 5 }]);
  });

  it('drops bookings whose tour is missing / non-bike / zero-duration', async () => {
    const { payload } = makePayload({
      tours: [{ id: 1, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '12:00', capacity: 8 }] }],
      bookings: [
        { tour: 1, time: '12:00', totalPersons: 3, status: 'paid' },
        { tour: 999, time: '10:00', totalPersons: 4, status: 'paid' }, // no such bike tour
      ],
    });

    const { day } = await getRentalDayState({ payload: payload as never, date: DATE, now: NOW });
    expect(day.tours).toEqual([{ startTime: '12:00', durationMinutes: 120, personsSold: 3 }]);
  });

  it('builds rentals[] from counting rentals rows', async () => {
    const { payload } = makePayload({
      rentals: [
        { startTime: '10:00', durationMinutes: 60, quantity: 2, status: 'paid' },
        { startTime: '14:00', durationMinutes: 120, quantity: 1, status: 'pending' },
      ],
    });

    const { day } = await getRentalDayState({ payload: payload as never, date: DATE, now: NOW });
    expect(day.rentals).toEqual([
      { startTime: '10:00', durationMinutes: 60, quantity: 2 },
      { startTime: '14:00', durationMinutes: 120, quantity: 1 },
    ]);
  });
});

describe('getRentalDayState — committed-count predicate (AC4)', () => {
  it('applies paid OR (pending AND holdExpiresAt > now) to bookings and rentals reads', async () => {
    const { payload, calls } = makePayload({});
    await getRentalDayState({ payload: payload as never, date: DATE, now: NOW });

    const predicateHasLiveHold = (where: unknown): boolean => {
      const json = JSON.stringify(where);
      return (
        json.includes('"paid"') &&
        json.includes('"pending"') &&
        json.includes('holdExpiresAt') &&
        json.includes('greater_than') &&
        json.includes(NOW.toISOString())
      );
    };

    // The predicate must ALSO be scoped to the CDMX calendar-day window, or a
    // dropped date-range regression would silently count every day's rows.
    const { startUTC, endUTC } = getCDMXDayRange(DATE);
    const predicateHasDayRange = (where: unknown): boolean => {
      const json = JSON.stringify(where);
      return (
        json.includes('greater_than_equal') &&
        json.includes(startUTC.toISOString()) &&
        json.includes('less_than') &&
        json.includes(endUTC.toISOString())
      );
    };

    const bookingsCall = calls.find((c) => c.collection === 'bookings');
    const rentalsCall = calls.find((c) => c.collection === 'rentals');
    expect(bookingsCall).toBeDefined();
    expect(rentalsCall).toBeDefined();
    expect(predicateHasLiveHold(bookingsCall?.where)).toBe(true);
    expect(predicateHasLiveHold(rentalsCall?.where)).toBe(true);
    expect(predicateHasDayRange(bookingsCall?.where)).toBe(true);
    expect(predicateHasDayRange(rentalsCall?.where)).toBe(true);
  });

  it('exposes cfg from settings for the evaluator', async () => {
    const { payload } = makePayload({
      settings: { totalBikes: 10, bufferMinutes: 90, openTime: '08:00', closeTime: '20:00' },
    });
    const { cfg } = await getRentalDayState({ payload: payload as never, date: DATE, now: NOW });
    expect(cfg).toEqual({ totalBikes: 10, bufferMinutes: 90, openTime: '08:00', closeTime: '20:00' });
  });
});
