'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { formatDurationLabel } from './duration';

/** One advisory (startTime × tier) cell from GET /api/rental/availability. */
export type RentalCombo = {
  startTime: string;
  durationMinutes: number;
  unitPrice: number;
  maxQuantity: number;
};

type Props = {
  /** All combos returned for the chosen day. */
  combos: ReadonlyArray<RentalCombo>;
  /** The start time picked in step 1. */
  startTime: string;
  /** Currently selected duration tier (minutes), or null. */
  durationMinutes: number | null;
  quantity: number;
  locale: 'en' | 'es';
  onDurationChange: (durationMinutes: number) => void;
  onQuantityChange: (quantity: number) => void;
  error?: string | null;
};

/**
 * Step 2 of the rental wizard — duration tier + bike quantity.
 *
 * The tier chips are the combos for the chosen start time (each already carries
 * its own `maxQuantity`, computed by the SAME server sweep the checkout uses).
 * The quantity stepper is bounded by the selected tier's `maxQuantity`; the
 * client never sends a price — this is purely a live preview.
 */
export function RentalOptions({
  combos,
  startTime,
  durationMinutes,
  quantity,
  locale,
  onDurationChange,
  onQuantityChange,
  error,
}: Props) {
  const t = useTranslations('rentals.flow');

  // Tiers offered at the chosen start time, ordered by duration.
  const tiers = useMemo(
    () =>
      combos
        .filter((c) => c.startTime === startTime)
        .sort((a, b) => a.durationMinutes - b.durationMinutes),
    [combos, startTime]
  );

  const selected = useMemo(
    () => tiers.find((tier) => tier.durationMinutes === durationMinutes) ?? null,
    [tiers, durationMinutes]
  );

  const maxQuantity = selected?.maxQuantity ?? 1;
  const total = selected ? selected.unitPrice * quantity : 0;
  const money = (n: number) =>
    `$${new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { maximumFractionDigits: 0 }).format(n)}`;

  return (
    <div data-testid="rental-step-2">
      <h2>{t('steps.options.title')}</h2>

      <h3 style={sectionHeading}>{t('steps.options.durationTitle')}</h3>
      <div className="timeslots">
        {tiers.map((tier) => (
          <button
            key={tier.durationMinutes}
            type="button"
            data-testid={`rental-tier-${tier.durationMinutes}`}
            className={`timeslot ${durationMinutes === tier.durationMinutes ? 'selected' : ''}`}
            onClick={() => onDurationChange(tier.durationMinutes)}
            aria-pressed={durationMinutes === tier.durationMinutes}
          >
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 20, display: 'block' }}>
              {formatDurationLabel(tier.durationMinutes, t)}
            </strong>
            <small style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{money(tier.unitPrice)}</small>
          </button>
        ))}
      </div>

      {selected ? (
        <>
          <h3 style={sectionHeading}>{t('steps.options.quantityTitle')}</h3>
          <div className="stepper-grid">
            <div className="stepper-row">
              <div className="stepper-info">
                <h4>{t('summary.bikes')}</h4>
                <p>{t('steps.options.quantityHint', { max: maxQuantity })}</p>
              </div>
              <div className="stepper-controls">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease bikes"
                >
                  −
                </button>
                <span className="stepper-count">{quantity}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                  disabled={quantity >= maxQuantity}
                  aria-label="Increase bikes"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div
            className="summary-row total"
            style={{ marginTop: 24, fontSize: 20 }}
            data-testid="rental-price-preview"
          >
            <span>{t('steps.options.pricePreview')}</span>
            <span>{money(total)}</span>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: 'var(--terra)', marginTop: 16, fontSize: 14 }}>
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </div>
  );
}

const sectionHeading = {
  fontFamily: 'var(--serif)',
  fontSize: 24,
  fontWeight: 400,
  margin: '40px 0 16px',
  letterSpacing: '-0.01em',
} as const;
