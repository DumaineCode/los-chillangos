import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing, type Locale } from '../../../../i18n/routing';
import { getPayload } from '../../../../src/lib/payload';
import { SuccessPoll } from './SuccessPoll';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string; session_id?: string }>;
};

/**
 * /[locale]/book/success — RSC.
 *
 * Loads the booking by `?ref=LC-...`. Three render branches:
 *   - `paid`    → show the confirmed booking with reference, tour, totals.
 *   - `pending` → mount `<SuccessPoll>` which refetches via the dedicated
 *     status endpoint every 3s for up to 30s; if it never flips, show a
 *     timeout message. (The Stripe webhook should land within seconds, but
 *     async payment methods + retries can take longer.)
 *   - missing → 404.
 *
 * NB: this RSC does not call Stripe. The webhook is the source of truth.
 * The optional `?session_id=` is currently ignored — kept in the URL for
 * future use (audit trail, Stripe dashboard link, etc.).
 */
export default async function SuccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { ref } = await searchParams;
  setRequestLocale(locale);

  if (!ref) notFound();

  const booking = await loadBookingByReference(ref);
  if (!booking) notFound();

  const t = await getTranslations({ locale, namespace: 'booking.success' });
  const tour = booking.tour as { title?: string } | number | undefined;
  const tourTitle = typeof tour === 'object' ? (tour?.title ?? '') : '';

  if (booking.status === 'paid') {
    return (
      <ConfirmedView
        title={t('title')}
        reference={booking.reference}
        tourTitle={tourTitle}
        date={booking.date}
        time={booking.time}
        totalPersons={booking.totalPersons}
        totalAmount={booking.totalAmount}
        currency={booking.currency}
        labels={{
          reference: t('referenceLabel'),
          tour: t('tourLabel'),
          date: t('dateLabel'),
          time: t('timeLabel'),
          persons: t('personsLabel'),
          total: t('totalLabel'),
        }}
        locale={locale as Locale}
      />
    );
  }

  // Pending: hand off to the polling client component. It will refetch
  // and re-render this same page after each poll iteration.
  return (
    <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
      <h1>{t('pendingTitle')}</h1>
      <p className="lede" style={{ marginTop: 16 }}>
        {t('pendingMessage')}
      </p>
      <p style={{ marginTop: 16, color: 'var(--ink-muted)' }}>
        {t('referenceLabel')}: <strong>{booking.reference}</strong>
      </p>
      <SuccessPoll reference={booking.reference} timeoutMessage={t('timeoutMessage')} />
    </div>
  );
}

type ConfirmedViewProps = {
  title: string;
  reference: string;
  tourTitle: string;
  date: string;
  time: string;
  totalPersons: number;
  totalAmount: number;
  currency: string;
  labels: {
    reference: string;
    tour: string;
    date: string;
    time: string;
    persons: string;
    total: string;
  };
  locale: Locale;
};

function ConfirmedView({
  title,
  reference,
  tourTitle,
  date,
  time,
  totalPersons,
  totalAmount,
  currency,
  labels,
  locale,
}: ConfirmedViewProps) {
  const fmtDate = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));

  const fmtMoney = new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(totalAmount);

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
        <dt>{labels.tour}</dt>
        <dd>{tourTitle}</dd>
        <dt>{labels.date}</dt>
        <dd>{fmtDate}</dd>
        <dt>{labels.time}</dt>
        <dd>{time}</dd>
        <dt>{labels.persons}</dt>
        <dd>{totalPersons}</dd>
        <dt>{labels.total}</dt>
        <dd>{fmtMoney}</dd>
      </dl>
    </div>
  );
}

async function loadBookingByReference(reference: string): Promise<{
  reference: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
  date: string;
  time: string;
  totalPersons: number;
  totalAmount: number;
  currency: string;
  tour: unknown;
} | null> {
  const payload = await getPayload();
  const result = await payload.find({
    collection: 'bookings',
    where: { reference: { equals: reference } },
    limit: 1,
    depth: 1, // populate tour so we can show the title
    overrideAccess: true,
  });
  const docs = (result as unknown as { docs?: Array<Record<string, unknown>> }).docs ?? [];
  const doc = docs[0];
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return doc as any;
}
