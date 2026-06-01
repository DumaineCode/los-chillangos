'use client';

import { useTranslations } from 'next-intl';

import { calculatePrice } from '../../lib/booking/pricing';

type Props = {
  adults: number;
  teens: number;
  privatize: boolean;
  pricePerAdult: number;
  /** Per-slot capacity from `tour.timeSlots[].capacity`. Defaults to 8 for safety. */
  slotCapacity: number;
  locale: 'en' | 'es';
  onAdultsChange: (n: number) => void;
  onTeensChange: (n: number) => void;
  onPrivatizeChange: (v: boolean) => void;
  error?: string | null;
};

export function StepPeople({
  adults,
  teens,
  privatize,
  pricePerAdult,
  slotCapacity,
  locale,
  onAdultsChange,
  onTeensChange,
  onPrivatizeChange,
  error,
}: Props) {
  const t = useTranslations('booking.steps.people');
  const tErr = useTranslations('booking.errors');
  const tSummary = useTranslations('booking.summary');

  const breakdown = calculatePrice({ pricePerAdult, adults, teens, privatize });
  const totalFormatted = new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(breakdown.total);

  const cap = Math.max(1, Math.trunc(slotCapacity));
  const groupAtMax = adults + teens >= cap;

  return (
    <div data-testid="booking-step-2">
      <h2>{t('title')}</h2>
      <p className="lede">{t('lede')}</p>

      <div className="stepper-grid">
        <div className="stepper-row">
          <div className="stepper-info">
            <h4>{t('adultLabel')}</h4>
            <p>{t('adultHint')}</p>
          </div>
          <div className="stepper-controls">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => onAdultsChange(Math.max(1, adults - 1))}
              disabled={adults <= 1}
              aria-label="Decrease adults"
            >
              −
            </button>
            <span className="stepper-count">{adults}</span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => onAdultsChange(Math.min(cap, adults + 1))}
              disabled={adults >= cap || groupAtMax}
              aria-label="Increase adults"
            >
              +
            </button>
          </div>
        </div>

        <div className="stepper-row">
          <div className="stepper-info">
            <h4>{t('teenLabel')}</h4>
            <p>{t('teenHint')}</p>
          </div>
          <div className="stepper-controls">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => onTeensChange(Math.max(0, teens - 1))}
              disabled={teens <= 0}
              aria-label="Decrease teens"
            >
              −
            </button>
            <span className="stepper-count">{teens}</span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => onTeensChange(Math.min(cap, teens + 1))}
              disabled={teens >= cap || groupAtMax}
              aria-label="Increase teens"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <h3
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 24,
          fontWeight: 400,
          margin: '40px 0 16px',
          letterSpacing: '-0.01em',
        }}
      >
        {t('addonsTitle')}
      </h3>
      <label
        className="stepper-row"
        style={{
          cursor: 'pointer',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="stepper-info">
          <h4>{t('privatizeLabel')}</h4>
          <p>{t('privatizeHint')}</p>
        </div>
        <input
          type="checkbox"
          checked={privatize}
          onChange={(e) => onPrivatizeChange(e.target.checked)}
          style={{ width: 22, height: 22, accentColor: 'var(--terra)' }}
        />
      </label>

      {error ? (
        <p role="alert" style={{ color: 'var(--terra)', marginTop: 16, fontSize: 14 }}>
          {tErr(error.replace(/^errors\./, ''))}
        </p>
      ) : null}

      <div
        style={{
          marginTop: 32,
          padding: '16px 18px',
          borderRadius: 6,
          background: 'var(--cream)',
          border: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{tSummary('total')}</span>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{totalFormatted}</span>
      </div>
    </div>
  );
}
