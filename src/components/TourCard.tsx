import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Link } from '../../i18n/navigation';
import type { Locale } from '../../i18n/routing';
import type { Media, Tour } from '../payload-types';

type Props = {
  tour: Tour;
  locale: Locale;
};

/**
 * Tour summary card used on the home grid (Server Component).
 *
 * Falls back gracefully when `heroImage` is just a numeric reference or
 * missing — the seed creates tours without a hero, and the client uploads
 * later in `/admin`. While the photo is missing we render the legacy
 * `placeholder` block so the layout never collapses.
 */
export async function TourCard({ tour, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'common' });

  const media = resolveMedia(tour.heroImage);
  const tagColorClass = tour.tagColor === 'terra' ? 'terra' : '';

  return (
    <Link href={`/tours/${tour.slug}`} className="tour-card">
      <div
        className={`tour-card-img ${media ? '' : 'placeholder'} ${tour.tagColor ?? ''}`}
        data-label={tour.photoDescription ?? ''}
      >
        {media?.url ? (
          <Image
            src={media.url}
            alt={media.alt ?? tour.title}
            fill
            sizes="(max-width: 900px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        ) : null}
        {tour.tag ? <span className={`tour-card-tag ${tagColorClass}`}>{tour.tag}</span> : null}
      </div>
      <div className="tour-card-meta">
        <span>{tour.duration}</span>
        {tour.distance ? <span>{tour.distance}</span> : <span aria-hidden="true">—</span>}
      </div>
      <h3 className="tour-card-title">{tour.title}</h3>
      <p className="tour-card-desc">{tour.shortDescription}</p>
      <div className="tour-card-foot">
        <span className="tour-card-price">
          ${tour.price}
          <small>USD {t('perPersonShort')}</small>
        </span>
        <span className="tour-card-cta">{t('view')}</span>
      </div>
    </Link>
  );
}

function resolveMedia(value: Tour['heroImage']): Media | null {
  if (!value) return null;
  if (typeof value === 'number') return null;
  return value;
}
