import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Link } from '../../i18n/navigation';
import type { Locale } from '../../i18n/routing';
import { resolveMediaImage } from '../lib/media';
import type { Rental } from '../payload-types';

type Props = {
  rental: Rental;
  locale: Locale;
};

/**
 * Rental summary card used on the `/rentals` catalog grid (Server Component).
 *
 * This is a NEW card — it deliberately does NOT reuse `TourCard`, which
 * hard-reads `tour.price`(number), `duration`, `distance` and links to
 * `/tours/${slug}`. RentalCard is typed to the `Rental` payload type and links
 * to `/rentals/${slug}`. It mirrors TourCard's markup/CSS classes for visual
 * parity (`tour-card*`), so the catalog grid stays consistent with the home
 * tour grid without faking a tour shape.
 *
 * Price is the informative, display-only TEXT value stored on the rental
 * (e.g. "$150/day"). It is rendered VERBATIM — the card applies no math and
 * synthesises no "$"/USD suffix (that is a Tours-only convention).
 *
 * When no hero image resolves we render the legacy `placeholder` block so the
 * layout never collapses — the client uploads the photo later in `/admin`.
 */
export async function RentalCard({ rental, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'rentals' });

  const thumbnail = resolveMediaImage(rental.heroImage);

  return (
    <Link href={`/rentals/${rental.slug}`} className="tour-card">
      <div className={`tour-card-img ${thumbnail ? '' : 'placeholder'}`}>
        {thumbnail ? (
          <Image
            src={thumbnail.url}
            alt={thumbnail.alt || rental.name}
            fill
            sizes="(max-width: 900px) 50vw, 33vw"
            style={{ objectFit: 'cover', objectPosition: thumbnail.objectPosition }}
          />
        ) : null}
      </div>
      <h3 className="tour-card-title">{rental.name}</h3>
      {rental.description ? <p className="tour-card-desc">{rental.description}</p> : null}
      <div className="tour-card-foot">
        {rental.price ? <span className="tour-card-price">{rental.price}</span> : <span />}
        <span className="tour-card-cta">{t('card.view')}</span>
      </div>
    </Link>
  );
}
