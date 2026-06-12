import { describe, expect, it } from 'vitest';

import {
  HOLD_TTL_MINUTES,
  SAME_DAY_CUTOFF_HOURS,
  STRIPE_SESSION_TTL_MINUTES,
  TOUR_TIMEZONE,
  computeSlotAvailability,
  getCDMXDayRange,
  getTimeSlotsForTour,
  getTodayInTourTZ,
  isDateBeforeTodayInTourTZ,
  isDateBookableForTour,
  isSameDayCutoffPassed,
  isWeekdayAvailable,
} from './availability';

/**
 * Pure availability helpers — every assertion uses a fixed `now` so the test
 * is timezone-stable on any CI runner. The booking calendar is anchored to
 * CDMX (UTC-6, no DST since 2022).
 */

describe('constants', () => {
  it('exposes locked product constants', () => {
    expect(HOLD_TTL_MINUTES).toBe(15);
    expect(SAME_DAY_CUTOFF_HOURS).toBe(2);
    expect(TOUR_TIMEZONE).toBe('America/Mexico_City');
  });

  it('STRIPE_SESSION_TTL_MINUTES sits at or above Stripe\'s 30-minute floor', () => {
    // Stripe rejects expires_at < 30 minutes from session creation with
    // StripeInvalidRequestError. Keeping this >= 30 prevents a regression
    // to the original bug where checkout.sessions.create always failed.
    expect(STRIPE_SESSION_TTL_MINUTES).toBeGreaterThanOrEqual(30);
  });

  it('STRIPE_SESSION_TTL_MINUTES is strictly greater than HOLD_TTL_MINUTES', () => {
    // Architectural invariant: the two timers are intentionally decoupled.
    // If anyone sets them equal, the webhook's late-pay auto-refund branch
    // becomes dead code and we're back to the original misleading-cancelled
    // UX. This test is a tripwire so that branch stays alive.
    expect(STRIPE_SESSION_TTL_MINUTES).toBeGreaterThan(HOLD_TTL_MINUTES);
  });
});

describe('getTodayInTourTZ', () => {
  it('rolls back to the previous calendar day when UTC is past midnight but CDMX is not', () => {
    // 2026-06-15T05:00:00Z = 2026-06-14T23:00:00 in CDMX (UTC-6)
    const now = new Date('2026-06-15T05:00:00Z');
    expect(getTodayInTourTZ(now)).toEqual({ year: 2026, month: 6, day: 14 });
  });

  it('returns the same day when UTC and CDMX share it', () => {
    // 2026-06-14T20:00:00Z = 2026-06-14T14:00:00 CDMX
    const now = new Date('2026-06-14T20:00:00Z');
    expect(getTodayInTourTZ(now)).toEqual({ year: 2026, month: 6, day: 14 });
  });
});

describe('isDateBeforeTodayInTourTZ', () => {
  it('returns false when the date is today in CDMX (afternoon in CDMX)', () => {
    // candidate = 2026-06-14T23:00:00Z = 2026-06-14T17:00:00 CDMX (today)
    const now = new Date('2026-06-15T05:00:00Z'); // = 2026-06-14T23:00:00 CDMX
    const candidate = new Date('2026-06-14T23:00:00Z');
    expect(isDateBeforeTodayInTourTZ(candidate, now)).toBe(false);
  });

  it('returns true when the calendar date is strictly before today (CDMX)', () => {
    const now = new Date('2026-06-14T20:00:00Z'); // 2026-06-14 CDMX
    const candidate = new Date('2026-06-13T18:00:00Z'); // 2026-06-13 CDMX
    expect(isDateBeforeTodayInTourTZ(candidate, now)).toBe(true);
  });

  it('returns false when the date is in the future', () => {
    const now = new Date('2026-06-14T20:00:00Z');
    const candidate = new Date('2026-06-20T20:00:00Z');
    expect(isDateBeforeTodayInTourTZ(candidate, now)).toBe(false);
  });
});

