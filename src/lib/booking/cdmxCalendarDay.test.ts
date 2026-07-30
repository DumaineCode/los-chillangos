import { describe, expect, it } from 'vitest';

import {
  getTourDayISO,
  getYMDInTourTZ,
  isDateBeforeTodayInTourTZ,
  isDateBookableForTour,
  ymdToCDMXNoonInstant,
} from './availability';

/**
 * Regression tests for the booking wizard day-shift bug.
 *
 * The wizard used to represent a clicked calendar day as device-LOCAL
 * midnight (`new Date(y, m, d)`) and then reinterpret that instant in CDMX
 * (UTC-6). For devices east of UTC-6, local midnight is still the PREVIOUS
 * day in CDMX — so bookability gating, the availability fetch, and the
 * checkout payload disagreed by one day and the server rejected the booking
 * (or booked the wrong day).
 *
 * The fix funnels every clicked day through `ymdToCDMXNoonInstant`. We can't
 * reliably change the process timezone per test, so these tests build
 * explicit UTC instants with Date.UTC math to SIMULATE what devices in other
 * timezones would have produced, and assert the pure conversion invariants
 * that hold regardless of the host timezone.
 */

/** Local midnight of a calendar day as produced by a device at `utcOffsetHours`. */
function localMidnightInstant(
  year: number,
  month: number,
  day: number,
  utcOffsetHours: number
): Date {
  return new Date(Date.UTC(year, month - 1, day) - utcOffsetHours * 3_600_000);
}

describe('ymdToCDMXNoonInstant', () => {
  it('round-trips the exact calendar day through getYMDInTourTZ', () => {
    const days = [
      { year: 2026, month: 8, day: 14 },
      { year: 2026, month: 1, day: 1 }, // year boundary
      { year: 2026, month: 12, day: 31 }, // year boundary
      { year: 2028, month: 2, day: 29 }, // leap day
      { year: 2026, month: 7, day: 31 }, // month boundary
    ];
    for (const ymd of days) {
      expect(getYMDInTourTZ(ymdToCDMXNoonInstant(ymd))).toEqual(ymd);
    }
  });

  it('produces the clicked day in the availability/checkout payload format', () => {
    // This is the exact path the wizard follows: clicked Y/M/D → canonical
    // instant → YYYY-MM-DD string sent to /api/booking/availability and
    // /api/booking/checkout. Both must be the day the user clicked.
    expect(getTourDayISO(ymdToCDMXNoonInstant({ year: 2026, month: 8, day: 14 }))).toBe(
      '2026-08-14'
    );
    expect(getTourDayISO(ymdToCDMXNoonInstant({ year: 2026, month: 1, day: 1 }))).toBe(
      '2026-01-01'
    );
  });

  it('documents the old bug: local midnight east of UTC-6 shifts the payload day by -1', () => {
    // A Europe/Madrid (UTC+1) device clicking "Aug 14" used to create
    // 2026-08-13T23:00:00Z — which CDMX reads as Aug 13.
    const madridMidnightAug14 = localMidnightInstant(2026, 8, 14, +1);
    expect(getTourDayISO(madridMidnightAug14)).toBe('2026-08-13'); // the bug
    // The canonical instant keeps the clicked day.
    expect(getTourDayISO(ymdToCDMXNoonInstant({ year: 2026, month: 8, day: 14 }))).toBe(
      '2026-08-14'
    );
  });

  it('stays on the clicked day even for devices far west of CDMX', () => {
    // Noon CDMX = 18:00 UTC — inside the CDMX day from any consumer that
    // reads it back through getYMDInTourTZ. (A CDMX-midnight anchor would
    // have been fragile for the same reason local midnight was.)
    const instant = ymdToCDMXNoonInstant({ year: 2026, month: 8, day: 14 });
    expect(instant.toISOString()).toBe('2026-08-14T18:00:00.000Z');
  });
});

describe('today-in-CDMX gating with the canonical instant', () => {
  // now = 2026-08-14T05:00:00Z → CDMX is Aug 13, 23:00 (today = Aug 13),
  // while a Madrid device's local calendar already says Aug 14.
  const now = new Date('2026-08-14T05:00:00Z');

  it('keeps "today in CDMX" selectable regardless of device timezone', () => {
    const cdmxToday = ymdToCDMXNoonInstant({ year: 2026, month: 8, day: 13 });
    expect(isDateBeforeTodayInTourTZ(cdmxToday, now)).toBe(false);
  });

  it('documents the old bug: local-midnight "today" east of UTC-6 was always disabled', () => {
    // Madrid device clicking the CDMX-today cell (Aug 13) built local
    // midnight Aug 13 = 2026-08-12T23:00:00Z → CDMX Aug 12 → "before today".
    const madridMidnightAug13 = localMidnightInstant(2026, 8, 13, +1);
    expect(isDateBeforeTodayInTourTZ(madridMidnightAug13, now)).toBe(true);
  });
});

describe('weekday gating with the canonical instant', () => {
  // 2026-08-14 is a Friday. A tour open only on Fridays must accept the
  // clicked Friday cell no matter the device timezone.
  const fridayOnlyTour = { availableDays: ['5'] };

  it('gates by the CDMX weekday of the clicked day', () => {
    const clickedFriday = ymdToCDMXNoonInstant({ year: 2026, month: 8, day: 14 });
    expect(isDateBookableForTour(clickedFriday, fridayOnlyTour)).toBe(true);
  });

  it('documents the old bug: open weekdays shifted for devices east of UTC-6', () => {
    // Madrid local midnight of the clicked Friday reads as Thursday in CDMX.
    const madridMidnightFriday = localMidnightInstant(2026, 8, 14, +1);
    expect(isDateBookableForTour(madridMidnightFriday, fridayOnlyTour)).toBe(false);
  });
});
