import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '../../i18n/navigation';
import { type Locale } from '../../i18n/routing';
import { AboutSlider } from '../../src/components/AboutSlider';
import { CatalogFilter } from '../../src/components/CatalogFilter';
import { Contact } from '../../src/components/contact/Contact';
import { FAQList } from '../../src/components/FAQ';
import { RefreshRouteOnSave } from '../../src/components/RefreshRouteOnSave';
import { HighlightSeasonal } from '../../src/components/seasonal/HighlightSeasonal';
import { TourCard } from '../../src/components/TourCard';
import { getPayload } from '../../src/lib/payload';
import { parseQuoteAccents } from '../../src/lib/hero/parseQuoteAccents';
import { resolveGoogleFont } from '../../src/lib/fonts/googleFont';
import { resolveMediaImage, type ResolvedImage } from '../../src/lib/media';
import { getActiveSeasonalTour } from '../../src/lib/seasonal/getActiveSeasonalTour';
import type { Media, MediaVideo } from '../../src/payload-types';

// Inline service icons, hoisted to module scope so the static JSX is created
// once instead of on every render (rendering-hoist-jsx). Indexed `[i % 3]` to
// mirror the previous decorative glyph cycle, but as accessible, no-emoji SVGs.
// 0 → route/transfer, 1 → guide/person, 2 → custom/sparkle.
const STRIP_ICONS: ReactNode[] = [
  <svg
    key="route"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>,
  <svg
    key="guide"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>,
  <svg
    key="custom"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" />
  </svg>,
];

