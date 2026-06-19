import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Link } from '../../../i18n/navigation';
import { routing, type Locale } from '../../../i18n/routing';
import { resolveMediaUrl } from '../../lib/seasonal/resolveMediaUrl';
import type { Tour } from '../../payload-types';

/**
 * Format an ISO date string for display, defensively.
 *
 * `Intl.DateTimeFormat` throws `RangeError: Incorrect locale information
 * provided` when handed an empty/garbage locale — which can happen when this
 * RSC is rendered for non-locale requests (favicon, apple-touch-icon, etc.)
 * before the locale guard rejects them. A seasonal date banner must NEVER crash
 * the page, so we fall back to the default locale and swallow formatting errors.
 */
function formatEventDate(eventDate: string, locale: Locale): string | null {
  const safeLocale = routing.locales.includes(locale) ? locale : routing.defaultLocale;
  try {
    return new Intl.DateTimeFormat(safeLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(eventDate));
  } catch {
    return null;
  }
}

type Props = {
  tour: Tour | null;
  eyebrow: string;
  locale: Locale;
};

/**
 * Landing-page highlight banner for the active seasonal tour.
 *
 * Renders ONLY when a resolved tour is passed in (the caller already enforced
 * enabled + published + isSeasonal). When `tour` is null it returns `null`, so
 * the landing has zero layout node and zero layout shift.
 */
export function HighlightSeasonal({ tour, eyebrow, locale }: Props) {
  const t = useTranslations('seasonal');
  if (!tour) return null;

  const seasonal = tour.seasonal ?? {};
  const hero = seasonal.seasonalHero;
  const imageUrl = resolveMediaUrl(hero?.image) ?? resolveMediaUrl(hero?.poster);

  const formattedDate = seasonal.eventDate ? formatEventDate(seasonal.eventDate, locale) : null;

  return (
    <section className="section highlight-seasonal-section">
      <div className="container">
        <Link href={`/tours/${tour.slug}`} className="highlight-seasonal">
          <div className="highlight-seasonal-media">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={tour.title}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
            ) : null}
          </div>
          <div className="highlight-seasonal-body">
            <div className="eyebrow mono">{eyebrow}</div>
            <h2 className="highlight-seasonal-title">{tour.title}</h2>
            {seasonal.tagline ? (
              <p className="highlight-seasonal-tagline">{seasonal.tagline}</p>
            ) : null}
            <div className="highlight-seasonal-meta mono">
              {formattedDate ? <span>{formattedDate}</span> : null}
              {seasonal.eventLocation ? <span>{seasonal.eventLocation}</span> : null}
            </div>
            <span className="highlight-seasonal-cta">{t('viewEvent')} →</span>
          </div>
        </Link>
      </div>
    </section>
  );
}
