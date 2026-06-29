import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { type Locale } from '../../../i18n/routing';
import { RentalCard } from '../../../src/components/RentalCard';
import { getPayload } from '../../../src/lib/payload';
import type { Rental } from '../../../src/payload-types';

// CMS-driven catalog: rendered on demand and cached with ISR, mirroring the
// home tour grid. The build never queries the database; new/updated rentals
// surface within the revalidate window without a redeploy. Drafts are excluded
// at the query (published-only), so they never reach this public page.
export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'rentals' });

  return {
    title: t('catalog.metaTitle'),
    description: t('catalog.metaDescription'),
    openGraph: {
      title: t('catalog.metaTitle'),
      description: t('catalog.metaDescription'),
      type: 'website',
      locale,
    },
    alternates: {
      languages: {
        en: '/en/rentals',
        es: '/es/rentals',
      },
    },
  };
}

export default async function RentalsCatalogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'rentals' });

  const payload = await getPayload();
  const { docs } = await payload.find({
    collection: 'rentals',
    locale: locale as Locale,
    fallbackLocale: 'en',
    where: { _status: { equals: 'published' } },
    limit: 24,
    depth: 1,
  });
  const rentals = docs as Rental[];

  return (
    <div>
      <section className="section" id="rentals" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                {t('catalog.eyebrow')}
              </div>
              <h1 className="section-title">{t('catalog.title')}</h1>
            </div>
            <p className="section-sub">{t('catalog.sub')}</p>
          </div>

          {rentals.length > 0 ? (
            <div className="tour-grid">
              {rentals.map((rental) => (
                <RentalCard key={rental.id} rental={rental} locale={locale as Locale} />
              ))}
            </div>
          ) : (
            <div className="catalog-notfound">
              <p className="catalog-notfound-sub">{t('catalog.empty')}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
