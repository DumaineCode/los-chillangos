'use client';

import { useTranslations } from 'next-intl';

import type { WizardExtra } from './BookingFlow';

type Props = {
  adults: number;
  teens: number;
  /** Extras assigned to this tour (active, resolved). */
  extras: ReadonlyArray<WizardExtra>;
  /** IDs of currently-selected extras. */
  selectedExtraIds: ReadonlyArray<number>;
  pricePerAdult: number;
  /** Per-slot capacity from `tour.timeSlots[].capacity`. Defaults to 8 for safety. */
  slotCapacity: number;
  locale: 'en' | 'es';
  onAdultsChange: (n: number) => void;
  onTeensChange: (n: number) => void;
  onToggleExtra: (id: number, selected: boolean) => void;
  error?: string | null;
};

export function StepPeople({
  adults,
  teens,
  extras,
  selectedExtraIds,
  slotCapacity,
  onAdultsChange,
  onTeensChange,
  onToggleExtra,
  error,
}: Props) {
  const t = useTranslations('booking.steps.people');
  const tErr = useTranslations('booking.errors');

  const cap = Math.max(1, Math.trunc(slotCapacity));
  const groupAtMax = adults + teens >= cap;

  return (
    <div data-testid="booking-step-2">
      <h2>{t('title')}</h2>

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

      {extras.length > 0 ? (
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
            {t('extrasTitle')}
          </h3>
          {extras.map((extra) => {
            const selected = selectedExtraIds.includes(extra.id);
            return (
              <label
                key={extra.id}
                className="stepper-row"
                style={{
                  cursor: 'pointer',
                  borderTop: '1px solid var(--line)',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <div className="stepper-info">
                  <h4>{extra.name}</h4>
                  {extra.disclaimer ? (
                    <p title={extra.disclaimer}>{extra.disclaimer}</p>
                  ) : null}
                </div>
                <input
                  type="checkbox"
                  aria-label={extra.name}
                  checked={selected}
                  onChange={(e) => onToggleExtra(extra.id, e.target.checked)}
                  style={{ width: 22, height: 22, accentColor: 'var(--terra)' }}
                />
              </label>
            );
          })}
        </>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: 'var(--terra)', marginTop: 16, fontSize: 14 }}>
          {tErr(error.replace(/^errors\./, ''))}
        </p>
      ) : null}
    </div>
  );
}
