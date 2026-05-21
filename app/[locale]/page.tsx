import type { Metadata } from 'next';
import Image from 'next/image';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '../../i18n/navigation';
import { routing, type Locale } from '../../i18n/routing';
import { CatalogFilter } from '../../src/components/CatalogFilter';
import { FAQList } from '../../src/components/FAQ';
import { TourCard } from '../../src/components/TourCard';
import { getPayload } from '../../src/lib/payload';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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

  const tHero = await getTranslations({ locale, namespace: 'hero' });
  const tValues = await getTranslations({ locale, namespace: 'values' });
  const tCatalog = await getTranslations({ locale, namespace: 'catalog' });
  const tEditorial = await getTranslations({ locale, namespace: 'editorial' });
  const tServices = await getTranslations({ locale, namespace: 'services' });
  const tTestimonial = await getTranslations({ locale, namespace: 'testimonial' });
  const tFaq = await getTranslations({ locale, namespace: 'faq' });
  const messages = (await getMessages()) as RootMessages;

  const payload = await getPayload();
  const [hero, toursResult] = await Promise.all([
    payload
      .findGlobal({ slug: 'hero', locale: locale as Locale, fallbackLocale: 'en' })
      .catch(() => null),
    payload.find({
      collection: 'tours',
      locale: locale as Locale,
      fallbackLocale: 'en',
      where: { _status: { equals: 'published' } },
      limit: 12,
      depth: 1,
    }),
  ]);

  const tours = toursResult.docs;

  // Build static-string arrays directly from the parsed messages.
  const valuesItems = messages.values?.items ?? [];
  const servicesItems = messages.services?.items ?? [];
  const faqItems = messages.faq?.items ?? [];
  const marqueeText = messages.marquee ?? '';

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

  const heroImageUrl = resolveHeroImageUrl(hero?.heroImage);
  const heroEyebrow = hero?.eyebrow ?? '';
  const heroLede = hero?.lede ?? '';
  const heroCtaPrimary = hero?.ctaPrimary ?? '';
  const heroCtaGhost = hero?.ctaGhost ?? '';

  return (
    <div>
      {/* Cinematic Hero */}
      <section className="hero-cine">
        <div className="hero-cine-media">
          {heroImageUrl ? (
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
              {tHero('live')}
            </span>
            <span style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <span>{tHero('estLabel')}</span>
              <span style={{ color: 'rgba(255,243,214,0.4)' }}>/</span>
              <span>{tHero('neighborhoods')}</span>
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
              <div className="hero-cine-stat">
                <span className="num">{tHero('stats.routesNum')}</span>
                <span className="lbl" style={{ whiteSpace: 'pre-line' }}>
                  {tHero('stats.routesLbl')}
                </span>
              </div>
              <div className="hero-cine-stat">
                <span className="num">{tHero('stats.perTourNum')}</span>
                <span className="lbl" style={{ whiteSpace: 'pre-line' }}>
                  {tHero('stats.perTourLbl')}
                </span>
              </div>
              <div className="hero-cine-stat">
                <span className="num">{tHero('stats.groupNum')}</span>
                <span className="lbl" style={{ whiteSpace: 'pre-line' }}>
                  {tHero('stats.groupLbl')}
                </span>
              </div>
              <div className="hero-cine-stat">
                <span className="num">{tHero('stats.ratingNum')}</span>
                <span className="lbl" style={{ whiteSpace: 'pre-line' }}>
                  {tHero('stats.ratingLbl')}
                </span>
              </div>
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
          <span>{tHero('scroll')}</span>
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
                {tValues('eyebrow')} <span style={{ margin: '0 8px' }}>·</span> 01
              </div>
              <h2 className="section-title">{tValues('title')}</h2>
            </div>
            <p className="section-sub">{tValues('sub')}</p>
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
            <div
              className="editorial-img placeholder dark"
              data-label={tEditorial('imageLabel')}
            ></div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 24 }}>
                {tEditorial('eyebrow')} <span style={{ margin: '0 8px' }}>·</span> 03
              </div>
              <h3>{tEditorial('title')}</h3>
              <p>{tEditorial('p1')}</p>
              <p>{tEditorial('p2')}</p>
              <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }}>
                {tEditorial('meetCta')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="section">
        <div className="container-tight" style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 32 }}>
            {tTestimonial('eyebrow')}
          </div>
          <p className="testimonial">{tTestimonial('quote')}</p>
          <div className="testimonial-meta" style={{ justifyContent: 'center' }}>
            <div className="testimonial-avatar placeholder" data-label=""></div>
            <div>
              <div className="testimonial-name">{tTestimonial('name')}</div>
              <div className="testimonial-loc">{tTestimonial('loc')}</div>
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
                {tServices('eyebrow')} <span style={{ margin: '0 8px' }}>·</span> 04
              </div>
              <h2 className="section-title">{tServices('title')}</h2>
            </div>
            <p className="section-sub">{tServices('sub')}</p>
          </div>
          <div className="services">
            {servicesItems.map((s, i) => (
              <div className="service" key={i}>
                <div className="service-icon">{['↗', '◐', '✦'][i]}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
                <a className="service-link">{tServices('inquireCta')}</a>
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
                {tFaq('eyebrow')} <span style={{ margin: '0 8px' }}>·</span> 05
              </div>
              <h2 className="section-title">{tFaq('title')}</h2>
            </div>
          </div>
          <FAQList items={faqItems} />
        </div>
      </section>
    </div>
  );
}

/**
 * Local shape of the message bundle. We only narrow the parts we read here.
 */
type RootMessages = {
  marquee?: string;
  values?: { items?: Array<{ t: string; d: string }> };
  services?: { items?: Array<{ t: string; d: string }> };
  faq?: { items?: Array<{ q: string; a: string }> };
};

function resolveHeroImageUrl(
  value: { url?: string | null } | number | null | undefined
): string | null {
  if (!value) return null;
  if (typeof value === 'number') return null;
  return value.url ?? null;
}
