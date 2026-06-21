import Image from 'next/image';

import type { Locale } from '../../../i18n/routing';
import { resolveMediaImage } from '../../lib/media';
import { resolveMediaUrl } from '../../lib/seasonal/resolveMediaUrl';
import type { Tour } from '../../payload-types';

type Props = {
  seasonal: NonNullable<Tour['seasonal']>;
  title: string;
  locale: Locale;
  dateLabel: string;
  locationLabel: string;
};

/**
 * Full-bleed cinematic hero for a seasonal tour.
 *
 * Renders an image OR a (muted, looping) video depending on
 * `seasonalHero.mediaType`, with the poster as the LCP/reduced-motion still.
 * Tagline, event date, and location overlay the media. Degrades gracefully:
 * with no media it still renders the text block (no crash, no empty <img>).
 */
export function SeasonalHero({ seasonal, title, locale, dateLabel, locationLabel }: Props) {
  const hero = seasonal.seasonalHero;
  const isVideo = hero?.mediaType === 'video';
  const videoUrl = resolveMediaUrl(hero?.video);
  const posterUrl = resolveMediaUrl(hero?.poster);
  const image = resolveMediaImage(hero?.image);
  // One object-position frames BOTH the <video> and its poster still. Poster-first:
  // the poster is the focal-annotated LCP/reduced-motion frame, so its focal wins
  // when a poster exists; absent a poster, fall through to the video's own focal,
  // then to centre. Routed through resolveMediaImage to reuse the hydrated-doc guard.
  const videoPosition =
    resolveMediaImage(hero?.poster)?.objectPosition ??
    resolveMediaImage(hero?.video)?.objectPosition ??
    '50% 50%';

  const formattedDate = seasonal.eventDate
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(seasonal.eventDate)
      )
    : null;

  return (
    <section className="seasonal-hero">
      <div className="seasonal-hero-media">
        {isVideo && videoUrl ? (
          <video
            className="seasonal-hero-video"
            src={videoUrl}
            poster={posterUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            style={{ objectFit: 'cover', objectPosition: videoPosition }}
          />
        ) : image ? (
          <Image
            className="seasonal-hero-img"
            src={image.url}
            alt={title}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: image.objectPosition }}
          />
        ) : null}
      </div>
      <div className="container seasonal-hero-inner">
        {formattedDate ? (
          <div className="seasonal-hero-date fade-in" style={{ animationDelay: '0.1s' }}>
            <span className="mono">{dateLabel}</span>
            <span>{formattedDate}</span>
          </div>
        ) : null}
        <h1 className="seasonal-hero-headline">{title}</h1>
        {seasonal.tagline ? (
          <p className="seasonal-hero-tagline fade-in" style={{ animationDelay: '0.25s' }}>
            {seasonal.tagline}
          </p>
        ) : null}
        {seasonal.eventLocation ? (
          <div className="seasonal-hero-location fade-in" style={{ animationDelay: '0.4s' }}>
            <span className="mono">{locationLabel}</span>
            <span>{seasonal.eventLocation}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
