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
  const payload = await getPayload();
  const landing = await payload
    .findGlobal({
      slug: 'landing',
      locale: locale as Locale,
      fallbackLocale: 'en',
    })
    .catch(() => null);

  const hero = landing?.hero;
  const title = [hero?.h1a, hero?.h1b, hero?.h1c, hero?.h1d].filter(Boolean).join(' ').trim();

  return {
    title: title || 'Los Chillangos',
    openGraph: {
      title: title || 'Los Chillangos',
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

  const tours = toursResult.docs;

  const valuesItems = (values?.items ?? []).map((v) => ({ t: v.title, d: v.description }));
  const servicesItems = (services?.items ?? []).map((s) => ({ t: s.title, d: s.description }));
  const faqItems = (faq?.items ?? []).map((f) => ({ q: f.question, a: f.answer }));
  const marqueeText = marquee?.text ?? '';
  const seasonalEyebrow = landing?.seasonal?.eyebrow ?? '';

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

  const heroImageUrl = resolveMediaUrl(hero?.heroImage);
  const heroVideoUrl = resolveMediaUrl(hero?.heroVideo);
  const showHeroVideo = hero?.mediaType === 'video' && heroVideoUrl !== null;
  const heroCtaPrimary = hero?.ctaPrimary ?? '';
  const heroCtaGhost = hero?.ctaGhost ?? '';
  // CTA destinations are editable per global. Defaults preserve the original
  // anchors so existing rows that pre-date the field render exactly as before.
  const heroCtaPrimaryHref = hero?.ctaPrimaryHref?.trim() || '#tours';
  const heroCtaGhostHref = hero?.ctaGhostHref?.trim() || '#about';

  // Gallery first (slider), single `image` as fallback for legacy content.
  const aboutGalleryUrls = (about?.images ?? [])
    .map((entry) => resolveMediaUrl(entry.image))
    .filter((url): url is string => url !== null);
  const aboutImageUrl = aboutGalleryUrls[0] ?? resolveMediaUrl(about?.image);
  const testimonialItems = (testimonial?.items ?? []).map((item) => ({
    quote: item.quote,
    name: item.name,
    loc: item.loc,
    avatarUrl: resolveMediaUrl(item.avatar),
  }));

  const teamMembers = (team?.items ?? []).map((m) => ({
    name: m.name,
    role: m.role,
    photoUrl: resolveMediaUrl(m.photo),
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
              style={{ objectFit: 'cover' }}
            />
          ) : heroImageUrl ? (
            <Image
              className="hero-cine-img"
              src={heroImageUrl}
              alt="Los Chillangos"
              fill
              priority
              sizes="100vw"
              style={{ objectFit: 'cover' }}
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
            <h1 className="hero-cine-headline">
              {hero?.h1a} {hero?.h1b}
              <br />
              <em>{hero?.h1c}</em>
              {hero?.h1d}
            </h1>
          </div>

          <div className="hero-cine-bot">
            <div className="hero-cine-ctas fade-in" style={{ animationDelay: '0.4s' }}>
              <HeroCta href={heroCtaPrimaryHref} className="btn btn-primary btn-lg">
                {heroCtaPrimary} →
              </HeroCta>
              <HeroCta href={heroCtaGhostHref} className="btn btn-ghost btn-lg">
                {heroCtaGhost}
              </HeroCta>
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
                {values?.eyebrow} <span style={{ margin: '0 8px' }}>·</span> 01
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
                {tCatalog('eyebrow')} <span style={{ margin: '0 8px' }}>·</span> 02
              </div>
              <h2 className="section-title">{tCatalog('title')}</h2>
            </div>
            <p className="section-sub">{tCatalog('sub')}</p>
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

      {/* Editorial / About */}
      <section className="section" id="about" style={{ background: 'var(--bg-warm)' }}>
        <div className="container">
          <div className="editorial">
            {aboutGalleryUrls.length > 1 ? (
              <AboutSlider
                images={aboutGalleryUrls}
                alt={about?.imageLabel || about?.title || 'Los Chillangos'}
              />
            ) : aboutImageUrl ? (
              <div className="editorial-img" style={{ position: 'relative', overflow: 'hidden' }}>
                <Image
                  src={aboutImageUrl}
                  alt={about?.imageLabel || about?.title || 'Los Chillangos'}
                  fill
                  sizes="(max-width: 900px) 100vw, 50vw"
                  style={{ objectFit: 'cover' }}
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
                {about?.eyebrow} <span style={{ margin: '0 8px' }}>·</span> 03
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
                  <article
                    key={i}
                    id={`testimonial-${i}`}
                    className="testimonial-slide"
                  >
                    <p className="testimonial">{item.quote}</p>
                    <div className="testimonial-meta" style={{ justifyContent: 'center' }}>
                      {item.avatarUrl ? (
                        <div
                          className="testimonial-avatar"
                          style={{ position: 'relative', overflow: 'hidden' }}
                        >
                          <Image
                            src={item.avatarUrl}
                            alt={item.name || 'Guest'}
                            fill
                            sizes="64px"
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                      ) : (
                        <div className="testimonial-avatar placeholder" data-label=""></div>
                      )}
                      <div>
                        <div className="testimonial-name">{item.name}</div>
                        <div className="testimonial-loc">{item.loc}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {testimonialItems.length > 1 ? (
                <div className="testimonial-dots" aria-hidden="true">
                  {testimonialItems.map((_, i) => (
                    <a
                      key={i}
                      href={`#testimonial-${i}`}
                      className="testimonial-dot"
                    />
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
                {faq?.eyebrow} <span style={{ margin: '0 8px' }}>·</span> 04
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
                  {team?.eyebrow} <span style={{ margin: '0 8px' }}>·</span> 05
                </div>
                <h2 className="section-title">{team?.title}</h2>
              </div>
              {team?.sub ? <p className="section-sub">{team.sub}</p> : null}
            </div>
            <div className="team">
              {teamMembers.map((m, i) => (
                <div className="team-member" key={i}>
                  {m.photoUrl ? (
                    <div
                      className="team-photo"
                      style={{ position: 'relative', overflow: 'hidden' }}
                    >
                      <Image
                        src={m.photoUrl}
                        alt={m.name || 'Team member'}
                        fill
                        sizes="160px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div className="team-photo placeholder" data-label=""></div>
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
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const isInternalRoute = href.startsWith('/') && !href.startsWith('//');
  if (isInternalRoute) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  const isExternal = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      className={className}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}
