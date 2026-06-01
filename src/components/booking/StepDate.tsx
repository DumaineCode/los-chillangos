'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  getTimeSlotsForTour,
  isDateBeforeTodayInTourTZ,
  isWeekdayAvailable,
} from '../../lib/booking/availability';
import type { Tour } from '../../payload-types';
import { MiniCalendar } from './MiniCalendar';

/**
 * Tour shape needed by Step 1. We pass the whole tour (already loaded by the
 * booking page) so the date picker can derive everything: weekday gating,
 * the time-slot chips, and the live availability fetch by tour id.
 */
export type StepDateTour = Pick<Tour, 'id' | 'availableDays' | 'timeSlots'>;

type Props = {
  tour: StepDateTour;
  date: Date | null;
  time: string;
  onDateChange: (d: Date) => void;
  onTimeChange: (t: string) => void;
  locale: 'en' | 'es';
  /** Optional error key from booking.errors.* to display under the date picker. */
  error?: string | null;
};

type SlotState = {
  time: string;
  capacity: number;
  seatsTaken: number;
  remaining: number;
  cutoffPassed: boolean;
};

type AvailabilityResponse = { slots: SlotState[] };

export function StepDate({
  tour,
  date,
  time,
  onDateChange,
  onTimeChange,
  locale,
  error,
}: Props) {
  const t = useTranslations('booking.steps.date');
  const tErr = useTranslations('booking.errors');
  const tCal = useTranslations('booking.calendar');
  const tBooking = useTranslations('booking');

  const availableDays = useMemo(() => tour.availableDays ?? [], [tour.availableDays]);
  const baseSlots = useMemo(() => getTimeSlotsForTour(tour), [tour]);
  const isTourPaused = availableDays.length === 0;

  // Predicate that gates calendar cells: closed weekdays + past dates.
  const isDateAvailable = useCallback(
    (d: Date) => isWeekdayAvailable(d, availableDays) && !isDateBeforeTodayInTourTZ(d),
    [availableDays]
  );

  // Live availability per slot for the selected date. Defaults to the static
  // slot capacity (so the chips render before the fetch resolves). If the
  // fetch fails we keep the defaults — fail open; server validation in
  // Sub-etapa C still rejects overbooking on submit.
  const [liveSlots, setLiveSlots] = useState<SlotState[] | null>(null);

  useEffect(() => {
    if (!date || isTourPaused || baseSlots.length === 0) {
      setLiveSlots(null);
      return;
    }
    const isoDate = formatISODate(date);
    const ctrl = new AbortController();

    const url = `/api/booking/availability?tourId=${tour.id}&date=${encodeURIComponent(isoDate)}`;
    fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<AvailabilityResponse>) : null))
      .then((data) => {
        if (!data) return;
        setLiveSlots(data.slots);
      })
      .catch(() => {
        /* fail open — chips render enabled with default capacity */
      });

    return () => ctrl.abort();
  }, [date, isTourPaused, baseSlots.length, tour.id]);

  // Effective slot state: live data when available, fallback to base capacity.
  const effectiveSlots: SlotState[] = useMemo(() => {
    if (liveSlots && liveSlots.length > 0) return liveSlots;
    return baseSlots.map((slot) => ({
      time: slot.time,
      capacity: slot.capacity,
      seatsTaken: 0,
      remaining: slot.capacity,
      cutoffPassed: false,
    }));
  }, [liveSlots, baseSlots]);

  return (
    <div data-testid="booking-step-1">
      <h2>{t('title')}</h2>
      <p className="lede">{t('lede')}</p>

      {isTourPaused ? (
        <p
          role="status"
          style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 6,
            background: 'var(--cream)',
            border: '1px solid var(--line)',
            color: 'var(--ink-soft)',
            fontSize: 14,
          }}
        >
          {tBooking('tourPaused')}
        </p>
      ) : null}

      <MiniCalendar
        value={date}
        onChange={onDateChange}
        locale={locale}
        prevLabel={tCal('prev')}
        nextLabel={tCal('next')}
        isDateAvailable={isDateAvailable}
      />
      {error ? (
        <p role="alert" style={{ color: 'var(--terra)', marginTop: 12, fontSize: 14 }}>
          {tErr(error.replace(/^errors\./, ''))}
        </p>
      ) : null}

      {effectiveSlots.length > 0 ? (
        <>
          <h3
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 24,
              fontWeight: 400,
              margin: '40px 0 16px',
              letterSpacing: '-0.01em',
            }}
          >
            {t('timeTitle')}
          </h3>
          <div className="timeslots">
            {effectiveSlots.map((slot) => {
              const soldOut = slot.remaining === 0;
              const tooLate = slot.cutoffPassed;
              const disabled = soldOut || tooLate;
              const reason = soldOut
                ? tBooking('slotSoldOut')
                : tooLate
                  ? tBooking('slotTooLate')
                  : null;
              return (
                <button
                  key={slot.time}
                  type="button"
                  className={`timeslot ${time === slot.time ? 'selected' : ''}`}
                  onClick={() => {
                    if (!disabled) onTimeChange(slot.time);
                  }}
                  disabled={disabled}
                  aria-pressed={time === slot.time}
                  aria-label={`${slot.time} — ${slot.remaining} ${tBooking('slotSeatsLabel')}`}
                >
                  <strong style={{ fontFamily: 'var(--serif)', fontSize: 20, display: 'block' }}>
                    {slot.time}
                  </strong>
                  <small style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    {reason
                      ? reason
                      : `${slot.remaining} ${tBooking('slotSeatsLabel')}`}
                  </small>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Returns "YYYY-MM-DD" in local wall-clock; matches the route handler's parser. */
function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