// CMS-driven content. We intentionally OMIT generateStaticParams so Next does
// NOT prerender these pages at build time (the database isn't reachable from
// the Docker builder). The first request generates the page on demand and ISR
// caches it for `revalidate` seconds; content edits in Payload surface within
// that window with no redeploy.
export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  // No per-page title override: the hero heading is now the editorial `quote`,
  // which makes a poor <title>/OG title. Omitting `title` here lets the fixed
  // brand default in `app/layout.tsx` win for both <title> and OG title, keeping
  // SEO decoupled from marketing copy.
  return {
    openGraph: {
      type: 'website',
      locale,
    },
    alternates: {
      languages: {
        en: '/en',
        es: '/es',
      },
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // `catalog` filter labels stay in next-intl (UI controls, not marketing copy).
  const tCatalog = await getTranslations({ locale, namespace: 'catalog' });
  // Rentals home block: editable copy lives in the Landing `rentals` tab, but
  // until the client fills it we fall back to localized i18n defaults so the
  // block (and its CTA) is always meaningful.
  const tRentals = await getTranslations({ locale, namespace: 'rentals' });

  const payload = await getPayload();

  // Live Preview: the /next/preview route enables Next draft mode before
  // redirecting here, so a truthy draft flag means we're inside the admin's
  // preview iframe and should mount the refresh bridge. Globals have no drafts,
  // so the preview reflects the last SAVED state (refresh-on-save).
  const { isEnabled: isDraft } = await draftMode();

  const [landing, toursResult, seasonalTour, contactInfo, socialLinks] = await Promise.all([
    payload
      .findGlobal({ slug: 'landing', locale: locale as Locale, fallbackLocale: 'en' })
      .catch(() => null),
    payload.find({
      collection: 'tours',
      locale: locale as Locale,
      fallbackLocale: 'en',
      where: { _status: { equals: 'published' } },
      limit: 12,
      depth: 1,
    }),
    getActiveSeasonalTour(payload, locale as Locale).catch(() => null),
    payload.findGlobal({ slug: 'contact-info' }).catch(() => null),
    payload.findGlobal({ slug: 'social-links' }).catch(() => null),
  ]);

  // Each homepage section is now a sub-object (named tab) of the single
  // `landing` global. Aliasing them back to the original variable names keeps
  // the JSX below byte-for-byte unchanged.
  const hero = landing?.hero;
  const marquee = landing?.marquee;
  const values = landing?.values;
  const about = landing?.about;
  const testimonial = landing?.testimonial;
  const services = landing?.services;
  const team = landing?.team;
  const faq = landing?.faq;
  const rentalsBlock = landing?.rentals;

  // When a seasonal tour is featured in the banner above (HighlightSeasonal),
  // drop it from the "Pick your pace" catalog grid so the exact same tour never
  // renders twice back-to-back. Without an active seasonal feature, the catalog
  // shows every published tour as before.
  const tours = seasonalTour
    ? toursResult.docs.filter((tour) => tour.id !== seasonalTour.id)
    : toursResult.docs;

  // Rentals price list (from the Landing `rentals` tab). Keep only rows that have
  // BOTH a label and a price, so a half-filled admin row never renders broken.
  const rentalDurations = (rentalsBlock?.durations ?? []).filter((d) =>
    Boolean(d.label && d.price)
  );
  const helmetLabel = rentalsBlock?.helmetLabel?.trim() ?? '';
  const helmetPrice = rentalsBlock?.helmetPrice?.trim() ?? '';
  const showHelmet = helmetLabel !== '' && helmetPrice !== '';
  // Default the rentals CTA to the online rental checkout flow. Passed UNPREFIXED
  // (`/rent`) so HeroCta's locale-aware Link adds the active locale, exactly like
  // the catalog links to /book. An admin can still override it via the Landing
  // `rentals` tab.
  const rentalsCtaHref = rentalsBlock?.ctaHref?.trim() || '/rent';
  // Optional bike photo for the rentals block. Focal-point aware so it frames
  // by its focal point; when absent the panel renders a styled placeholder.
  const rentalImage = resolveMediaImage(rentalsBlock?.image);

  const valuesItems = (values?.items ?? []).map((v) => ({ t: v.title, d: v.description }));
  const servicesItems = (services?.items ?? []).map((s) => ({ t: s.title, d: s.description }));
  const faqItems = (faq?.items ?? []).map((f) => ({ q: f.question, a: f.answer }));
  const marqueeText = marquee?.text ?? '';
  const seasonalEyebrow = landing?.seasonal?.eyebrow ?? '';

  // Tours-catalog section header: CMS copy from the Landing `tours` tab wins;
  // empty fields fall back to the built-in i18n strings so the section never
  // renders blank.
  const toursHeader = landing?.tours;
  const toursEyebrow = toursHeader?.eyebrow?.trim() || tCatalog('eyebrow');
  const toursTitle = toursHeader?.title?.trim() || tCatalog('title');
  const toursSub = toursHeader?.sub?.trim() || tCatalog('sub');

  const filters: { key: 'all' | 'ebike' | 'walking' | 'daytrip' | 'new'; label: string }[] = [
    { key: 'all', label: tCatalog('filters.all') },
    { key: 'ebike', label: tCatalog('filters.ebike') },
    { key: 'walking', label: tCatalog('filters.walking') },
    { key: 'daytrip', label: tCatalog('filters.daytrip') },
    { key: 'new', label: tCatalog('filters.new') },
  ];

  const cards = tours.map((tour) => ({
    tour: {
      id: tour.id,
      category: tour.category,
      tag: tour.tag ?? null,
    },
    node: <TourCard key={tour.id} tour={tour} locale={locale as Locale} />,
  }));

  const heroImage = resolveMediaImage(hero?.heroImage);
  // Optional hero logo/icon shown centered above the heading. Resolved to a
  // url-only triple; renders only when the owner uploads one.
  const heroLogo = resolveMediaImage(hero?.logo);
  const heroVideoUrl = resolveMediaUrl(hero?.heroVideo);
  const showHeroVideo = hero?.mediaType === 'video' && heroVideoUrl !== null;
  // The <video> object-position frames the clip by its own focal point. Routed
  // through resolveMediaImage to reuse the hydrated-doc guard (heroVideo may be
  // a number/null). Legacy/null focal → centered, byte-identical to before.
  const heroVideoPosition = resolveMediaImage(hero?.heroVideo)?.objectPosition ?? '50% 50%';
  const heroCtaPrimary = hero?.ctaPrimary ?? '';
  // CTA destinations are editable per global. Defaults preserve the original
  // anchors so existing rows that pre-date the field render exactly as before.
  const heroCtaPrimaryHref = hero?.ctaPrimaryHref?.trim() || '#tours';
  // Hero shows three essential CTAs: tours (primary), rent-a-bike, and
  // plan-your-own-trip. rentals + plan render only when their label has content, so pre-refresh
  // rows degrade gracefully to a single tours CTA. Href defaults are code-side
  // because Payload defaultValues only apply to rows saved after the field ships.
  const heroCtaRentals = hero?.ctaRentals?.trim() ?? '';
  const heroCtaPlan = hero?.ctaPlan?.trim() ?? '';
  const heroCtaRentalsHref = hero?.ctaRentalsHref?.trim() || '#rentals-home';
  const heroCtaPlanHref = hero?.ctaPlanHref?.trim() || '#contact';
  // Hero heading: the required `quote` is the primary <h1>. Trim so a
  // whitespace-only value is treated as empty and the brand fallback wins in
  // the JSX (guarantees a non-empty single <h1>). Author is optional attribution.
  const heroQuote = hero?.quote?.trim() ?? '';
  const heroQuoteAuthor = hero?.quoteAuthor?.trim() ?? '';
  // Optional CMS-chosen Google Font for the headline. When a family is set this
  // yields a fonts.googleapis.com <link> (loaded below) plus an inline style;
  // otherwise it's a no-op and the self-hosted default (Oswald) is used.
  const heroFont = resolveGoogleFont(hero?.headingFont);

  // Gallery first (slider), single `image` as fallback for legacy content.
  // Resolved to focal-point-aware images so each slide frames by its focal point.
  const aboutImages = (about?.images ?? [])
    .map((entry) => resolveMediaImage(entry.image))
    .filter((image): image is ResolvedImage => image !== null);
  const aboutImage = aboutImages[0] ?? resolveMediaImage(about?.image);
  // Only surface testimonials that actually carry a quote. A CMS row with a
  // name but no quote text would otherwise render as empty quotation marks —
  // filtering here keeps the slider meaningful, and the `length > 0` guard in
  // the JSX hides the whole section when nothing valid remains.
  const testimonialDateFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const testimonialItems = (testimonial?.items ?? [])
    .map((item) => ({
      quote: (item.quote ?? '').trim(),
      name: item.name,
      loc: item.loc,
      // Clamp the CMS rating into a valid 1-5 star count; default to a full
      // 5 stars so a row that predates the field still renders sensibly.
      rating: Math.max(1, Math.min(5, Math.round(item.rating ?? 5))),
      verified: item.verified ?? false,
      date: item.date ? testimonialDateFormatter.format(new Date(item.date)) : null,
      avatar: resolveMediaImage(item.avatar),
    }))
    .filter((item) => item.quote !== '');

  const teamMembers = (team?.items ?? []).map((m) => ({
    name: m.name,
    role: m.role,
    photo: resolveMediaImage(m.photo),
  }));

  return (
    <div>
      {/* Live Preview bridge — mounted only inside the admin preview iframe. */}
      {isDraft ? <RefreshRouteOnSave /> : null}

      {/* Cinematic Hero */}
      <section className="hero-cine">
        <div className="hero-cine-media">
          {showHeroVideo ? (
            <video
              className="hero-cine-video"
              src={heroVideoUrl ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              style={{ objectFit: 'cover', objectPosition: heroVideoPosition }}
            />
          ) : heroImage ? (
            <Image
              className="hero-cine-img"
              src={heroImage.url}
              alt="Los Chillangos"
              fill
              priority
              sizes="100vw"
              style={{ objectFit: 'cover', objectPosition: heroImage.objectPosition }}
            />
          ) : (
            // Fallback to legacy brand image until the client uploads.
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
          <div className="hero-cine-mid">
            {/* Optional brand logo/icon crowning the hero. Rendered above the
                <h1> only when the owner uploads one; fixed height, auto width so
                any aspect ratio stays undistorted (same pattern as Logo). */}
            {heroLogo ? (
              <Image
                className="hero-cine-logo fade-in"
                src={heroLogo.url}
                alt={heroLogo.alt || 'Los Chillangos'}
                width={1100}
                height={440}
                priority
                style={{ height: 'auto', width: 'auto' }}
              />
            ) : null}
            {/* The required `quote` is the primary hero heading — heading TEXT,
                not a nested blockquote — so there is exactly one <h1> per page.
                Empty/legacy-dirty quote falls back to the brand name so the
                <h1> is never rendered empty (a11y). */}
            {/* Runtime Google Font load for the headline. React hoists this
                stylesheet <link> into <head>; rendered only when the owner
                picked a custom family in the admin. */}
            {heroFont.linkHref ? (
              <link rel="stylesheet" href={heroFont.linkHref} />
            ) : null}
            <h1 className="hero-cine-headline hero-cine-quote-h1" style={heroFont.style}>
              {/* The owner marks accent runs with *asterisks*; we parse that
                  into REAL React nodes (never dangerouslySetInnerHTML) so every
                  character is auto-escaped and the markers stay invisible. */}
              {parseQuoteAccents(heroQuote || 'Los Chillangos').map((segment, i) =>
                segment.accent ? (
                  <span key={i} className="hero-accent">
                    {segment.text}
                  </span>
                ) : (
                  segment.text
                )
              )}
            </h1>
            {/* Author is optional attribution, a sibling of the heading (never
                inside it), rendered only when populated. */}
            {heroQuoteAuthor ? (
              <p className="hero-cine-attrib fade-in" style={{ animationDelay: '0.3s' }}>
                — {heroQuoteAuthor}
              </p>
            ) : null}
          </div>

          <div className="hero-cine-bot">
            <div className="hero-cine-ctas fade-in" style={{ animationDelay: '0.4s' }}>
              <HeroCta href={heroCtaPrimaryHref} className="btn btn-primary btn-xl">
                {heroCtaPrimary}
                <ArrowRight size={18} aria-hidden="true" />
              </HeroCta>
              {heroCtaRentals ? (
                <HeroCta href={heroCtaRentalsHref} className="btn btn-ghost btn-xl">
                  {heroCtaRentals}
                </HeroCta>
              ) : null}
              {heroCtaPlan ? (
                <HeroCta href={heroCtaPlanHref} className="btn btn-ghost btn-xl">
                  {heroCtaPlan}
                </HeroCta>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="marquee">
        <div className="marquee-track">
          <span>{marqueeText}</span>
          <span>{marqueeText}</span>
        </div>
      </div>

      {/* Values */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                {values?.eyebrow}
              </div>
              <h2 className="section-title">{values?.title}</h2>
            </div>
            <p className="section-sub">{values?.sub}</p>
          </div>
          <div className="values">
            {valuesItems.map((v, i) => (
              <div className="value-cell" key={i}>
                <div className="value-num">0{i + 1}</div>
                <h3 className="value-title">{v.t}</h3>
                <p className="value-desc">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seasonal highlight — renders only when an active seasonal tour is set.
          When unset, HighlightSeasonal returns null (zero layout shift). */}
      <HighlightSeasonal tour={seasonalTour} eyebrow={seasonalEyebrow} locale={locale as Locale} />

      {/* Catalog */}
      <section className="section" id="tours" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                {toursEyebrow}
              </div>
              <h2 className="section-title">{toursTitle}</h2>
            </div>
            <p className="section-sub">{toursSub}</p>
          </div>
          <CatalogFilter filters={filters} cards={cards} />

          {/* Additional services — a card strip inside #tours, reading as
              "we also do this" (no price/duration, inquiry-only). Null-safe:
              renders nothing when there are no service items. */}
          {servicesItems.length > 0 && (
            <div className="services-strip" id="services" data-testid="services-strip">
              <div className="section-head" style={{ marginTop: 56 }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 16 }}>
                    {services?.eyebrow}
                  </div>
                  <h2 className="section-title">{services?.title}</h2>
                </div>
                <p className="section-sub">{services?.sub}</p>
              </div>
              <div className="strip-cards">
                {servicesItems.map((s, i) => (
                  <div className="strip-card" key={i} data-testid="strip-card">
                    <span className="strip-card-icon" aria-hidden="true">
                      {STRIP_ICONS[i % 3]}
                    </span>
                    <h3 className="strip-card-title">{s.t}</h3>
                    <p className="strip-card-desc">{s.d}</p>
                    <a href="#contact" className="strip-card-link">
                      {services?.inquireCta} →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="catalog-notfound">
            <h3 className="catalog-notfound-title">{tCatalog('notFound.title')}</h3>
            <p className="catalog-notfound-sub">{tCatalog('notFound.sub')}</p>
            <a href="#contact" className="btn btn-primary">
              {tCatalog('notFound.cta')}
            </a>
          </div>
        </div>
      </section>

      {/* Bike rentals — simple, editable PRICE LIST. The business rents ONE bike
          model in ONE size, so this is NOT a catalog: a set of duration options
          (each with its price) + an optional helmet add-on + a contact CTA. All
          copy comes from the Landing `rentals` tab (durations/helmet/CTA), with
          i18n fallbacks for the framing text. When no priced duration exists yet,
          the block degrades to the editable copy + contact CTA so the home never
          renders empty. Online payment is a future phase. */}
      <section className="section" id="rentals-home" data-testid="rentals-home-block">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                {rentalsBlock?.eyebrow || tRentals('home.eyebrow')}
              </div>
              <h2 className="section-title">{rentalsBlock?.title || tRentals('home.title')}</h2>
            </div>
          </div>

          {rentalDurations.length > 0 ? (
            // Warm, self-contained "rental menu": bike photo on the left, price
            // list + value prop + CTA on the right. Echoes the seasonal banner's
            // cream surface so the two feature blocks read as siblings.
            <div className="rental-panel">
              <RentalMedia
                image={rentalImage}
                caption={rentalsBlock?.title || tRentals('home.title')}
              />
              <div className="rental-body">
                <ul className="rental-price-list" data-testid="rental-price-list">
                  {rentalDurations.map((d, i) => (
                    <li className="rental-price-row" key={d.id ?? i}>
                      <span className="rental-price-label">{d.label}</span>
                      <span className="rental-price-dots" aria-hidden="true" />
                      <span className="rental-price-value">{d.price}</span>
                    </li>
                  ))}
                  {showHelmet ? (
                    <li
                      className="rental-price-row rental-price-row-addon"
                      data-testid="rental-helmet-row"
                    >
                      <span className="rental-price-label">{helmetLabel}</span>
                      <span className="rental-price-dots" aria-hidden="true" />
                      <span className="rental-price-value">{helmetPrice}</span>
                    </li>
                  ) : null}
                </ul>
                <div className="rental-aside">
                  <p className="rental-aside-lead">{rentalsBlock?.sub || tRentals('home.sub')}</p>
                  <HeroCta
                    href={rentalsCtaHref}
                    className="btn btn-primary btn-lg"
                    testId="rentals-home-cta"
                  >
                    {rentalsBlock?.ctaLabel || tRentals('home.cta')}
                  </HeroCta>
                </div>
              </div>
            </div>
          ) : (
            <div className="rental-panel rental-panel-empty">
              <RentalMedia
                image={rentalImage}
                caption={rentalsBlock?.title || tRentals('home.title')}
              />
              <div className="rental-body">
                <div className="rental-aside">
                  <p className="rental-aside-lead">{rentalsBlock?.sub || tRentals('home.sub')}</p>
                  <HeroCta
                    href={rentalsCtaHref}
                    className="btn btn-primary btn-lg"
                    testId="rentals-home-cta"
                  >
                    {rentalsBlock?.ctaLabel || tRentals('home.cta')}
                  </HeroCta>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Editorial / About */}
      <section className="section" id="about" style={{ background: 'var(--bg-warm)' }}>
        <div className="container">
          <div className="editorial">
            {aboutImages.length > 1 ? (
              <AboutSlider
                images={aboutImages}
                alt={about?.imageLabel || about?.title || 'Los Chillangos'}
              />
            ) : aboutImage ? (
              <div className="editorial-img" style={{ position: 'relative', overflow: 'hidden' }}>
                <Image
                  src={aboutImage.url}
                  alt={about?.imageLabel || about?.title || 'Los Chillangos'}
                  fill
                  sizes="(max-width: 900px) 100vw, 50vw"
                  style={{ objectFit: 'cover', objectPosition: aboutImage.objectPosition }}
                />
              </div>
            ) : (
              <div
                className="editorial-img placeholder dark"
                data-label={about?.imageLabel ?? ''}
              ></div>
            )}
            <div>
              <div className="eyebrow" style={{ marginBottom: 24 }}>
                {about?.eyebrow}
              </div>
              <h3>{about?.title}</h3>
              <p>{about?.p1}</p>
              <p>{about?.p2}</p>
              <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }}>
                {about?.meetCta}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="section">
        <div className="container-tight" style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 32 }}>
            {testimonial?.eyebrow}
          </div>
          {testimonialItems.length > 0 ? (
            <div className="testimonial-slider">
              <div className="testimonial-track">
                {testimonialItems.map((item, i) => (
                  <article key={i} id={`testimonial-${i}`} className="testimonial-slide">
                    <div className="testimonial-stars" role="img" aria-label={`${item.rating} / 5`}>
                      {Array.from({ length: 5 }).map((_, s) => (
                        <span
                          key={s}
                          className={s < item.rating ? 'star star-on' : 'star star-off'}
                          aria-hidden="true"
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <p className="testimonial">{item.quote}</p>
                    <div className="testimonial-meta" style={{ justifyContent: 'center' }}>
                      <div className="testimonial-avatar-wrap">
                        {item.avatar ? (
                          <div
                            className="testimonial-avatar"
                            style={{ position: 'relative', overflow: 'hidden' }}
                          >
                            <Image
                              src={item.avatar.url}
                              alt={item.name || 'Guest'}
                              fill
                              sizes="64px"
                              style={{
                                objectFit: 'cover',
                                objectPosition: item.avatar.objectPosition,
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            className="testimonial-avatar avatar-monogram avatar-monogram-g"
                            role="img"
                            aria-label={item.name || 'Guest'}
                            style={{ background: getAvatarColor(item.name) }}
                          >
                            <span aria-hidden="true">{getFirstLetter(item.name)}</span>
                          </div>
                        )}
                        {item.verified ? (
                          <span className="testimonial-verified" role="img" aria-label="Verified">
                            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                              <circle cx="12" cy="12" r="12" fill="#1A73E8" />
                              <path
                                d="M7 12.4l3.2 3.1L17 8.6"
                                fill="none"
                                stroke="#fff"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        ) : null}
                      </div>
                      <div className="testimonial-id">
                        <div className="testimonial-name">{item.name}</div>
                        <div className="testimonial-loc">
                          <svg
                            className="testimonial-google"
                            viewBox="0 0 24 24"
                            width="15"
                            height="15"
                            aria-hidden="true"
                          >
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                            />
                          </svg>
                          {[item.date, item.loc].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {testimonialItems.length > 1 ? (
                <div className="testimonial-dots" aria-hidden="true">
                  {testimonialItems.map((_, i) => (
                    <a key={i} href={`#testimonial-${i}`} className="testimonial-dot" />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="container-tight">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                {faq?.eyebrow}
              </div>
              <h2 className="section-title">{faq?.title}</h2>
            </div>
          </div>
          <FAQList items={faqItems} />
        </div>
      </section>

      {/* Team */}
      {teamMembers.length > 0 && (
        <section className="section" id="team" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow" style={{ marginBottom: 16 }}>
                  {team?.eyebrow}
                </div>
                <h2 className="section-title">{team?.title}</h2>
              </div>
              {team?.sub ? <p className="section-sub">{team.sub}</p> : null}
            </div>
            <div className="team">
              {teamMembers.map((m, i) => (
                <div className="team-member" key={i}>
                  {m.photo ? (
                    <div
                      className="team-photo"
                      style={{ position: 'relative', overflow: 'hidden' }}
                    >
                      <Image
                        src={m.photo.url}
                        alt={m.name || 'Team member'}
                        fill
                        sizes="(max-width: 768px) 140px, 200px"
                        style={{ objectFit: 'cover', objectPosition: m.photo.objectPosition }}
                      />
                    </div>
                  ) : (
                    <div
                      className="team-photo avatar-monogram"
                      role="img"
                      aria-label={m.name || 'Team member'}
                    >
                      <span aria-hidden="true">{getInitials(m.name)}</span>
                    </div>
                  )}
                  <div className="team-name">{m.name}</div>
                  <div className="team-role">{m.role}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <Contact locale={locale as Locale} contact={contactInfo} social={socialLinks} />
    </div>
  );
}

function resolveMediaUrl(value: number | Media | MediaVideo | null | undefined): string | null {
  if (!value || typeof value === 'number') return null;
  return value.url ?? null;
}

/**
 * Bike photo frame for the rentals block. Renders the focal-point-aware image
 * when the client has uploaded one; otherwise a styled placeholder with an
 * inline bike glyph and a caption, so the panel never looks broken/empty.
 */
function RentalMedia({ image, caption }: { image: ResolvedImage | null; caption?: string }) {
  if (image) {
    return (
      <div className="rental-media">
        <Image
          src={image.url}
          alt={caption || 'Rental bike'}
          fill
          sizes="(max-width: 860px) 100vw, 40vw"
          style={{ objectFit: 'cover', objectPosition: image.objectPosition }}
        />
      </div>
    );
  }
  return (
    <div className="rental-media rental-media-empty" data-testid="rental-media-placeholder">
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M5.5 17.5 9 9h5l3.5 8.5M9 9l3 5.5h5.5M14 9l1-2.5h2.5" />
      </svg>
      {caption ? <span className="rental-media-caption">{caption}</span> : null}
    </div>
  );
}

/**
 * Initials for an avatar monogram fallback. Used when a team member or guest has
 * no uploaded photo, so the slot reads as an intentional monogram badge instead
 * of an empty/broken circle. First + last initial, uppercased; a lone middle dot
 * when there's no usable name.
 */
function getInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '\u00B7';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

// Google-style avatar fallback for reviews: a single uppercase letter on a solid
// colored disc. Unlike getInitials (used by the team grid), this returns just the
// first character, matching how Google renders account avatars without a photo.
function getFirstLetter(name: string | null | undefined): string {
  const first = (name ?? '').trim()[0];
  return first ? first.toUpperCase() : '\u00B7';
}

// Deterministic disc color from a curated Material-ish palette. Keyed off the
// name so a given reviewer always gets the same color across renders, while
// different reviewers vary — the effect the user asked for ("not always the same
// color"), just like Google's letter avatars.
const AVATAR_COLORS = [
  '#DB4437', // red
  '#E91E63', // pink
  '#9C27B0', // purple
  '#673AB7', // deep purple
  '#3F51B5', // indigo
  '#0288D1', // blue
  '#00897B', // teal
  '#0F9D58', // green
  '#F4511E', // deep orange
  '#8D6E63', // brown
];
function getAvatarColor(name: string | null | undefined): string {
  const key = (name ?? '').trim();
  if (!key) return AVATAR_COLORS[0]!;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

/**
 * Hero CTA link that adapts to the destination:
 *   - Internal app routes (starting with `/`, e.g. "/book")    → next-intl
 *     `<Link>` so the active locale prefix is applied.
 *   - Anchors (`#tours`), absolute URLs (`https://…`,
 *     `mailto:`, `tel:`)                                       → plain `<a>`
 *     because next-intl `<Link>` would localize them incorrectly.
 * External URLs also get `target="_blank"` + `rel="noopener"`.
 */
function HeroCta({
  href,
  className,
  children,
  testId,
}: {
  href: string;
  className: string;
  children: ReactNode;
  testId?: string;
}) {
  const isInternalRoute = href.startsWith('/') && !href.startsWith('//');
  if (isInternalRoute) {
    return (
      <Link href={href} className={className} data-testid={testId}>
        {children}
      </Link>
    );
  }
  const isExternal = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      className={className}
      data-testid={testId}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}
