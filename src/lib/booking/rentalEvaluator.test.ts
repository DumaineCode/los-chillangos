import { describe, expect, it } from 'vitest';

import {
  type RentalDayState,
  type RentalRequest,
  type RentalSettings,
  computeMaxRentalQuantity,
  evaluateRental,
} from './rentalEvaluator';

/**
 * Pure evaluator tests (Batch 2, PR2). No DB, no wall-clock — `now` is always a
 * param. All instants are CDMX (fixed UTC-6) via ymdHHMMToCDMXInstant.
 *
 * Fixture clock discipline:
 *   - "today" CDMX day = 2026-06-15.
 *   - `now` = 2026-06-15T13:00:00Z = 07:00 CDMX (so every 08:00+ start block is
 *     still in the future relative to now, and today's day-before-noon cutoff
 *     lapsed yesterday → today is always rentable).
 *   - `date` (request anchor) = noon-UTC of the target CDMX day.
 */

const TODAY = new Date('2026-06-15T12:00:00Z'); // CDMX 2026-06-15 06:00
const NOW = new Date('2026-06-15T13:00:00Z'); // CDMX 07:00 (today, cutoff already passed)

function cfg(overrides: Partial<RentalSettings> = {}): RentalSettings {
  return {
    totalBikes: 8,
    bufferMinutes: 120,
    openTime: '09:00',
    closeTime: '19:00',
    ...overrides,
  };
}

const EMPTY_DAY: RentalDayState = { tours: [], rentals: [] };

function req(overrides: Partial<RentalRequest> = {}): RentalRequest {
  return {
    date: TODAY,
    startTime: '09:00',
    durationMinutes: 60,
    quantity: 1,
    ...overrides,
  };
}

describe('evaluateRental — fail-safe precondition (AC13)', () => {
  it('short-circuits unevaluatable on quantity <= 0 before any other check', () => {
    // Even on a fully invalid day (past date, over-fleet), quantity 0 wins first.
    const r = req({ quantity: 0, date: new Date('2020-01-01T12:00:00Z') });
    expect(evaluateRental(r, EMPTY_DAY, cfg(), NOW)).toEqual({
      valid: false,
      reason: 'unevaluatable',
    });
  });

  it('short-circuits unevaluatable on non-positive duration', () => {
    expect(evaluateRental(req({ durationMinutes: 0 }), EMPTY_DAY, cfg(), NOW)).toEqual({
      valid: false,
      reason: 'unevaluatable',
    });
  });

  it('short-circuits unevaluatable on non-integer-ish non-finite quantity', () => {
    expect(evaluateRental(req({ quantity: Number.NaN }), EMPTY_DAY, cfg(), NOW)).toEqual({
      valid: false,
      reason: 'unevaluatable',
    });
  });

  it('short-circuits unevaluatable on a fractional quantity (bikes are indivisible)', () => {
    // 2.5 bikes cannot be rented; even on an otherwise-valid, empty day the
    // integer guard must reject before the fleet math ever runs.
    expect(evaluateRental(req({ quantity: 2.5 }), EMPTY_DAY, cfg(), NOW)).toEqual({
      valid: false,
      reason: 'unevaluatable',
    });
  });
});

describe('evaluateRental — rentable-day gate (AC9, AC10, AC11)', () => {
  it('tomorrow opens exactly at today-noon CDMX boundary (AC9)', () => {
    const tomorrow = new Date('2026-06-16T12:00:00Z');
    const boundary = new Date('2026-06-15T18:00:00Z'); // today 12:00 CDMX
    const before = new Date('2026-06-15T17:59:00Z'); // one minute before

    // At the boundary tomorrow is rentable.
    expect(
      evaluateRental(req({ date: tomorrow }), EMPTY_DAY, cfg(), boundary)
    ).toEqual({ valid: true });
    // One minute before, tomorrow is still closed.
    expect(
      evaluateRental(req({ date: tomorrow }), EMPTY_DAY, cfg(), before)
    ).toEqual({ valid: false, reason: 'closed_day' });
  });

  it('day-after-tomorrow is never rentable → closed_day (AC10)', () => {
    const dayAfter = new Date('2026-06-17T12:00:00Z');
    const now = new Date('2026-06-15T18:00:00Z');
    expect(evaluateRental(req({ date: dayAfter }), EMPTY_DAY, cfg(), now)).toEqual({
      valid: false,
      reason: 'closed_day',
    });
  });

  it('a start block whose instant is already in the past → closed_day (AC11)', () => {
    const now = new Date('2026-06-15T20:00:00Z'); // CDMX 14:00
    // 09:00 CDMX = 15:00Z is before now.
    expect(
      evaluateRental(req({ startTime: '09:00' }), EMPTY_DAY, cfg(), now)
    ).toEqual({ valid: false, reason: 'closed_day' });
  });
});

