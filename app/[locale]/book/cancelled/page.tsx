import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing } from '../../../../i18n/routing';
import { getPayload } from '../../../../src/lib/payload';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
};

/**
 * /[locale]/book/cancelled — Stripe returns here when the customer aborts
 * Checkout. The booking row is still `pending` at this point — the lazy
 * sweep / cron will flip it to `expired` after `holdExpiresAt` lapses, or
 * the webhook's `checkout.session.expired` will, whichever fires first.
 *
 * We don't actively cancel here because the customer might recover (e.g.
 * back button on Stripe). They get a clear "you can retry" path.
 */
export default async function CancelledPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { ref } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'booking.cancelled' });

  // Best-effort: look up the booking so we can route back to the same tour.
  let retryHref = `/${locale}/book`;
  if (ref) {
    const payload = await getPayload();
    const result = await payload.find({
      collection: 'bookings',
      where: { reference: { equals: ref } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    });
    const doc = (result as { docs?: Array<{ tour?: { slug?: string } | number }> }).docs?.[0];
    const tour = doc?.tour;
    const tourSlug = typeof tour === 'object' ? tour?.slug : undefined;
    if (tourSlug) retryHref = `/${locale}/book?tour=${tourSlug}`;
  }

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
        href={retryHref}
        className="btn btn-terra btn-lg"
        style={{ marginTop: 32, display: 'inline-block' }}
      >
        {t('retryCta')} →
      </Link>
    </div>
  );
}
