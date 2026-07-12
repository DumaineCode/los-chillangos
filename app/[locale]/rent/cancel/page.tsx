import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing } from '../../../../i18n/routing';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
};

/**
 * /[locale]/rent/cancel — Stripe returns here when the customer aborts rental
 * Checkout. The rental row is still `pending`; the lazy sweep / cron flips it to
 * `expired` once `holdExpiresAt` lapses, or the webhook's `checkout.session.expired`
 * does, whichever fires first. We don't actively cancel here (the customer may
 * recover via the browser back button) and give a clear retry path. Mirrors the
 * booking cancelled page.
 */
export default async function RentalCancelPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { ref } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'rentals.flow.cancelled' });

  return (
    <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
      <h1>{t('title')}</h1>
      <p className="lede" style={{ marginTop: 16 }}>
        {t('message')}
      </p>
      {ref ? (
        <p style={{ marginTop: 12, color: 'var(--ink-muted)', fontFamily: 'monospace' }}>{ref}</p>
      ) : null}
      <Link
        href={`/${locale}/rent`}
        className="btn btn-terra btn-lg"
        style={{ marginTop: 32, display: 'inline-block' }}
      >
        {t('retryCta')} →
      </Link>
    </div>
  );
}