describe('evaluateRental — close-time ceiling + open-time gate (AC14, AC15, AC17)', () => {
  it('6h @ 13:00 rides to 19:00 exactly → valid (inclusive ceiling, AC14)', () => {
    expect(
      evaluateRental(req({ startTime: '13:00', durationMinutes: 360 }), EMPTY_DAY, cfg(), NOW)
    ).toEqual({ valid: true });
  });

  it('6h @ 13:30 ends 19:30 > 19:00 close → after_close (AC14)', () => {
    expect(
      evaluateRental(req({ startTime: '13:30', durationMinutes: 360 }), EMPTY_DAY, cfg(), NOW)
    ).toEqual({ valid: false, reason: 'after_close' });
  });

  it('start before openTime (openTime pinned 09:00) → after_close, gate before fleet (AC15)', () => {
    // Even with an over-full fleet, the open-time gate wins (runs before fleet).
    const day: RentalDayState = {
      tours: [{ startTime: '08:00', durationMinutes: 120, personsSold: 8 }],
      rentals: [],
    };
    expect(
      evaluateRental(req({ startTime: '08:30' }), day, cfg({ openTime: '09:00' }), NOW)
    ).toEqual({ valid: false, reason: 'after_close' });
  });

  it('1h @ 08:30 valid when openTime pinned 08:00 (AC17)', () => {
    expect(
      evaluateRental(req({ startTime: '08:30' }), EMPTY_DAY, cfg({ openTime: '08:00' }), NOW)
    ).toEqual({ valid: true });
  });
});

describe('evaluateRental — per-instant fleet check (AC16, AC18, AC19, AC20, AC21, AC22, AC23)', () => {
  const tourDay: RentalDayState = {
    tours: [{ startTime: '12:00', durationMinutes: 120, personsSold: 5 }],
    rentals: [],
  };

  it('1h @ 09:00 boundary touch (busy_end == tour_start) → valid (AC16, AC19)', () => {
    // busy [09:00, 12:00); tour occupancy starts 12:00 → excluded from critical set.
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 60, quantity: 1 }), tourDay, cfg(), NOW)
    ).toEqual({ valid: true });
  });

  it('6h @ 09:00 overlapping the 12:00 tour → Q=3 valid, Q=4 fleet (AC18)', () => {
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 3 }), tourDay, cfg(), NOW)
    ).toEqual({ valid: true });
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 4 }), tourDay, cfg(), NOW)
    ).toEqual({ valid: false, reason: 'fleet' });
  });

  it('an active tour with 0 persons sold subtracts nothing (AC20)', () => {
    const zeroSold: RentalDayState = {
      tours: [{ startTime: '12:00', durationMinutes: 120, personsSold: 0 }],
      rentals: [],
    };
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 8 }), zeroSold, cfg(), NOW)
    ).toEqual({ valid: true });
  });

  it('no-tour day: quantity = totalBikes valid, +1 → fleet (AC21)', () => {
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 8 }), EMPTY_DAY, cfg(), NOW)
    ).toEqual({ valid: true });
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 9 }), EMPTY_DAY, cfg(), NOW)
    ).toEqual({ valid: false, reason: 'fleet' });
  });

  it('concurrent rentals share the fleet: 6 out + new 3 → fleet, new 2 → valid (AC22)', () => {
    const concurrent: RentalDayState = {
      tours: [],
      rentals: [
        { startTime: '09:00', durationMinutes: 360, quantity: 4 },
        { startTime: '09:00', durationMinutes: 360, quantity: 2 },
      ],
    };
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 3 }), concurrent, cfg(), NOW)
    ).toEqual({ valid: false, reason: 'fleet' });
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 2 }), concurrent, cfg(), NOW)
    ).toEqual({ valid: true });
  });

  it('fleet count uses persons_sold basis, not cupo (cupo 8 / sold 5 leaves 3, AC23)', () => {
    // tourDay has personsSold 5; a cupo of 8 must NOT be what constrains it.
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 3 }), tourDay, cfg(), NOW)
    ).toEqual({ valid: true });
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 360, quantity: 4 }), tourDay, cfg(), NOW)
    ).toEqual({ valid: false, reason: 'fleet' });
  });
});

