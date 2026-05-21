'use client';

import { useMemo, useState } from 'react';

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  locale: 'en' | 'es';
  prevLabel: string;
  nextLabel: string;
};

/**
 * Mini calendar — ported from legacy `components/Booking.jsx`.
 *
 * Single-month view with prev/next navigation. All dates from today onwards
 * are clickable except Mondays (closed, per locked PR 5 decision).
 *
 * Pure UI: no persistence, no real availability. Locale only drives the
 * month-name + weekday-letter rendering via `Intl.DateTimeFormat`.
 */
export function MiniCalendar({ value, onChange, locale, prevLabel, nextLabel }: Props) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [view, setView] = useState(() => ({
    y: (value ?? today).getFullYear(),
    m: (value ?? today).getMonth(),
  }));

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
    const date = new Date(view.y, view.m, d);
    const past = date < today;
    const isToday = date.getTime() === today.getTime();
    const selected = value ? value.getTime() === date.getTime() : false;
    const closed = date.getDay() === 1;
    const disabled = past || closed;

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
        aria-label={date.toDateString()}
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
