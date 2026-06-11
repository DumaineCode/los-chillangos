'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

import { Link } from '../../i18n/navigation';

/**
 * Stat pulled from the Payload Hero global (`hero.stats[]`).
 */
export type HeroStat = {
  id?: string | null;
  num: string;
  label: string;
};

/**
 * Props for {@link HeroReveal}. These are resolved on the server in
 * `app/[locale]/page.tsx` (slice 3) from the Payload `Hero` global — URLs and
 * the media branch are computed in the RSC so this client component stays a
 * thin presentation + scroll-reveal layer.
 *
 * The shape mirrors `payload-types` `Hero` (text fields are nullable there) so
 * the page can pass values through with minimal massaging.
 */
export type HeroRevealProps = {
  /** `image` | `video`; `null`/legacy records fall back to image rendering. */
  mediaType: 'image' | 'video' | null;
  /** Resolved `heroImage` URL (image case) or the legacy brand fallback. */
  imageUrl: string | null;
  /** Resolved `heroVideo.url` (video case). */
  videoUrl: string | null;
  /** Resolved `posterImage.url`: first paint (LCP) + mobile/reduced-motion still. */
  posterUrl: string | null;
  /** Alt text / aria label for the background media. */
  alt: string;

  eyebrow: string;
  live?: string | null;
  estLabel?: string | null;
  neighborhoods?: string | null;
  headline: { a?: string | null; b?: string | null; c?: string | null; d?: string | null };
  lede: string;
  ctaPrimary: string;
  ctaGhost: string;
  scroll?: string | null;
  stats: HeroStat[];
};

/**
 * Cinematic hero with scroll-driven progressive reveal.
 *
 * Renders the full `.hero-cine` track (the OUTER wrapper the Nav reads via
 * `getBoundingClientRect().bottom > 96` to toggle `over-hero`). Inside it a
 * `position: sticky` layer pins the full-screen media while the copy/CTAs/stats
 * reveal as the user scrolls through the tall track.
 *
 * Reveal is CSS-first: `animation-timeline: scroll()` drives it with zero JS on
 * supporting browsers. {@link useScrollReveal} is a no-dependency fallback that
 * only attaches when `animation-timeline` is unsupported, writing a `--reveal`
 * custom property (0..1) via a ref — never via React state — so the scroll path
 * stays off the React render loop. Under `prefers-reduced-motion` the hook
 * skips entirely and CSS shows every element statically.
 *
 * Content NEVER conditionally unmounts (opacity/transform only); in particular
 * `data-testid="hero-eyebrow"` is always present in the DOM.
 */
export function HeroReveal({
  mediaType,
  imageUrl,
  videoUrl,
  posterUrl,
  alt,
  eyebrow,
  live,
  estLabel,
  neighborhoods,
  headline,
  lede,
  ctaPrimary,
  ctaGhost,
  scroll,
  stats,
}: HeroRevealProps) {
  const trackRef = useRef<HTMLElement>(null);
  useScrollReveal(trackRef);

  const isVideo = mediaType === 'video' && Boolean(videoUrl);
  // Poster is the LCP image for video; on mobile / reduced-motion CSS hides the
  // <video> and shows this poster only (no video download forced).
  const imageSrc = isVideo ? posterUrl : imageUrl;
  const mediaAlt = alt || 'Los Chillangos';

  return (
    <section ref={trackRef} className="hero-cine">
      <div className="hero-cine-sticky">
        <div className="hero-cine-media">
          {isVideo ? (
            <video
              className="hero-cine-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={posterUrl ?? undefined}
              aria-label={mediaAlt}
            >
              <source src={videoUrl ?? undefined} />
            </video>
          ) : null}
          {imageSrc ? (
            <Image
              className="hero-cine-img"
              src={imageSrc}
              alt={mediaAlt}
              fill
              priority
              sizes="100vw"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            // Fallback to legacy brand image until the client uploads media.
            <Image
              className="hero-cine-img"
              src="/brand/calle-mural.png"
              alt="Los Chillangos mural — Calle Chilanga, CDMX"
              fill
              priority
              sizes="100vw"
              style={{ objectFit: 'cover' }}
            />
          )}
        </div>

        <div className="container hero-cine-inner">
          <div className="hero-cine-top">
            <span>
              <span className="dot"></span>
              {live}
            </span>
            <span style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <span>{estLabel}</span>
              <span style={{ color: 'rgba(255,243,214,0.4)' }}>/</span>
              <span>{neighborhoods}</span>
            </span>
          </div>

          <div className="hero-cine-mid">
            <div className="hero-cine-eyebrow" data-testid="hero-eyebrow">
              {eyebrow}
            </div>
            <h1 className="hero-cine-headline">
              {headline.a} {headline.b}
              <br />
              <em>{headline.c}</em>
              {headline.d}
            </h1>
          </div>

          <div className="hero-cine-bot">
            <p className="hero-cine-lede">{lede}</p>
            <div className="hero-cine-stats">
              {stats.map((stat, i) => (
                <div className="hero-cine-stat" key={stat.id ?? i}>
                  <span className="num">{stat.num}</span>
                  <span className="lbl" style={{ whiteSpace: 'pre-line' }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="hero-cine-ctas">
              <Link href="#tours" className="btn btn-primary btn-lg">
                {ctaPrimary} →
              </Link>
              <Link href="#about" className="btn btn-ghost btn-lg">
                {ctaGhost}
              </Link>
            </div>
          </div>
        </div>

        <div className="hero-cine-scroll">
          <span>{scroll}</span>
          <span className="hero-cine-scroll-line"></span>
        </div>
      </div>
    </section>
  );
}

/**
 * Scroll-progress fallback for browsers without `animation-timeline: scroll()`.
 *
 * Behaviour:
 * - Supported browsers → returns immediately; CSS `animation-timeline` owns the
 *   reveal and this hook does nothing (no listeners attached).
 * - `prefers-reduced-motion: reduce` → returns immediately; CSS shows content
 *   statically (never permanently hidden).
 * - Otherwise → attaches a single PASSIVE `scroll` + `resize` listener, computes
 *   track progress (0..1) from `getBoundingClientRect()` inside a rAF, and writes
 *   it to the `--reveal` custom property on the track element via the ref. No
 *   `setState` is used, so the scroll path never triggers a React re-render
 *   (Vercel `rerender-use-ref-transient-values`).
 *
 * Cleanup removes both listeners and cancels any pending rAF on unmount.
 */
export function useScrollReveal(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Guard 1: native scroll-driven animations handle everything — do nothing.
    if (
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('animation-timeline', 'scroll()')
    ) {
      return;
    }

    // Guard 2: reduced motion — leave content statically visible (CSS handles it).
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      el.style.setProperty('--reveal', '1');
      return;
    }

    let frame = 0;

    const compute = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      // progress: 0 when the track top hits the viewport top, 1 once the user
      // has scrolled past the revealing portion of the track.
      const progress = total > 0 ? clamp01(-rect.top / total) : 1;
      el.style.setProperty('--reveal', progress.toFixed(4));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(compute);
    };

    // Prime once so content is correct on first paint without a scroll event.
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref]);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
