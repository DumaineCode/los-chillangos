'use client';

import { useTranslations } from 'next-intl';

import { MiniCalendar } from './MiniCalendar';

type Props = {
  date: Date | null;
  time: string;
  timeSlots: readonly string[];
  onDateChange: (d: Date) => void;
  onTimeChange: (t: string) => void;
  locale: 'en' | 'es';
  /** Optional error key from booking.errors.* to display under the date picker. */
  error?: string | null;
};

export function StepDate({
  date,
  time,
  timeSlots,
  onDateChange,
  onTimeChange,
  locale,
  error,
}: Props) {
  const t = useTranslations('booking.steps.date');
  const tErr = useTranslations('booking.errors');
  const tCal = useTranslations('booking.calendar');

  return (
    <div data-testid="booking-step-1">
      <h2>{t('title')}</h2>
      <p className="lede">{t('lede')}</p>
      <MiniCalendar
        value={date}
        onChange={onDateChange}
        locale={locale}
        prevLabel={tCal('prev')}
        nextLabel={tCal('next')}
      />
      {error ? (
        <p role="alert" style={{ color: 'var(--terra)', marginTop: 12, fontSize: 14 }}>
          {tErr(error.replace(/^errors\./, ''))}
        </p>
      ) : null}

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
        {timeSlots.map((slot) => (
          <button
            key={slot}
            type="button"
            className={`timeslot ${time === slot ? 'selected' : ''}`}
            onClick={() => onTimeChange(slot)}
            aria-pressed={time === slot}
          >
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 20, display: 'block' }}>
              {slot}
            </strong>
          </button>
        ))}
      </div>
    </div>
  );
}
