import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '../../../../i18n/navigation';
import { type Locale } from '../../../../i18n/routing';
import { getPayload } from '../../../../src/lib/payload';
import type { Media, Tour } from '../../../../src/payload-types';

// CMS-driven detail page: rendered on demand and cached with ISR. The build no
// longer queries the database — new/updated tours appear without a redeploy.
// Unknown slugs that aren't published resolve to `notFound()` inside the page.
export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tour = await fetchPublishedTour(slug, locale as Locale);
  if (!tour) return { title: 'Tour not found' };

  return {
    title: tour.title,
    description: tour.shortDescription,
    openGraph: {
      title: tour.title,
      description: tour.shortDescription,
      type: 'article',
      locale,
    },
    alternates: {
      languages: {
        en: `/en/tours/${tour.slug}`,
        es: `/es/tours/${tour.slug}`,
      },
    },
  };
}

export default async function TourDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tour = await fetchPublishedTour(slug, locale as Locale);
  if (!tour) notFound();

  const t = await getTranslations({ locale, namespace: 'detail' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  const heroMedia = resolveMedia(tour.heroImage);
  const galleryMedia: (Media | null)[] = (tour.gallery ?? []).map((g) => resolveMedia(g.image));
  const categoryLabel = t(`categoryLabel.${tour.category}`);

  return (
    <div>
      <section className="container detail-hero">
        <div className="breadcrumb">
          <Link href="/">{t('back')}</Link>
          <span>/</span>
          <Link href="/#tours">{t('breadcrumbTours')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--ink)' }}>{tour.title}</span>
        </div>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          {categoryLabel} · {tour.duration}
        </div>
        <h1 className="detail-headline">
          {tour.title}
          <em style={{ fontStyle: 'italic', color: 'var(--terra)' }}>.</em>
        </h1>
        <div className="detail-meta">
          <div>
            {t('duration')}
            <strong>{tour.duration}</strong>
          </div>
          {tour.groupSize ? (
            <div>
              {t('group')}
              <strong>{tour.groupSize}</strong>
            </div>
          ) : null}
          {tour.languages ? (
            <div>
              {t('lang')}
              <strong>{tour.languages}</strong>
            </div>
          ) : null}
          {tour.level ? (
            <div>
              {t('level')}
              <strong>{tour.level}</strong>
            </div>
          ) : null}
        </div>
        <div className="gallery-grid">
          <GalleryTile media={heroMedia} label={t('galleryPlaceholder.main')} alt={tour.title} />
          <GalleryTile
            media={galleryMedia[0] ?? null}
            label={t('galleryPlaceholder.detail1')}
            alt={tour.title}
            toneClass={tour.tagColor === 'terra' ? 'terra' : ''}
          />
          <GalleryTile
            media={galleryMedia[1] ?? null}
            label={t('galleryPlaceholder.detail2')}
            alt={tour.title}
            toneClass="dark"
          />
          <GalleryTile
            media={galleryMedia[2] ?? null}
            label={t('galleryPlaceholder.detail3')}
            alt={tour.title}
            toneClass="moss"
          />
          <GalleryTile
            media={galleryMedia[3] ?? null}
            label={t('galleryPlaceholder.detail4')}
            alt={tour.title}
          />
        </div>
      </section>

      <section className="container">
        <div className="detail-body">
          <div className="detail-content">
            {(tour.aboutP1 || tour.aboutP2) && (
              <section>
                <h3>{t('sectionAbout')}</h3>
                {tour.aboutP1 ? <p>{tour.aboutP1}</p> : null}
                {tour.aboutP2 ? <p>{tour.aboutP2}</p> : null}
              </section>
            )}
            {tour.itinerary && tour.itinerary.length > 0 ? (
              <section>
                <h3>{t('sectionItin')}</h3>
                <div>
                  {tour.itinerary.map((it, i) => (
                    <div className="itinerary-item" key={i}>
                      <div className="itinerary-time">{it.time}</div>
                      <div className="itinerary-content">
                        <h4>{it.heading}</h4>
                        <p>{it.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {tour.includes && tour.includes.length > 0 ? (
              <section>
                <h3>{t('sectionIncl')}</h3>
                <div className="includes">
                  {tour.includes.map((inc, i) => (
                    <div className="include-row" key={i}>
                      <span className="include-icon">✓</span>
                      <span>{inc.text}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {(tour.meetingPoint || tour.meetingPointText) && (
              <section>
                <h3>{t('sectionMeet')}</h3>
                {tour.meetingPoint ? (
                  <p>
                    <strong>{tour.meetingPoint}</strong>
                  </p>
                ) : null}
                {tour.meetingPointText ? <p>{tour.meetingPointText}</p> : null}
                <div
                  className="placeholder"
                  data-label={t('mapPlaceholder')}
                  style={{ aspectRatio: '21/9', borderRadius: 4, marginTop: 16 }}
                ></div>
              </section>
            )}
          </div>
          <aside className="booking-sidebar">
            <div className="booking-price">
              <div>
                <div className="price-label">{tCommon('from')}</div>
                <div className="price-amount">${tour.price}</div>
              </div>
              <div className="price-label">{tCommon('perPerson')}</div>
            </div>
            <div className="summary-row total">
              <span>{t('summary.total')}</span>
              <span>${tour.price}</span>
            </div>
            <Link
              href={{ pathname: '/book', query: { tour: tour.slug } }}
              className="btn btn-terra btn-lg"
              style={{ width: '100%', marginTop: 16 }}
            >
              {tNav('book')} →
            </Link>
            <p
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textAlign: 'center',
                color: 'var(--ink-muted)',
                marginTop: 12,
              }}
            >
              {t('freeCancel')}
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}

async function fetchPublishedTour(slug: string, locale: Locale): Promise<Tour | null> {
  const payload = await getPayload();
  const { docs } = await payload.find({
    collection: 'tours',
    locale,
    fallbackLocale: 'en',
    where: {
      and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }],
    },
    limit: 1,
    depth: 1,
  });
  return docs[0] ?? null;
}

function resolveMedia(value: number | Media | null | undefined): Media | null {
  if (!value) return null;
  if (typeof value === 'number') return null;
  return value;
}

function GalleryTile({
  media,
  label,
  alt,
  toneClass = '',
}: {
  media: Media | null;
  label: string;
  alt: string;
  toneClass?: string;
}) {
  if (media?.url) {
    return (
      <div className={`gallery-img ${toneClass}`} style={{ position: 'relative' }}>
        <Image
          src={media.url}
          alt={media.alt ?? alt}
          fill
          sizes="(max-width: 900px) 50vw, 33vw"
          style={{ objectFit: 'cover' }}
        />
      </div>
    );
  }
  return <div className={`gallery-img placeholder ${toneClass}`} data-label={label}></div>;
}
