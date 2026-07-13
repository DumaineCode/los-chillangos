import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Link } from '../../i18n/navigation';
import type { Locale } from '../../i18n/routing';
import { selectCardThumbnail } from '../lib/seasonal/cardThumbnail';
import { BOOKING_CURRENCY } from '../lib/booking/currency';
import type { Tour } from '../payload-types';

type Props = {
  tour: Tour;
  locale: Locale;
};

/**
 * Tour summary card used on the home grid (Server Component).
 *
 * Thumbnail resolution is delegated to `selectCardThumbnail` (pure, tested):
 * gallery[0].image → seasonal hero image → seasonal poster → null. When nothing
 * resolves we render the legacy `placeholder` block so the layout never
 * collapses — the seed creates tours without a gallery and the client uploads
 * photos later in `/admin`.
 *
 * Badge: a seasonal tour (`isSeasonal === true`) always shows the terra
 * "Seasonal/Temporada" badge, taking visual priority over any manual `tag`
 * (urgency wins). Non-seasonal tours keep showing their manual `tag` as before.
 */
export async function TourCard({ tour, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'common' });

  const thumbnail = selectCardThumbnail(tour);
  const isSeasonal = tour.isSeasonal === true;
  const tagColorClass = tour.tagColor ?? '';

  return (
    <Link href={`/tours/${tour.slug}`} className="tour-card">
      <div
        className={`tour-card-img ${thumbnail ? '' : 'placeholder'} ${tour.tagColor ?? ''}`}
        data-label={tour.photoDescription ?? ''}
      >
        {thumbnail ? (
          <Image
            src={thumbnail.url}
            alt={tour.title}
            fill
            sizes="(max-width: 900px) 50vw, 33vw"
            style={{ objectFit: 'cover', objectPosition: thumbnail.objectPosition }}
          />
        ) : null}
        {isSeasonal ? (
          <span className="tour-card-tag seasonal">{t('seasonalBadge')}</span>
        ) : tour.tag ? (
          <span className={`tour-card-tag ${tagColorClass}`}>{tour.tag}</span>
        ) : null}
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
          <small>{BOOKING_CURRENCY} {t('perPersonShort')}</small>
        </span>
        <span className="tour-card-cta">{t('view')}</span>
      </div>
    </Link>
  );
}
