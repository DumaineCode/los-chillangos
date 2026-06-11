import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '../../i18n/navigation';
import { type Locale } from '../../i18n/routing';
import { CatalogFilter } from '../../src/components/CatalogFilter';
import { FAQList } from '../../src/components/FAQ';
import { TourCard } from '../../src/components/TourCard';
import { getPayload } from '../../src/lib/payload';
import type { Media, MediaVideo } from '../../src/payload-types';

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
  const hero = await payload
    .findGlobal({
      slug: 'hero',
      locale: locale as Locale,
      fallbackLocale: 'en',
    })
    .catch(() => null);

  const title = [hero?.h1a, hero?.h1b, hero?.h1c, hero?.h1d].filter(Boolean).join(' ').trim();
  const description = hero?.lede ?? undefined;

  return {
    title: title || 'Los Chillangos',
    description,
    openGraph: {
      title: title || 'Los Chillangos',
      description,
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
  const [hero, marquee, values, about, testimonial, services, faq, toursResult] = await Promise.all(
    [
      payload
        .findGlobal({ slug: 'hero', locale: locale as Locale, fallbackLocale: 'en' })
        .catch(() => null),
      payload
        .findGlobal({ slug: 'marquee', locale: locale as Locale, fallbackLocale: 'en' })
        .catch(() => null),
      payload
        .findGlobal({ slug: 'values', locale: locale as Locale, fallbackLocale: 'en' })
        .catch(() => null),
      payload
        .findGlobal({ slug: 'about', locale: locale as Locale, fallbackLocale: 'en' })
        .catch(() => null),
      payload
        .findGlobal({ slug: 'testimonial', locale: locale as Locale, fallbackLocale: 'en' })
        .catch(() => null),
      payload
        .findGlobal({ slug: 'services', locale: locale as Locale, fallbackLocale: 'en' })
        .catch(() => null),
      payload
        .findGlobal({ slug: 'faq', locale: locale as Locale, fallbackLocale: 'en' })
        .catch(() => null),
      payload.find({
        collection: 'tours',
        locale: locale as Locale,
        fallbackLocale: 'en',
        where: { _status: { equals: 'published' } },
        limit: 12,
        depth: 1,
      }),
    ]
  );

  const tours = toursResult.docs;

  const valuesItems = (values?.items ?? []).map((v) => ({ t: v.title, d: v.description }));
  const servicesItems = (services?.items ?? []).map((s) => ({ t: s.title, d: s.description }));
  const faqItems = (faq?.items ?? []).map((f) => ({ q: f.question, a: f.answer }));
  const heroStats = hero?.stats ?? [];
  const marqueeText = marquee?.text ?? '';

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
  const heroEyebrow = hero?.eyebrow ?? '';
  const heroLede = hero?.lede ?? '';
  const heroCtaPrimary = hero?.ctaPrimary ?? '';
  const heroCtaGhost = hero?.ctaGhost ?? '';

  const aboutImageUrl = resolveMediaUrl(about?.image);
  const testimonialAvatarUrl = resolveMediaUrl(testimonial?.avatar);

  return (
    <div>
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
              alt={heroEyebrow || 'Los Chillangos'}
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
          <div className="hero-cine-top fade-in" style={{ animationDelay: '0.1s' }}>
            <span>
              <span className="dot"></span>
              {hero?.live}
            </span>
            <span style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <span>{hero?.estLabel}</span>
              <span style={{ color: 'rgba(255,243,214,0.4)' }}>/</span>
              <span>{hero?.neighborhoods}</span>
            </span>
          </div>

          <div className="hero-cine-mid">
            <div
              className="hero-cine-eyebrow fade-in"
              style={{ animationDelay: '0.25s' }}
              data-testid="hero-eyebrow"
            >
              {heroEyebrow}
            </div>
            <h1 className="hero-cine-headline">
              {hero?.h1a} {hero?.h1b}
              <br />
              <em>{hero?.h1c}</em>
              {hero?.h1d}
            </h1>
          </div>

          <div className="hero-cine-bot">
            <p className="hero-cine-lede fade-in" style={{ animationDelay: '1.1s' }}>
              {heroLede}
            </p>
            <div className="hero-cine-stats fade-in" style={{ animationDelay: '1.25s' }}>
              {heroStats.map((stat, i) => (
                <div className="hero-cine-stat" key={stat.id ?? i}>
                  <span className="num">{stat.num}</span>
                  <span className="lbl" style={{ whiteSpace: 'pre-line' }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="hero-cine-ctas fade-in" style={{ animationDelay: '1.4s' }}>
              <Link href="#tours" className="btn btn-primary btn-lg">
                {heroCtaPrimary} →
              </Link>
              <Link href="#about" className="btn btn-ghost btn-lg">
                {heroCtaGhost}
              </Link>
            </div>
          </div>
        </div>
        <div className="hero-cine-scroll">
          <span>{hero?.scroll}</span>
          <span className="hero-cine-scroll-line"></span>
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
        </div>
      </section>

      {/* Editorial / About */}
      <section className="section" id="about" style={{ background: 'var(--bg-warm)' }}>
        <div className="container">
          <div className="editorial">
            {aboutImageUrl ? (
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
          <p className="testimonial">{testimonial?.quote}</p>
          <div className="testimonial-meta" style={{ justifyContent: 'center' }}>
            {testimonialAvatarUrl ? (
              <div
                className="testimonial-avatar"
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                <Image
                  src={testimonialAvatarUrl}
                  alt={testimonial?.name || 'Guest'}
                  fill
                  sizes="64px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div className="testimonial-avatar placeholder" data-label=""></div>
            )}
            <div>
              <div className="testimonial-name">{testimonial?.name}</div>
              <div className="testimonial-loc">{testimonial?.loc}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section" id="services" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                {services?.eyebrow} <span style={{ margin: '0 8px' }}>·</span> 04
              </div>
              <h2 className="section-title">{services?.title}</h2>
            </div>
            <p className="section-sub">{services?.sub}</p>
          </div>
          <div className="services">
            {servicesItems.map((s, i) => (
              <div className="service" key={i}>
                <div className="service-icon">{['↗', '◐', '✦'][i % 3]}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
                <a className="service-link">{services?.inquireCta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="container-tight">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                {faq?.eyebrow} <span style={{ margin: '0 8px' }}>·</span> 05
              </div>
              <h2 className="section-title">{faq?.title}</h2>
            </div>
          </div>
          <FAQList items={faqItems} />
        </div>
      </section>
    </div>
  );
}

function resolveMediaUrl(value: number | Media | MediaVideo | null | undefined): string | null {
  if (!value || typeof value === 'number') return null;
  return value.url ?? null;
}
