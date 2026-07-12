import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing, type Locale } from '../../../i18n/routing';
import { RentalFlow } from '../../../src/components/rental/RentalFlow';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'rentals.flow' });

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: {
      languages: {
        en: '/en/rent',
        es: '/es/rent',
      },
    },
  };
}

/**
 * /[locale]/rent — standalone bike-rental checkout (Batch 3c / PR4).
 *
 * Thin RSC boundary: all availability + validation lives server-side (the
 * availability GET + the authoritative checkout POST). The wizard is a client
 * component that drives its date/time grid off GET /api/rental/availability and
 * redirects to Stripe Checkout on confirm.
 */
export default async function RentPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://loschillangos.com';

  return <RentalFlow siteUrl={siteUrl} locale={locale as Locale} />;
}
