import { useTranslations } from 'next-intl';

import { Link } from '../../../i18n/navigation';
import type { Locale } from '../../../i18n/routing';
import type { Tour } from '../../payload-types';
import { EventStory } from './EventStory';
import { SeasonalGallery } from './SeasonalGallery';
import { SeasonalHero } from './SeasonalHero';

type Props = {
  tour: Tour;
  locale: Locale;
};

/**
 * Seasonal detail template.
 *
 * Rendered by the tour detail route when `tour.isSeasonal` is true. Composes
 * the cinematic hero, storytelling, and gallery, and REUSES the standard
 * booking sidebar verbatim — seasonal tours book through the exact same flow
 * (timeSlots/capacity/Stripe); `eventDate` is display-only.
 *
 * Uses `useTranslations`, which next-intl resolves on the server in RSC and
 * via `NextIntlClientProvider` in tests.
 */
export function SeasonalTourLayout({ tour, locale }: Props) {
  const t = useTranslations('seasonal');
  const tCommon = useTranslations('common');
  const tDetail = useTranslations('detail');
  const tNav = useTranslations('nav');

  const seasonal = tour.seasonal ?? {};

  return (
    <div className="seasonal-detail">
      <SeasonalHero
        seasonal={seasonal}
        title={tour.title}
        locale={locale}
        dateLabel={t('dateLabel')}
        locationLabel={t('locationLabel')}
      />

      <section className="container">
        <div className="detail-body">
          <div className="detail-content">
            <EventStory storytelling={seasonal.storytelling} eyebrow={t('storyEyebrow')} />
            <SeasonalGallery
              gallery={seasonal.gallery}
              eyebrow={t('galleryEyebrow')}
              title={tour.title}
            />
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
              <span>{tDetail('summary.total')}</span>
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
              {tDetail('freeCancel')}
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