describe('isSameDayCutoffPassed', () => {
  it('blocks a today slot less than 2h from now', () => {
    // 2026-06-15T14:00:00Z = 2026-06-15T08:00:00 CDMX
    const now = new Date('2026-06-15T14:00:00Z');
    const slotDate = new Date('2026-06-15T14:00:00Z'); // same CDMX day
    expect(isSameDayCutoffPassed(slotDate, '09:00', now)).toBe(true);
  });

  it('allows a today slot at least 2h from now', () => {
    const now = new Date('2026-06-15T14:00:00Z'); // 08:00 CDMX
    const slotDate = new Date('2026-06-15T14:00:00Z'); // 2026-06-15 CDMX
    expect(isSameDayCutoffPassed(slotDate, '11:00', now)).toBe(false);
  });

  it('returns false when the slot is not today (tomorrow is fine)', () => {
    const now = new Date('2026-06-15T14:00:00Z');
    const slotDate = new Date('2026-06-16T14:00:00Z');
    expect(isSameDayCutoffPassed(slotDate, '07:00', now)).toBe(false);
  });

  it('returns true when the slot time is already past', () => {
    const now = new Date('2026-06-15T20:00:00Z'); // 14:00 CDMX
    const slotDate = new Date('2026-06-15T14:00:00Z');
    expect(isSameDayCutoffPassed(slotDate, '09:00', now)).toBe(true);
  });
});

describe('isWeekdayAvailable', () => {
  it('matches when the weekday is in the list (string values from Payload select)', () => {
    // 2026-06-17 is a Wednesday in CDMX (getDay() === 3)
    const wed = new Date('2026-06-17T18:00:00Z');
    expect(isWeekdayAvailable(wed, ['0', '3', '5'])).toBe(true);
  });

  it('matches when the weekday is in the list (number values)', () => {
    const wed = new Date('2026-06-17T18:00:00Z');
    expect(isWeekdayAvailable(wed, [0, 3, 5])).toBe(true);
  });

  it('does not match when the weekday is absent', () => {
    const mon = new Date('2026-06-15T18:00:00Z'); // Monday
    expect(isWeekdayAvailable(mon, ['0', '3', '5'])).toBe(false);
  });

  it('returns false for an empty list (paused tour)', () => {
    const tue = new Date('2026-06-16T18:00:00Z');
    expect(isWeekdayAvailable(tue, [])).toBe(false);
  });

  it('uses the CDMX weekday, not the server weekday', () => {
    // 2026-06-15T05:00:00Z is Mon UTC but Sun (06-14) in CDMX (UTC-6)
    const date = new Date('2026-06-15T05:00:00Z');
    expect(isWeekdayAvailable(date, ['0'])).toBe(true); // Sunday in CDMX
    expect(isWeekdayAvailable(date, ['1'])).toBe(false); // not Monday in CDMX
  });
});

