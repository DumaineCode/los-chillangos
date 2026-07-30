'use client';

import { useTranslations } from 'next-intl';

import { TOUR_TIMEZONE } from '../../lib/booking/availability';
import type { PriceBreakdown } from '../../lib/booking/pricing';

type Props = {
  tourTitle: string;
  date: Date | null;
  time: string;
  adults: number;
  teens: number;
  /** One row per selected extra: its name + computed amount in USD. */
  extraLines: ReadonlyArray<{ id: number; name: string; amount: number }>;
  breakdown: PriceBreakdown;
  locale: 'en' | 'es';
};

/**
 * Reusable summary sidebar — shown on the Details step and the Confirm step.
 *
 * Pure presentation: receives the already-computed breakdown so the same
 * numbers shown here also go into the WhatsApp message body.
 */
export function BookingSummary({
  tourTitle,
  date,
  time,
  adults,
  teens,
  extraLines,
  breakdown,
  locale,
}: Props) {
  const t = useTranslations('booking.summary');

  const bcp47 = locale === 'es' ? 'es-MX' : 'en-US';
  // Format in the tour timezone (CDMX): the selected instant represents a
  // CDMX calendar day, so device-local formatting could show the wrong day.
  const dateStr = date
    ? new Intl.DateTimeFormat(bcp47, {
        timeZone: TOUR_TIMEZONE,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(date)
    : '—';
  // Peso-first display: the whole site charges MXN (no selector), so amounts
  // render with the peso sign `$` in both locales, consistent with the extra
  // price labels (`+$140`) and es-MX. The `MXN` clarifier lives on prominent
  // labels (e.g. the tour card), not baked into every number.
  const currency = (n: number) =>
    `$${new Intl.NumberFormat(bcp47, { maximumFractionDigits: 0 }).format(n)}`;

  return (
    <aside className="cart-summary">
      <div className="cart-body">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {t('title')}
        </div>
        <h3 className="cart-title">{tourTitle}</h3>
        <div className="summary-row">
          <span>{t('date')}</span>
          <span style={{ textTransform: 'capitalize' }}>{dateStr}</span>
        </div>
        <div className="summary-row">
          <span>{t('time')}</span>
          <span>{time || '—'}</span>
        </div>
        <div className="summary-row">
          <span>{t('riders')}</span>
          <span>
            {t('adults', { count: adults })}
            {teens > 0 ? ` · ${t('teens', { count: teens })}` : ''}
          </span>
        </div>
        {extraLines.map((line) => (
          <div className="summary-row" key={line.id}>
            <span>{line.name}</span>
            <span>+{currency(line.amount)}</span>
          </div>
        ))}
        <div
          className="summary-row"
          style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 14 }}
        >
          <span>{t('subtotal')}</span>
          <span>{currency(breakdown.subtotal)}</span>
        </div>
        <div className="summary-row total">
          <span>{t('total')}</span>
          <span>{currency(breakdown.total)}</span>
        </div>
        <p
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            marginTop: 12,
          }}
        >
          {t('totalNote')}
        </p>
      </div>
    </aside>
  );
}
