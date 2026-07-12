import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { formatDurationLabel } from '../../../../src/components/rental/duration';
import { routing, type Locale } from '../../../../i18n/routing';
import { getPayload } from '../../../../src/lib/payload';
import { RentalSuccessPoll } from './RentalSuccessPoll';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string; session_id?: string }>;
};

/**
 * /[locale]/rent/success — Stripe returns here after a rental checkout. Mirrors
 * the booking success page:
 *   - `paid`    → confirmed view (reference, date, time, duration, bikes, total)
 *   - `pending` → mount <RentalSuccessPoll> (refetch status until it flips)
 *   - missing   → 404
 *
 * The webhook is the source of truth; this RSC never calls Stripe. `session_id`
 * is kept in the URL for future audit use but is currently ignored.
 */
export default async function RentalSuccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { ref } = await searchParams;
  setRequestLocale(locale);

  if (!ref) notFound();

  const rental = await loadRentalByReference(ref);
  if (!rental) notFound();

  const t = await getTranslations({ locale, namespace: 'rentals.flow.success' });
  const tFlow = await getTranslations({ locale, namespace: 'rentals.flow' });

  if (rental.status === 'paid') {
    return (
      <ConfirmedView
        title={t('title')}
        reference={rental.reference}
        date={rental.date}
        startTime={rental.startTime}
        durationLabel={formatDurationLabel(rental.durationMinutes, tFlow)}
        quantity={rental.quantity}
        totalAmount={rental.totalAmount}
        currency={rental.currency}
        labels={{
          reference: t('referenceLabel'),
          date: t('dateLabel'),
          time: t('timeLabel'),
          duration: t('durationLabel'),
          bikes: t('bikesLabel'),
          total: t('totalLabel'),
        }}
        locale={locale as Locale}
      />
    );
  }

  return (
    <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
      <h1>{t('pendingTitle')}</h1>
      <p className="lede" style={{ marginTop: 16 }}>
        {t('pendingMessage')}
      </p>
      <p style={{ marginTop: 16, color: 'var(--ink-muted)' }}>
        {t('referenceLabel')}: <strong>{rental.reference}</strong>
      </p>
      <RentalSuccessPoll reference={rental.reference} timeoutMessage={t('timeoutMessage')} />
    </div>
  );
}

type ConfirmedViewProps = {
  title: string;
  reference: string;
  date: string;
  startTime: string;
  durationLabel: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  labels: {
    reference: string;
    date: string;
    time: string;
    duration: string;
    bikes: string;
    total: string;
  };
  locale: Locale;
};

function ConfirmedView({
  title,
  reference,
  date,
  startTime,
  durationLabel,
  quantity,
  totalAmount,
  currency,
  labels,
  locale,
}: ConfirmedViewProps) {
  const bcp47 = locale === 'es' ? 'es-MX' : 'en-US';
  const fmtDate = new Intl.DateTimeFormat(bcp47, {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));

  const fmtMoney = new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(totalAmount);

  // Same i18n-backed label the wizard uses, so both screens agree (no untranslated units).

  return (
    <div className="container" style={{ padding: '120px 0' }}>
      <h1 style={{ textAlign: 'center' }}>{title}</h1>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '12px 24px',
          maxWidth: 480,
          margin: '32px auto 0',
        }}
      >
        <dt>{labels.reference}</dt>
        <dd style={{ fontFamily: 'monospace', fontWeight: 600 }}>{reference}</dd>
        <dt>{labels.date}</dt>
        <dd>{fmtDate}</dd>
        <dt>{labels.time}</dt>
        <dd>{startTime}</dd>
        <dt>{labels.duration}</dt>
        <dd>{durationLabel}</dd>
        <dt>{labels.bikes}</dt>
        <dd>{quantity}</dd>
        <dt>{labels.total}</dt>
        <dd>{fmtMoney}</dd>
      </dl>
    </div>
  );
}

async function loadRentalByReference(reference: string): Promise<{
  reference: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
  date: string;
  startTime: string;
  durationMinutes: number;
  quantity: number;
  totalAmount: number;
  currency: string;
} | null> {
  const payload = await getPayload();
  const result = await payload.find({
    collection: 'rentals',
    where: { reference: { equals: reference } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const docs = (result as unknown as { docs?: Array<Record<string, unknown>> }).docs ?? [];
  const doc = docs[0];
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return doc as any;
}