describe('isDateBookableForTour', () => {
  // Seasonal window stored the way Payload serializes a `date` field: an ISO
  // datetime at midnight UTC. 2026-08-14T00:00:00Z is still 2026-08-13 in CDMX
  // (UTC-6), so the gate MUST compare CALENDAR DAYS in CDMX, never raw
  // timestamps. We model the window as a single CDMX calendar day (Aug 14)
  // and a multi-day range to cover both shapes.
  const SINGLE_DATE = {
    isSeasonal: true,
    availableDays: ['5'], // irrelevant for seasonal tours — must be ignored
    seasonal: {
      seasonWindow: { start: '2026-08-14T06:00:00.000Z', end: '2026-08-14T06:00:00.000Z' },
    },
  };
  const RANGE = {
    isSeasonal: true,
    availableDays: ['5'],
    seasonal: {
      seasonWindow: { start: '2026-08-14T06:00:00.000Z', end: '2026-08-16T06:00:00.000Z' },
    },
  };

  it('returns true for a date inside the window (CDMX afternoon on the start day)', () => {
    // 2026-08-14T18:00:00Z = 2026-08-14T12:00:00 CDMX → inside [14..16]
    const inside = new Date('2026-08-14T18:00:00Z');
    expect(isDateBookableForTour(inside, RANGE)).toBe(true);
  });

  it('returns true exactly on the start day and exactly on the end day (inclusive)', () => {
    // start day Aug 14 (CDMX noon), end day Aug 16 (CDMX noon)
    expect(isDateBookableForTour(new Date('2026-08-14T18:00:00Z'), RANGE)).toBe(true);
    expect(isDateBookableForTour(new Date('2026-08-16T18:00:00Z'), RANGE)).toBe(true);
  });

  it('returns false for a date before the start day', () => {
    // Aug 13 CDMX is before the Aug-14 start
    const before = new Date('2026-08-13T18:00:00Z');
    expect(isDateBookableForTour(before, RANGE)).toBe(false);
  });

  it('returns false for a date after the end day', () => {
    // Aug 17 CDMX is after the Aug-16 end
    const after = new Date('2026-08-17T18:00:00Z');
    expect(isDateBookableForTour(after, RANGE)).toBe(false);
  });

  it('single-date window (start === end): only that calendar day is bookable', () => {
    // Aug 14 CDMX → bookable; Aug 13 and Aug 15 → not.
    expect(isDateBookableForTour(new Date('2026-08-14T18:00:00Z'), SINGLE_DATE)).toBe(true);
    expect(isDateBookableForTour(new Date('2026-08-13T18:00:00Z'), SINGLE_DATE)).toBe(false);
    expect(isDateBookableForTour(new Date('2026-08-15T18:00:00Z'), SINGLE_DATE)).toBe(false);
  });

  it('TZ regression: a date that is Aug 14 in CDMX but Aug 15 in UTC resolves to Aug 14', () => {
    // 2026-08-15T04:00:00Z = 2026-08-14T22:00:00 CDMX. A naive raw-timestamp
    // compare against an Aug-14-midnight-UTC end bound would push this out of
    // the single-date window; the CDMX calendar-day compare keeps it inside.
    const lateNightCDMX = new Date('2026-08-15T04:00:00Z');
    expect(isDateBookableForTour(lateNightCDMX, SINGLE_DATE)).toBe(true);
  });

  it('TZ regression: a date that is Aug 13 in CDMX but Aug 14 in UTC stays out', () => {
    // 2026-08-14T03:00:00Z = 2026-08-13T21:00:00 CDMX. Raw-UTC compare would
    // read this as "Aug 14" and wrongly admit it; CDMX compare rejects it.
    const earlyUTC = new Date('2026-08-14T03:00:00Z');
    expect(isDateBookableForTour(earlyUTC, SINGLE_DATE)).toBe(false);
  });

  it('returns false (closed) when the seasonal window is missing a bound', () => {
    const noStart = {
      isSeasonal: true,
      availableDays: ['5'],
      seasonal: { seasonWindow: { start: null, end: '2026-08-16T06:00:00.000Z' } },
    };
    const noEnd = {
      isSeasonal: true,
      availableDays: ['5'],
      seasonal: { seasonWindow: { start: '2026-08-14T06:00:00.000Z', end: null } },
    };
    const noWindow = { isSeasonal: true, availableDays: ['5'], seasonal: {} };
    const inside = new Date('2026-08-14T18:00:00Z');
    expect(isDateBookableForTour(inside, noStart)).toBe(false);
    expect(isDateBookableForTour(inside, noEnd)).toBe(false);
    expect(isDateBookableForTour(inside, noWindow)).toBe(false);
  });

  it('non-seasonal tour delegates to the weekday model (availableDays)', () => {
    const standard = { isSeasonal: false, availableDays: ['5'] }; // Fridays only
    const friday = new Date('2026-08-14T18:00:00Z'); // Friday CDMX
    const saturday = new Date('2026-08-15T18:00:00Z'); // Saturday CDMX
    expect(isDateBookableForTour(friday, standard)).toBe(true);
    expect(isDateBookableForTour(saturday, standard)).toBe(false);
  });

  it('treats a tour with isSeasonal unset/null as standard (weekday) logic', () => {
    const standard = { availableDays: ['3'] }; // Wednesdays only, no isSeasonal flag
    const wed = new Date('2026-06-17T18:00:00Z'); // Wednesday CDMX
    const thu = new Date('2026-06-18T18:00:00Z'); // Thursday CDMX
    expect(isDateBookableForTour(wed, standard)).toBe(true);
    expect(isDateBookableForTour(thu, standard)).toBe(false);
  });
});

