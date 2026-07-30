import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getYMDInTourTZ, ymdToCDMXNoonInstant } from '../../lib/booking/availability';
import { MiniCalendar } from './MiniCalendar';

/**
 * Regression tests for the calendar-day timezone contract.
 *
 * MiniCalendar must emit (and gate with) the CDMX-canonical instant of the
 * clicked cell — NOT device-local midnight, which reads as the previous CDMX
 * day on devices east of UTC-6 and shifted the whole booking flow by one day.
 */

function findDayCell(day: number): HTMLButtonElement {
  const cells = screen
    .getAllByRole('button')
    .filter((b) => b.textContent === String(day)) as HTMLButtonElement[];
  expect(cells).toHaveLength(1);
  return cells[0];
}

function renderCalendar(props: Partial<Parameters<typeof MiniCalendar>[0]> = {}) {
  return render(
    <MiniCalendar
      value={null}
      onChange={() => {}}
      locale="en"
      prevLabel="Previous month"
      nextLabel="Next month"
      {...props}
    />
  );
}

beforeEach(() => {
  // Pin the clock (Wednesday 2026-08-12, 12:00 CDMX) so "today in CDMX" is
  // deterministic — no race between render and assertion across a CDMX
  // midnight, and no dependence on the real wall-clock month.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-12T18:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MiniCalendar CDMX day contract', () => {
  it('emits the CDMX-noon instant of the clicked cell, independent of device TZ', () => {
    const onChange = vi.fn();
    renderCalendar({ onChange });

    // The initial view is the current CDMX month; day 15 exists in every month.
    fireEvent.click(findDayCell(15));

    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0] as Date;
    const todayYMD = getYMDInTourTZ(new Date());
    const expected = ymdToCDMXNoonInstant({
      year: todayYMD.year,
      month: todayYMD.month,
      day: 15,
    });
    // Exact-instant equality: the emitted Date must BE the canonical handle,
    // so every consumer (gating, fetch, checkout payload) recovers day 15.
    expect(emitted.getTime()).toBe(expected.getTime());
    expect(getYMDInTourTZ(emitted)).toEqual({ ...todayYMD, day: 15 });
  });

  it('gates cells with the CDMX-canonical instant of each displayed day', () => {
    const seen: Date[] = [];
    renderCalendar({
      isDateAvailable: (d: Date) => {
        seen.push(d);
        return true;
      },
    });

    expect(seen.length).toBeGreaterThanOrEqual(28);
    const todayYMD = getYMDInTourTZ(new Date());
    // Every instant handed to the predicate must land on the displayed
    // (current CDMX) month when re-read in CDMX — day 1 included, which is
    // exactly the cell the old local-midnight code shifted out of the month.
    for (const [i, d] of seen.entries()) {
      const ymd = getYMDInTourTZ(d);
      expect(ymd.year).toBe(todayYMD.year);
      expect(ymd.month).toBe(todayYMD.month);
      expect(ymd.day).toBe(i + 1);
    }
  });

  it('marks the selected cell by instant equality with the emitted value', () => {
    const todayYMD = getYMDInTourTZ(new Date());
    const value = ymdToCDMXNoonInstant({ year: todayYMD.year, month: todayYMD.month, day: 15 });
    renderCalendar({ value });

    expect(findDayCell(15)).toHaveAttribute('aria-pressed', 'true');
  });
});
