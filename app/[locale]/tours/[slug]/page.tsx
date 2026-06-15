import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '../../../../i18n/navigation';
import { type Locale } from '../../../../i18n/routing';
import { RefreshRouteOnSave } from '../../../../src/components/RefreshRouteOnSave';
import { TourMap } from '../../../../src/components/TourMap';
import { SeasonalTourLayout } from '../../../../src/components/seasonal/SeasonalTourLayout';
import { getPayload } from '../../../../src/lib/payload';
import { shouldRenderSeasonal } from '../../../../src/lib/seasonal/shouldRenderSeasonal';
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

  const { isEnabled: isDraft } = await draftMode();
  const tour = await fetchTourForRender(slug, locale as Locale);
  if (!tour) notFound();

  // Seasonal tours render a dedicated cinematic template; everything else keeps
  // the standard layout below.
  if (shouldRenderSeasonal(tour)) {
    return (
      <>
        {isDraft ? <RefreshRouteOnSave /> : null}
        <SeasonalTourLayout tour={tour} locale={locale as Locale} />
      </>
    );
  }

  const t = await getTranslations({ locale, namespace: 'detail' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  const heroMedia = resolveMedia(tour.heroImage);
  const galleryMedia: (Media | null)[] = (tour.gallery ?? []).map((g) => resolveMedia(g.image));
  // Adaptive gallery: only tiles backed by a real image render, so the grid
  // reshapes to the actual photo count instead of leaving mocked placeholders.
  // Hero leads, then gallery photos; capped at 5 (the grid's max layout).
  const galleryTiles: Media[] = [heroMedia, ...galleryMedia]
    .filter((m): m is Media => Boolean(m?.url))
    .slice(0, 5);
  // Drafts shown in Live Preview can be half-filled — Payload skips required-field
  // validation for drafts, so `category` may be null. Guard the i18n lookup: an
  // unguarded t(`categoryLabel.null`) throws MISSING_MESSAGE and 500s the preview.
  const categoryLabel = tour.category ? t(`categoryLabel.${tour.category}`) : '';

  // meetingLocation is a non-localized group {address, lat, lng} added to the
  // Tours collection. Read it via a narrow local cast so this file does not
  // depend on a regenerated payload-types (which is currently entangled with
  // unrelated parallel work). Render the map only when real coords exist.
  const meetingLocation = (
    tour as { meetingLocation?: { address?: string | null; lat?: number | null; lng?: number | null } | null }
  ).meetingLocation;
  const mapCoords =
    typeof meetingLocation?.lat === 'number' && typeof meetingLocation?.lng === 'number'
      ? { lat: meetingLocation.lat, lng: meetingLocation.lng }
      : null;

  return (
    <div>
      {isDraft ? <RefreshRouteOnSave /> : null}
      <section className="container detail-hero">
        <div className="breadcrumb">
          <Link href="/">{t('back')}</Link>
          <span>/</span>
          <Link href="/#tours">{t('breadcrumbTours')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--ink)' }}>{tour.title}</span>
        </div>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          {[categoryLabel, tour.duration].filter(Boolean).join(' · ')}
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
        {galleryTiles.length > 0 ? (
          <div className="gallery-grid" data-count={galleryTiles.length}>
            {galleryTiles.map((media, i) => (
              <GalleryTile key={media.id ?? i} media={media} alt={tour.title} />
            ))}
          </div>
        ) : null}
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
            {(tour.meetingPoint || tour.meetingPointText || mapCoords) && (
              <section>
                <h3>{t('sectionMeet')}</h3>
                {tour.meetingPoint ? (
                  <p>
                    <strong>{tour.meetingPoint}</strong>
                  </p>
                ) : null}
                {tour.meetingPointText ? <p>{tour.meetingPointText}</p> : null}
                {mapCoords ? (
                  <TourMap
                    lat={mapCoords.lat}
                    lng={mapCoords.lng}
                    label={meetingLocation?.address ?? tour.meetingPoint}
                  />
                ) : (
                  <div
                    className="placeholder"
                    data-label={t('mapPlaceholder')}
                    style={{ aspectRatio: '21/9', borderRadius: 4, marginTop: 16 }}
                  ></div>
                )}
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
    // depth:2 so seasonal hero/gallery/storytelling media URLs hydrate.
    depth: 2,
  });
  return docs[0] ?? null;
}

/**
 * Fetch the tour for rendering, honoring Live Preview.
 *
 * When Next draft mode is enabled (only after passing through `/next/preview`,
 * which requires an authenticated admin), we fetch the latest DRAFT so the
 * client sees unpublished edits re-render live. In every public request draft
 * mode is off and this falls back to the published-only query — identical
 * behavior to before.
 */
async function fetchTourForRender(slug: string, locale: Locale): Promise<Tour | null> {
  const { isEnabled: isDraft } = await draftMode();
  if (!isDraft) return fetchPublishedTour(slug, locale);

  const payload = await getPayload();
  const { docs } = await payload.find({
    collection: 'tours',
    locale,
    fallbackLocale: 'en',
    draft: true,
    overrideAccess: true,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  });
  return docs[0] ?? null;
}

function resolveMedia(value: number | Media | null | undefined): Media | null {
  if (!value) return null;
  if (typeof value === 'number') return null;
  return value;
}

function GalleryTile({ media, alt }: { media: Media; alt: string }) {
  if (!media.url) return null;
  return (
    <div className="gallery-img" style={{ position: 'relative' }}>
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
