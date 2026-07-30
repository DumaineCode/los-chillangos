'use client';

import { useMemo, useState } from 'react';

import { getYMDInTourTZ, ymdToCDMXNoonInstant } from '../../lib/booking/availability';

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  locale: 'en' | 'es';
  prevLabel: string;
  nextLabel: string;
  /**
   * Predicate decides whether a calendar cell is clickable. The booking
   * page wires this from `tour.availableDays` + `isDateBeforeTodayInTourTZ`
   * so the calendar disables both closed weekdays and past dates.
   *
   * If omitted, every date is enabled (used by stories / standalone tests).
   */
  isDateAvailable?: (date: Date) => boolean;
};

/**
 * Mini calendar — month grid with prev/next nav.
 *
 * No more hardcoded "Mondays closed" rule. Availability is driven by the
 * `isDateAvailable` prop the parent builds from the tour's `availableDays`
 * field. Locale only drives the month-name + weekday-letter rendering via
 * `Intl.DateTimeFormat`.
 *
 * Calendar-day contract: every `Date` this component emits or feeds into
 * `isDateAvailable` is the CDMX-noon instant of the displayed cell
 * (`ymdToCDMXNoonInstant`), NOT device-local midnight. This keeps the clicked
 * calendar day stable end to end (gating → availability fetch → checkout
 * payload) no matter what timezone the visitor's device is in.
 */
export function MiniCalendar({
  value,
  onChange,
  locale,
  prevLabel,
  nextLabel,
  isDateAvailable,
}: Props) {
  // "Today" on the tour's calendar (CDMX), not the device's — the grid
  // highlights and month defaults must match what is actually bookable.
  const todayYMD = useMemo(() => getYMDInTourTZ(new Date()), []);

  const [view, setView] = useState(() => {
    const anchor = value ? getYMDInTourTZ(value) : todayYMD;
    return { y: anchor.year, m: anchor.month - 1 };
  });

  const bcp47 = locale === 'es' ? 'es-MX' : 'en-US';
  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(bcp47, { month: 'long', year: 'numeric' }).format(
      new Date(view.y, view.m, 1)
    );
  }, [bcp47, view.y, view.m]);

  const weekdayLetters = useMemo(() => {
    // S M T W T F S — start with a Sunday so getDay() lines up with the cell layout.
    const fmt = new Intl.DateTimeFormat(bcp47, { weekday: 'narrow' });
    const seedSunday = new Date(2024, 0, 7); // 2024-01-07 was a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(seedSunday);
      d.setDate(seedSunday.getDate() + i);
      return fmt.format(d);
    });
  }, [bcp47]);

  const firstDay = new Date(view.y, view.m, 1);
  const dow = firstDay.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < dow; i++) {
    cells.push(<div key={`e${i}`} className="cal-day empty" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    // Canonical instant for this cell: noon CDMX on the displayed Y/M/D.
    // Gating, selection, and onChange all receive this same instant so the
    // calendar day can never shift with the device timezone.
    const date = ymdToCDMXNoonInstant({ year: view.y, month: view.m + 1, day: d });
    const isToday =
      view.y === todayYMD.year && view.m + 1 === todayYMD.month && d === todayYMD.day;
    const selected = value ? value.getTime() === date.getTime() : false;
    const disabled = isDateAvailable ? !isDateAvailable(date) : false;

    cells.push(
      <button
        key={d}
        type="button"
        className={`cal-day ${disabled ? 'disabled' : 'available'} ${selected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
        onClick={() => {
          if (!disabled) onChange(date);
        }}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={new Date(view.y, view.m, d).toDateString()}
      >
        {d}
      </button>
    );
  }

  const goPrev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const goNext = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  return (
    <div className="calendar">
      <div className="cal-head">
        <h4 style={{ textTransform: 'capitalize' }}>{monthLabel}</h4>
        <div className="cal-nav">
          <button type="button" onClick={goPrev} aria-label={prevLabel}>
            ‹
          </button>
          <button type="button" onClick={goNext} aria-label={nextLabel}>
            ›
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {weekdayLetters.map((letter, i) => (
          <div key={`dow-${i}`} className="cal-dow">
            {letter}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}