describe('getTimeSlotsForTour', () => {
  it('returns [] when tour has no slots', () => {
    expect(getTimeSlotsForTour({ timeSlots: null })).toEqual([]);
    expect(getTimeSlotsForTour({ timeSlots: undefined })).toEqual([]);
    expect(getTimeSlotsForTour({ timeSlots: [] })).toEqual([]);
  });

  it('returns a clean list of {time, capacity}', () => {
    expect(
      getTimeSlotsForTour({
        timeSlots: [
          { time: '09:00', capacity: 8 },
          { time: '14:00', capacity: 6 },
        ],
      })
    ).toEqual([
      { time: '09:00', capacity: 8 },
      { time: '14:00', capacity: 6 },
    ]);
  });

  it('trims time, coerces capacity to int, drops invalid entries', () => {
    expect(
      getTimeSlotsForTour({
        timeSlots: [
          { time: ' 09:00 ', capacity: 8.7 },
          { time: '', capacity: 4 },
          // @ts-expect-error testing defensive coercion
          { time: '11:00', capacity: 'oops' },
          // @ts-expect-error invalid shape
          { time: null, capacity: 4 },
          { time: '14:00', capacity: 0 },
          { time: '15:00', capacity: -3 },
          { time: '16:00', capacity: 5 },
        ],
      })
    ).toEqual([
      { time: '09:00', capacity: 8 },
      { time: '16:00', capacity: 5 },
    ]);
  });
});

describe('computeSlotAvailability', () => {
  it('subtracts seats taken from capacity (never negative)', () => {
    expect(computeSlotAvailability({ slotCapacity: 8, seatsTaken: 3, requestedPersons: 2 })).toEqual(
      { remaining: 5, canFit: true }
    );
    expect(
      computeSlotAvailability({ slotCapacity: 8, seatsTaken: 10, requestedPersons: 1 })
    ).toEqual({ remaining: 0, canFit: false });
  });

  it('rejects requestedPersons <= 0', () => {
    expect(
      computeSlotAvailability({ slotCapacity: 8, seatsTaken: 0, requestedPersons: 0 })
    ).toEqual({ remaining: 8, canFit: false });
  });

  it('rejects requestedPersons > remaining', () => {
    expect(
      computeSlotAvailability({ slotCapacity: 8, seatsTaken: 5, requestedPersons: 4 })
    ).toEqual({ remaining: 3, canFit: false });
  });
});

describe('getCDMXDayRange', () => {
  it('returns [startOfDayUTC, endOfDayUTC] that brackets the CDMX calendar day', () => {
    // We ask for 2026-06-15 in CDMX. That day in CDMX runs from
    // 2026-06-15T00:00:00-06:00 = 2026-06-15T06:00:00Z up to
    // 2026-06-16T00:00:00-06:00 = 2026-06-16T06:00:00Z (exclusive).
    const anyInstantOnThatDay = new Date('2026-06-15T20:00:00Z');
    const { startUTC, endUTC } = getCDMXDayRange(anyInstantOnThatDay);
    expect(startUTC.toISOString()).toBe('2026-06-15T06:00:00.000Z');
    expect(endUTC.toISOString()).toBe('2026-06-16T06:00:00.000Z');
  });

  it('uses the CDMX day even when the JS Date is at a UTC boundary', () => {
    // 2026-06-15T05:00:00Z is still 2026-06-14 in CDMX
    const earlyUTC = new Date('2026-06-15T05:00:00Z');
    const { startUTC, endUTC } = getCDMXDayRange(earlyUTC);
    expect(startUTC.toISOString()).toBe('2026-06-14T06:00:00.000Z');
    expect(endUTC.toISOString()).toBe('2026-06-15T06:00:00.000Z');
  });
});
