import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '../../../../i18n/navigation';
import { type Locale } from '../../../../i18n/routing';
import { InquiryCta } from '../../../../src/components/rentals/InquiryCta';
import { RefreshRouteOnSave } from '../../../../src/components/RefreshRouteOnSave';
import { resolveMediaImage } from '../../../../src/lib/media';
import { getPayload } from '../../../../src/lib/payload';
import type { Media, Rental } from '../../../../src/payload-types';

// CMS-driven detail page: rendered on demand and cached with ISR, mirroring the
// tour detail route. Unknown/unpublished slugs resolve to notFound() (404).
export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const rental = await fetchPublishedRental(slug, locale as Locale);
  if (!rental) {
    const t = await getTranslations({ locale, namespace: 'rentals' });
    return { title: t('detail.metaNotFound') };
  }

  return {
    title: rental.name,
    description: rental.description ?? undefined,
    openGraph: {
      title: rental.name,
      description: rental.description ?? undefined,
      type: 'article',
      locale,
    },
    alternates: {
      languages: {
        en: `/en/rentals/${rental.slug}`,
        es: `/es/rentals/${rental.slug}`,
      },
    },
  };
}

export default async function RentalDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { isEnabled: isDraft } = await draftMode();
  const rental = await fetchRentalForRender(slug, locale as Locale);
  if (!rental) notFound();

  const t = await getTranslations({ locale, namespace: 'rentals' });

  const heroMedia = resolveMedia(rental.heroImage);
  const galleryMedia: (Media | null)[] = (rental.gallery ?? []).map((g) => resolveMedia(g.image));
  // Adaptive gallery: only tiles backed by a real image render, so the grid
  // reshapes to the actual photo count. Hero leads, then gallery photos; capped
  // at 5 (the grid's max layout).
  const galleryTiles: Media[] = [heroMedia, ...galleryMedia]
    .filter((m): m is Media => Boolean(m?.url))
    .slice(0, 5);

  // Accessories that actually carry content (a name). Each renders its photo
  // (when present), localized name, and optional informative price (verbatim).
  const accessories = (rental.accessories ?? []).filter((a) => Boolean(a?.name));

  return (
    <div>
      {isDraft ? <RefreshRouteOnSave /> : null}
      <section className="container detail-hero">
        <div className="breadcrumb">
          <Link href="/">{t('detail.back')}</Link>
          <span>/</span>
          <Link href="/rentals">{t('detail.breadcrumb')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--ink)' }}>{rental.name}</span>
        </div>
        <h1 className="detail-headline">
          {rental.name}
          <em style={{ fontStyle: 'italic', color: 'var(--terra)' }}>.</em>
        </h1>
        {galleryTiles.length > 0 ? (
          <div className="gallery-grid" data-count={galleryTiles.length}>
            {galleryTiles.map((media, i) => (
              <GalleryTile key={media.id ?? i} media={media} alt={rental.name} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="container">
        <div className="detail-body">
          <div className="detail-content">
            {rental.description ? (
              <section>
                <p>{rental.description}</p>
              </section>
            ) : null}
            {rental.characteristics ? (
              <section>
                <h3>{t('detail.sectionCharacteristics')}</h3>
                <p>{rental.characteristics}</p>
              </section>
            ) : null}
            {accessories.length > 0 ? (
              <section>
                <h3>{t('detail.sectionAccessories')}</h3>
                <div className="tour-grid">
                  {accessories.map((accessory, i) => {
                    const photo = resolveMediaImage(accessory.photo);
                    return (
                      <div className="tour-card" data-testid="accessory" key={accessory.id ?? i}>
                        <div className={`tour-card-img ${photo ? '' : 'placeholder'}`}>
                          {photo ? (
                            <Image
                              src={photo.url}
                              alt={
                                photo.alt ||
                                t('detail.accessoryPhotoAlt', { name: accessory.name })
                              }
                              fill
                              sizes="(max-width: 900px) 50vw, 33vw"
                              style={{ objectFit: 'cover', objectPosition: photo.objectPosition }}
                            />
                          ) : null}
                        </div>
                        <h4 className="tour-card-title">{accessory.name}</h4>
                        {accessory.price ? (
                          <span className="tour-card-price">{accessory.price}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
          <aside className="booking-sidebar">
            <div className="booking-price">
              <div>
                <div className="price-label">{t('detail.priceLabel')}</div>
                {rental.price ? <div className="price-amount">{rental.price}</div> : null}
              </div>
            </div>
            {/*
              Inquiry CTA slot (rentals-inquiry-cta seam, R7). The CTA POSTs to
              /api/contact carrying the bike slug as `rental`. The detail page
              displays accessories but exposes no selection UI, so no accessory
              ids are referenced here — the swappable Phase B seam stays minimal.
            */}
            <div data-testid="inquiry-cta-slot">
              <InquiryCta
                locale={locale}
                rental={slug}
                accessories={[]}
                strings={{
                  heading: t('inquiry.heading'),
                  seededMessage: t('inquiry.seededMessage', { bikeName: rental.name }),
                  nameLabel: t('inquiry.nameLabel'),
                  namePlaceholder: t('inquiry.namePlaceholder'),
                  emailLabel: t('inquiry.emailLabel'),
                  emailPlaceholder: t('inquiry.emailPlaceholder'),
                  messageLabel: t('inquiry.messageLabel'),
                  submit: t('inquiry.submit'),
                  sending: t('inquiry.sending'),
                  successTitle: t('inquiry.successTitle'),
                  successBody: t('inquiry.successBody'),
                  sendAnother: t('inquiry.sendAnother'),
                  errors: {
                    name: t('inquiry.errors.name'),
                    email: t('inquiry.errors.email'),
                    message: t('inquiry.errors.message'),
                    unexpected: t('inquiry.errors.unexpected'),
                  },
                }}
              />
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

async function fetchPublishedRental(slug: string, locale: Locale): Promise<Rental | null> {
  const payload = await getPayload();
  const { docs } = await payload.find({
    collection: 'rentals',
    locale,
    fallbackLocale: 'en',
    where: {
      and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }],
    },
    limit: 1,
    // depth:2 so hero/gallery/accessory photo URLs hydrate.
    depth: 2,
  });
  return (docs[0] as Rental | undefined) ?? null;
}

/**
 * Fetch the rental for rendering, honoring Live Preview.
 *
 * When Next draft mode is enabled (only after passing through `/next/preview`,
 * which requires an authenticated admin), fetch the latest DRAFT so the client
 * sees unpublished edits re-render live. In every public request draft mode is
 * off and this falls back to the published-only query.
 */
async function fetchRentalForRender(slug: string, locale: Locale): Promise<Rental | null> {
  const { isEnabled: isDraft } = await draftMode();
  if (!isDraft) return fetchPublishedRental(slug, locale);

  const payload = await getPayload();
  const { docs } = await payload.find({
    collection: 'rentals',
    locale,
    fallbackLocale: 'en',
    draft: true,
    overrideAccess: true,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  });
  return (docs[0] as Rental | undefined) ?? null;
}

function resolveMedia(value: number | Media | null | undefined): Media | null {
  if (!value) return null;
  if (typeof value === 'number') return null;
  return value;
}

function GalleryTile({ media, alt }: { media: Media; alt: string }) {
  // Route through the shared resolver so the tile (hero AND every gallery image)
  // frames by its own focal point and shares the cache-bust/version token.
  const resolved = resolveMediaImage(media);
  if (!resolved) return null;
  return (
    <div className="gallery-img" style={{ position: 'relative' }}>
      <Image
        src={resolved.url}
        alt={media.alt ?? alt}
        fill
        sizes="(max-width: 900px) 50vw, 33vw"
        style={{ objectFit: 'cover', objectPosition: resolved.objectPosition }}
      />
    </div>
  );
}
