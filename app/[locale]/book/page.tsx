import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing, type Locale } from '../../../i18n/routing';
import { BookingFlow } from '../../../src/components/booking/BookingFlow';
import { getPayload } from '../../../src/lib/payload';
import type { Tour } from '../../../src/payload-types';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tour?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'booking' });

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: {
      languages: {
        en: '/en/book',
        es: '/es/book',
      },
    },
  };
}

export default async function BookPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { tour: tourParam } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'booking' });

  const payload = await getPayload();
  const [tour, contact] = await Promise.all([
    fetchTourForBooking(tourParam, locale as Locale),
    payload
      .findGlobal({
        slug: 'contact-info',
        locale: locale as Locale,
        fallbackLocale: 'en',
      })
      .catch(() => null),
  ]);

  if (!tour) {
    return (
      <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
        <h1>{t('pageTitle')}</h1>
        <p className="lede" style={{ marginTop: 16 }}>
          {t('noPublishedTour')}
        </p>
      </div>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://loschillangos.com';

  return (
    <BookingFlow
      tour={{
        id: tour.id,
        // slug is auto-generated and optional in the schema, but /book only ever
        // receives a PUBLISHED tour (which always has one). Fallback satisfies the
        // string type without changing runtime behavior.
        slug: tour.slug ?? '',
        title: tour.title,
        category: tour.category,
        price: tour.price,
        availableDays: tour.availableDays ?? [],
        timeSlots: (tour.timeSlots ?? []).map((s) => ({ time: s.time, capacity: s.capacity })),
        // Seasonal gating fields. WITHOUT these the calendar silently falls
        // back to the weekday model and shows the wrong open days (the server
        // still rejects out-of-window dates, but the UX would mislead).
        isSeasonal: tour.isSeasonal ?? false,
        seasonal: tour.seasonal?.seasonWindow
          ? { seasonWindow: tour.seasonal.seasonWindow }
          : null,
      }}
      contact={{
        whatsapp: contact?.whatsapp ?? '',
        email: contact?.email ?? '',
      }}
      siteUrl={siteUrl}
      locale={locale as Locale}
    />
  );
}

/**
 * Look up the published tour for the booking page.
 *
 * Priority:
 *   1. The slug from `?tour=` if it resolves to a published tour
 *   2. The first published tour in the catalog (fallback when the query
 *      param is missing or points at a draft/unknown slug)
 *   3. `null` (no published tours yet — page shows the "noPublishedTour"
 *      placeholder)
 */
async function fetchTourForBooking(
  slugFromQuery: string | undefined,
  locale: Locale
): Promise<Tour | null> {
  const payload = await getPayload();

  if (slugFromQuery) {
    const { docs } = await payload.find({
      collection: 'tours',
      locale,
      fallbackLocale: 'en',
      where: {
        and: [{ slug: { equals: slugFromQuery } }, { _status: { equals: 'published' } }],
      },
      limit: 1,
      depth: 0,
    });
    if (docs[0]) return docs[0];
  }

  const { docs } = await payload.find({
    collection: 'tours',
    locale,
    fallbackLocale: 'en',
    where: { _status: { equals: 'published' } },
    limit: 1,
    depth: 0,
  });
  return docs[0] ?? null;
}