describe('evaluateRental — off-by-one triangulation (T2.7 guards)', () => {
  it('rental-vs-rental boundary touch (new busy_end == other busy_start) → not counted', () => {
    // Other rental busy [12:00, 12:00+(60+120)) = [12:00, 14:00), 8 bikes.
    // New 1h @ 09:00 busy [09:00, 12:00) — its end touches the other start at
    // 12:00, which is excluded from the critical set (needs start < end_req).
    const day: RentalDayState = {
      tours: [],
      rentals: [{ startTime: '12:00', durationMinutes: 60, quantity: 8 }],
    };
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 60, quantity: 8 }), day, cfg(), NOW)
    ).toEqual({ valid: true });
  });

  it('one minute of overlap past the touch flips to fleet', () => {
    // Other rental start 11:59 falls strictly inside the [09:00, 12:00) window.
    const day: RentalDayState = {
      tours: [],
      rentals: [{ startTime: '11:59', durationMinutes: 60, quantity: 8 }],
    };
    expect(
      evaluateRental(req({ startTime: '09:00', durationMinutes: 60, quantity: 1 }), day, cfg(), NOW)
    ).toEqual({ valid: false, reason: 'fleet' });
  });

  it('close-time equality is inclusive to the exact minute', () => {
    // 2h @ 17:00 ends exactly 19:00 == closeTime → valid; 17:01 → after_close.
    expect(
      evaluateRental(req({ startTime: '17:00', durationMinutes: 120 }), EMPTY_DAY, cfg(), NOW)
    ).toEqual({ valid: true });
    expect(
      evaluateRental(req({ startTime: '17:01', durationMinutes: 120 }), EMPTY_DAY, cfg(), NOW)
    ).toEqual({ valid: false, reason: 'after_close' });
  });
});

describe('computeMaxRentalQuantity — grid helper (AC21, AC23, AC24 invariant)', () => {
  const noQty = (o: Partial<Omit<RentalRequest, 'quantity'>> = {}) => ({
    date: TODAY,
    startTime: '09:00',
    durationMinutes: 360,
    ...o,
  });

  it('returns 0 when a time gate fails (past block)', () => {
    const now = new Date('2026-06-15T20:00:00Z');
    expect(computeMaxRentalQuantity(noQty({ startTime: '09:00' }), EMPTY_DAY, cfg(), now)).toBe(0);
  });

  it('returns 0 when duration is non-positive (unevaluatable)', () => {
    expect(computeMaxRentalQuantity(noQty({ durationMinutes: 0 }), EMPTY_DAY, cfg(), NOW)).toBe(0);
  });

  it('no-tour day yields totalBikes (AC21)', () => {
    expect(computeMaxRentalQuantity(noQty(), EMPTY_DAY, cfg(), NOW)).toBe(8);
  });

  it('tour sold 5 leaves 3 rentable (AC23)', () => {
    const tourDay: RentalDayState = {
      tours: [{ startTime: '12:00', durationMinutes: 120, personsSold: 5 }],
      rentals: [],
    };
    expect(computeMaxRentalQuantity(noQty(), tourDay, cfg(), NOW)).toBe(3);
  });

  it('boundary touch (1h @ 09:00) yields full fleet, not reduced by the 12:00 tour', () => {
    const tourDay: RentalDayState = {
      tours: [{ startTime: '12:00', durationMinutes: 120, personsSold: 5 }],
      rentals: [],
    };
    const max = computeMaxRentalQuantity(noQty({ durationMinutes: 60 }), tourDay, cfg(), NOW);
    expect(max).toBe(8);
    // AC24 invariant: max valid, max+1 invalid under evaluateRental.
    expect(
      evaluateRental({ ...noQty({ durationMinutes: 60 }), quantity: max }, tourDay, cfg(), NOW)
    ).toEqual({ valid: true });
    expect(
      evaluateRental({ ...noQty({ durationMinutes: 60 }), quantity: max + 1 }, tourDay, cfg(), NOW)
    ).toEqual({ valid: false, reason: 'fleet' });
  });
});
