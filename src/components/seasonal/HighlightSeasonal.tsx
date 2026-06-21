import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Link } from '../../../i18n/navigation';
import { routing, type Locale } from '../../../i18n/routing';
import { resolveMediaImage } from '../../lib/media';
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
  const image = resolveMediaImage(hero?.image) ?? resolveMediaImage(hero?.poster);

  const formattedDate = seasonal.eventDate ? formatEventDate(seasonal.eventDate, locale) : null;

  return (
    <section className="section highlight-seasonal-section">
      <div className="container">
        <div className="section-head highlight-seasonal-head">
          <div>
            <div className="eyebrow highlight-seasonal-eyebrow" style={{ marginBottom: 16 }}>
              <SpecialEventIcon />
              <span>{t('eyebrow')}</span>
            </div>
            <h2 className="section-title">{t('sectionTitle')}</h2>
          </div>
          <p className="section-sub">{t('sectionSub')}</p>
        </div>
        <Link href={`/tours/${tour.slug}`} className="highlight-seasonal">
          <span className="highlight-seasonal-stamp" aria-hidden="true">
            <Image src="/brand/sello-evento.png" alt="" width={120} height={120} />
          </span>
          <div className="highlight-seasonal-media">
            {image ? (
              <Image
                src={image.url}
                alt={tour.title}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectFit: 'cover', objectPosition: image.objectPosition }}
              />
            ) : null}
          </div>
          <div className="highlight-seasonal-body">
            <div className="highlight-seasonal-tags">
              <span className="eyebrow mono">{eyebrow}</span>
              <span className="highlight-seasonal-singledate mono">
                <SpecialEventIcon />
                {t('singleDate')}
              </span>
            </div>
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

/**
 * Calendar-with-star glyph: signals a one-time, special-event date.
 * Inherits `currentColor` so it picks up the surrounding eyebrow color.
 */
function SpecialEventIcon() {
  return (
    <svg
      className="special-event-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L7.8 14.8l2.2-.3z" />
    </svg>
  );
}
