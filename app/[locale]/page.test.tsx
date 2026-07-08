import { render, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from './page';

// ---------------------------------------------------------------------------
// Mocks for the RSC runtime layer.
//
// HomePage is an async Server Component that reaches into Payload, next/headers,
// next-intl/server and the locale-aware Link. None of those resolve under jsdom,
// so we mock the data + runtime boundary and assert on the rendered markup.
// ---------------------------------------------------------------------------

const findGlobalMock = vi.fn();
const findMock = vi.fn();

vi.mock('../../src/lib/payload', () => ({
  getPayload: () => Promise.resolve({ findGlobal: findGlobalMock, find: findMock }),
}));

vi.mock('next/headers', () => ({
  draftMode: () => Promise.resolve({ isEnabled: false }),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: () =>
    Promise.resolve((key: string) => {
      const table: Record<string, string> = {
        eyebrow: 'Catalog',
        title: 'Tours',
        sub: 'Pick your ride',
        'filters.all': 'All',
        'filters.ebike': 'E-Bike',
        'filters.walking': 'Walking',
        'filters.daytrip': 'Day Trip',
        'filters.new': 'New',
        'notFound.title': "Didn't find it?",
        'notFound.sub': 'Tell us what you want.',
        'notFound.cta': 'Contact us',
      };
      return table[key] ?? key;
    }),
}));

// Locale-aware Link → plain anchor, tagged with `data-locale-link` so tests can
// assert which hero CTAs route through next-intl (locale prefix) vs plain <a>.
vi.mock('../../i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: ComponentProps<'a'> & { href: unknown }) => (
    <a href={typeof href === 'string' ? href : JSON.stringify(href)} data-locale-link="" {...rest}>
      {children}
    </a>
  ),
}));

// next/image → plain img (jsdom can't run the Next image loader).
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// Seasonal helper is unrelated to the services strip — return nothing.
vi.mock('../../src/lib/seasonal/getActiveSeasonalTour', () => ({
  getActiveSeasonalTour: () => Promise.resolve(null),
}));

// HighlightSeasonal calls the client-only useTranslations hook unconditionally;
// it is unrelated to the services strip, so render nothing.
vi.mock('../../src/components/seasonal/HighlightSeasonal', () => ({
  HighlightSeasonal: () => null,
}));

// TourCard is an async Server Component (next-intl/server + payload thumbnails)
// that React's test renderer cannot resolve synchronously. It is unrelated to
// the services strip, so render a lightweight sync stand-in to keep the #tours
// tree renderable.
vi.mock('../../src/components/TourCard', () => ({
  TourCard: ({ tour }: { tour: { id: number; title?: string } }) => (
    <div data-testid="tour-card">{tour.title}</div>
  ),
}));

// Contact is an async Server Component (next-intl/server) rendered at the page
// foot. Unrelated to the services strip — stub it to keep the tree renderable.
vi.mock('../../src/components/contact/Contact', () => ({
  Contact: () => null,
}));

type ServiceItem = { title: string; description: string };

const DEFAULT_SERVICES: ServiceItem[] = [
  { title: 'Airport Transfers', description: 'Door-to-door rides across CDMX.' },
  { title: 'Private Guides', description: 'A local expert for your whole day.' },
  { title: 'Custom Routes', description: 'We design the tour around you.' },
];

type HeroOverrides = Record<string, string | undefined>;

function buildLanding(serviceItems: ServiceItem[] | undefined | null, hero: HeroOverrides = {}) {
  return {
    // Hero inversion: the required `quote` is now the primary <h1>, so the mock
    // always supplies a quote. h1a–d are gone from the schema.
    hero: { quote: 'Ride the real CDMX', ...hero },
    marquee: { text: 'marquee' },
    values: {
      eyebrow: 'Values',
      title: 'Why us',
      sub: 'sub',
      items: [{ title: 'Value 1', description: 'desc' }],
    },
    about: { eyebrow: 'About', title: 'About us', p1: 'p1', p2: 'p2', meetCta: 'Meet' },
    testimonial: { eyebrow: 'Testimonials', items: [] },
    services:
      serviceItems === undefined
        ? undefined
        : {
            eyebrow: 'Services',
            title: 'Beyond the tour',
            sub: 'We also do more.',
            inquireCta: 'Inquire',
            items: serviceItems,
          },
    team: { eyebrow: 'Team', title: 'Our team', sub: '', items: [] },
    faq: { eyebrow: 'FAQ', title: 'Questions', items: [{ question: 'Q1', answer: 'A1' }] },
    seasonal: { eyebrow: '' },
  };
}

function makeTour() {
  return {
    id: 1,
    slug: 'centro-ride',
    title: 'Centro Ride',
    category: 'ebike',
    tag: null,
    duration: '3h',
    price: 80,
    shortDescription: 'A spin through downtown.',
    _status: 'published',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// No default parameter here: a bare default can't distinguish an explicit
// `undefined` (absent services group) from "no argument" — JS substitutes the
// default for an explicit `undefined`. Callers always pass the value they mean.
async function renderHome(
  serviceItems: ServiceItem[] | undefined | null,
  hero: HeroOverrides = {}
) {
  findGlobalMock.mockImplementation(({ slug }: { slug: string }) => {
    if (slug === 'landing') return Promise.resolve(buildLanding(serviceItems, hero));
    return Promise.resolve(null);
  });
  findMock.mockResolvedValue({ docs: [makeTour()] });

  // Async RSC → await the element tree, then render the resolved tree.
  const ui = await HomePage({ params: Promise.resolve({ locale: 'en' }) });
  return render(ui);
}

beforeEach(() => {
  findGlobalMock.mockReset();
  findMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HomePage — services strip', () => {
  it('renders the strip inside #tours and before the catalog-notfound block', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES);

    const tours = container.querySelector('#tours');
    expect(tours).not.toBeNull();

    const strip = container.querySelector('[data-testid="services-strip"]');
    expect(strip).not.toBeNull();
    // Strip must be a descendant of #tours.
    expect(tours!.contains(strip)).toBe(true);

    // DOM order: strip precedes the not-found block.
    const notFound = container.querySelector('.catalog-notfound');
    expect(notFound).not.toBeNull();
    const position = strip!.compareDocumentPosition(notFound!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the services title exactly once with no standalone services section', async () => {
    const { container, queryAllByText } = await renderHome(DEFAULT_SERVICES);

    // The services title appears exactly once across the whole document.
    expect(queryAllByText('Beyond the tour')).toHaveLength(1);

    // No standalone <section id="services"> — the strip wrapper is a div.
    const standaloneSection = container.querySelector('section#services');
    expect(standaloneSection).toBeNull();

    // The old dead `.service` cards must be gone.
    expect(container.querySelectorAll('.service')).toHaveLength(0);
  });

  it('renders exactly N strip cards, each with its title and description', async () => {
    const items: ServiceItem[] = [
      { title: 'One Service', description: 'First description.' },
      { title: 'Two Service', description: 'Second description.' },
    ];
    const { container } = await renderHome(items);

    const cards = container.querySelectorAll('[data-testid="strip-card"]');
    expect(cards).toHaveLength(2);

    const strip = container.querySelector('[data-testid="services-strip"]')!;
    const scope = within(strip as HTMLElement);
    expect(scope.getByText('One Service')).toBeInTheDocument();
    expect(scope.getByText('First description.')).toBeInTheDocument();
    expect(scope.getByText('Two Service')).toBeInTheDocument();
    expect(scope.getByText('Second description.')).toBeInTheDocument();
  });

  it('renders inline SVG icons with no emoji/glyph characters', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES);

    const cards = container.querySelectorAll('[data-testid="strip-card"]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const svg = card.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
    }

    const strip = container.querySelector('[data-testid="services-strip"]')!;
    // None of the old decorative glyphs survive the move.
    expect(strip.textContent).not.toContain('↗');
    expect(strip.textContent).not.toContain('◐');
    expect(strip.textContent).not.toContain('✦');
  });

  it('wires each inquire anchor to #contact with the inquireCta label', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES);

    const links = container.querySelectorAll('.strip-card-link');
    expect(links).toHaveLength(DEFAULT_SERVICES.length);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('#contact');
      expect(link.textContent).toContain('Inquire');
    }
  });

  it('keeps exactly one element with id="services" on the strip wrapper', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES);

    const withId = container.querySelectorAll('#services');
    expect(withId).toHaveLength(1);
    expect(withId[0].getAttribute('data-testid')).toBe('services-strip');
  });

  it('renders nothing for the strip when services items are empty', async () => {
    const { container } = await renderHome([]);

    expect(container.querySelector('[data-testid="services-strip"]')).toBeNull();
    expect(container.querySelector('#services')).toBeNull();
    // The rest of #tours still renders (null-safe, not a crash).
    expect(container.querySelector('#tours')).not.toBeNull();
    expect(container.querySelector('.catalog-notfound')).not.toBeNull();
  });

  it('renders nothing for the strip when the services group is absent', async () => {
    const { container } = await renderHome(undefined);

    expect(container.querySelector('[data-testid="services-strip"]')).toBeNull();
    expect(container.querySelector('#services')).toBeNull();
    expect(container.querySelector('#tours')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Visual refresh — hero CTAs (2 → 4) + quote block.
//
// The two extra CTAs (rentals, plan-your-own-trip) render only when their label
// is non-empty, so pre-refresh CMS rows keep the original 2-CTA hero. The rentals
// CTA defaults to the on-page anchor #rentals-home; internal routes (e.g. /book)
// go through the locale-aware Link; anchors (#tours, #rentals-home, #contact)
// stay plain <a>. The quote block renders only when `quote` has
// content; its attribution renders only when `quoteAuthor` is non-empty.
// ---------------------------------------------------------------------------

const FULL_HERO: HeroOverrides = {
  ctaPrimary: 'See tours',
  ctaGhost: 'How we work',
  ctaRentals: 'Rent a bike',
  ctaPlan: 'Plan your own trip',
};

/** Finds a hero CTA anchor by its visible label. */
const getCtaByLabel = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('.hero-cine-ctas a')).find((a) =>
    a.textContent?.includes(label)
  );

describe('HomePage — hero CTAs (visual refresh)', () => {
  it('renders the 3 essential CTAs in spec order (ghost/how-we-work dropped)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, FULL_HERO);

    const ctas = container.querySelectorAll('.hero-cine-ctas a');
    expect(ctas).toHaveLength(3);

    const labels = Array.from(ctas).map((a) => a.textContent?.replace('→', '').trim());
    expect(labels).toEqual(['See tours', 'Rent a bike', 'Plan your own trip']);
  });

  it('applies code-side default hrefs for the new CTAs (#rentals-home, #contact)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, FULL_HERO);

    expect(getCtaByLabel(container, 'See tours')?.getAttribute('href')).toBe('#tours');
    expect(getCtaByLabel(container, 'Rent a bike')?.getAttribute('href')).toBe('#rentals-home');
    expect(getCtaByLabel(container, 'Plan your own trip')?.getAttribute('href')).toBe('#contact');
  });

  it('honors CMS-provided hrefs over the code-side defaults', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      ctaRentalsHref: '/book?bike=city',
      ctaPlanHref: 'https://wa.me/5255',
    });

    expect(getCtaByLabel(container, 'Rent a bike')?.getAttribute('href')).toBe('/book?bike=city');
    expect(getCtaByLabel(container, 'Plan your own trip')?.getAttribute('href')).toBe(
      'https://wa.me/5255'
    );
  });

  it('routes internal-route CTAs through the locale-aware Link but keeps anchors plain', async () => {
    // The default rentals CTA is now the on-page anchor #rentals-home; override it
    // with a real internal route to prove internal routes use the locale Link.
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      ctaRentalsHref: '/book',
    });

    // Internal route → mocked next-intl Link (marked with data-locale-link).
    expect(getCtaByLabel(container, 'Rent a bike')?.hasAttribute('data-locale-link')).toBe(true);
    // Anchors → plain <a>, NOT localized.
    expect(getCtaByLabel(container, 'See tours')?.hasAttribute('data-locale-link')).toBe(false);
    expect(getCtaByLabel(container, 'Plan your own trip')?.hasAttribute('data-locale-link')).toBe(
      false
    );
  });

  it('renders only the tours CTA when the rent/plan labels are unset (existing rows)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ctaPrimary: 'See tours',
      ctaGhost: 'How we work',
    });

    const ctas = container.querySelectorAll('.hero-cine-ctas a');
    expect(ctas).toHaveLength(1);
    expect(ctas[0].textContent).toContain('See tours');
    // The former ghost CTA (how-we-work) is no longer rendered in the hero.
    expect(getCtaByLabel(container, 'How we work')).toBeUndefined();
  });

  it('treats whitespace-only new labels as empty (no blank buttons)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ctaPrimary: 'See tours',
      ctaGhost: 'How we work',
      ctaRentals: '   ',
      ctaPlan: '',
    });

    expect(container.querySelectorAll('.hero-cine-ctas a')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Hero inversion — the quote IS the primary <h1>.
//
// The required `quote` renders as the single page <h1 class="hero-cine-headline">
// (heading text, NOT a <blockquote>). The author is optional attribution: a
// sibling <p class="hero-cine-attrib">, never nested in the heading. Because
// `quote` is required and the render guards against dirty/legacy empties with a
// 'Los Chillangos' fallback, the page ALWAYS has exactly one non-empty <h1>.
// ---------------------------------------------------------------------------

describe('HomePage — hero quote as primary heading (inversion)', () => {
  const QUOTE = 'Feet, what do I need you for when I have wings to fly?';

  it('renders the quote as the single primary <h1.hero-cine-headline>', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: QUOTE,
    });

    const h1 = container.querySelector('h1.hero-cine-headline');
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toContain(QUOTE);

    // Exactly ONE <h1> on the page — the quote is the heading, nothing else.
    expect(container.querySelectorAll('h1')).toHaveLength(1);

    // The quote is heading TEXT, not a nested blockquote/figure structure.
    expect(container.querySelector('figure.hero-cine-quote')).toBeNull();
    expect(h1!.querySelector('blockquote')).toBeNull();
  });

  it('renders the author as an optional <p.hero-cine-attrib> sibling when present', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: QUOTE,
      quoteAuthor: 'Frida Kahlo',
    });

    const attrib = container.querySelector('p.hero-cine-attrib');
    expect(attrib).not.toBeNull();
    expect(attrib!.textContent).toContain('Frida Kahlo');

    // Author is attribution OUTSIDE the heading — the <h1> holds only the quote.
    const h1 = container.querySelector('h1.hero-cine-headline')!;
    expect(h1.textContent).not.toContain('Frida Kahlo');
  });

  it('omits the attribution but keeps the <h1> when quoteAuthor is empty', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: QUOTE,
      quoteAuthor: '',
    });

    // No empty attribution element when the author field is blank.
    expect(container.querySelector('p.hero-cine-attrib')).toBeNull();
    // The quote heading is still present and holds the quote text.
    const h1 = container.querySelector('h1.hero-cine-headline');
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toContain(QUOTE);
  });

  it('falls back to the brand name in the <h1> when the quote is empty (never an empty heading)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: '   ',
      quoteAuthor: 'Frida Kahlo',
    });

    const h1 = container.querySelector('h1.hero-cine-headline');
    expect(h1).not.toBeNull();
    // Empty/whitespace quote → brand fallback, so the <h1> is NEVER empty.
    expect(h1!.textContent?.trim()).toBe('Los Chillangos');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    // The hero itself is unaffected — CTAs still render.
    expect(container.querySelectorAll('.hero-cine-ctas a')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Hero quote pink accent — owner marks part of the quote with *asterisks* and
// that run renders in the brand pink (`--terra`) via <span class="hero-accent">.
// The markup is parsed into REAL React nodes (no dangerouslySetInnerHTML), so
// the asterisk markers are NEVER visible and all text is auto-escaped.
// ---------------------------------------------------------------------------

describe('HomePage — hero quote pink accent markup', () => {
  it('renders *marked* runs as <span.hero-accent> inside the <h1>, markers stripped', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: 'La vida es *corta*',
    });

    const h1 = container.querySelector('h1.hero-cine-headline')!;
    const accents = h1.querySelectorAll('span.hero-accent');
    expect(accents).toHaveLength(1);
    expect(accents[0]!.textContent).toBe('corta');

    // The full readable text is intact and the asterisk markers are gone.
    expect(h1.textContent).toBe('La vida es corta');
    expect(h1.textContent).not.toContain('*');
  });

  it('renders multiple *marked* runs as separate accent spans', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: 'Vive *hoy*, no *mañana*',
    });

    const h1 = container.querySelector('h1.hero-cine-headline')!;
    const accents = h1.querySelectorAll('span.hero-accent');
    expect([...accents].map((el) => el.textContent)).toEqual(['hoy', 'mañana']);
    expect(h1.textContent).toBe('Vive hoy, no mañana');
    expect(h1.textContent).not.toContain('*');
  });

  it('renders NO accent span and the full quote text when there are no asterisks', async () => {
    const QUOTE = 'Ride the real CDMX';
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: QUOTE,
    });

    const h1 = container.querySelector('h1.hero-cine-headline')!;
    expect(h1.querySelector('span.hero-accent')).toBeNull();
    expect(h1.textContent).toBe(QUOTE);
  });
});

// ---------------------------------------------------------------------------
// Rentals price list (#rentals-home)
//
// The business rents ONE bike in ONE size, so the home block is a simple, CMS-
// editable PRICE LIST (durations + optional helmet + contact CTA), not a
// catalog. Copy comes from the Landing `rentals` tab; when no priced duration
// exists the block degrades to the framing copy + contact CTA.
// ---------------------------------------------------------------------------
describe('home rentals price list', () => {
  type RentalsTab = Record<string, unknown>;

  async function renderHomeWithRentalsTab(rentals: RentalsTab | undefined) {
    findGlobalMock.mockImplementation(({ slug }: { slug: string }) => {
      if (slug === 'landing') {
        return Promise.resolve({ ...buildLanding(DEFAULT_SERVICES, FULL_HERO), rentals });
      }
      return Promise.resolve(null);
    });
    findMock.mockResolvedValue({ docs: [makeTour()] });

    const ui = await HomePage({ params: Promise.resolve({ locale: 'en' }) });
    return render(ui);
  }

  it('renders the editable price list (durations + helmet) and a contact CTA', async () => {
    const { container } = await renderHomeWithRentalsTab({
      eyebrow: 'Bike rentals',
      title: 'Rather ride on your own?',
      durations: [
        { id: 'a', label: '1 hour', price: '$150' },
        { id: 'b', label: '2 hours', price: '$280' },
      ],
      helmetLabel: 'Helmet',
      helmetPrice: '$50',
      ctaLabel: 'Reserve by WhatsApp',
      ctaHref: '#contact',
    });

    const block = container.querySelector('[data-testid="rentals-home-block"]')!;
    const list = block.querySelector('[data-testid="rental-price-list"]')!;
    expect(list).not.toBeNull();

    // Each duration row surfaces its label + price verbatim.
    expect(list.textContent).toContain('1 hour');
    expect(list.textContent).toContain('$150');
    expect(list.textContent).toContain('2 hours');
    expect(list.textContent).toContain('$280');

    // Helmet add-on row renders when both label and price are set.
    const helmet = block.querySelector('[data-testid="rental-helmet-row"]')!;
    expect(helmet).not.toBeNull();
    expect(helmet.textContent).toContain('Helmet');
    expect(helmet.textContent).toContain('$50');

    // CTA points at the configured destination; #contact is an anchor, so it is a
    // plain <a> (NOT routed through the locale-aware Link).
    const cta = block.querySelector('[data-testid="rentals-home-cta"]')!;
    expect(cta.getAttribute('href')).toBe('#contact');
    expect(cta.hasAttribute('data-locale-link')).toBe(false);
  });

  it('omits the helmet row when the helmet price is not set', async () => {
    const { container } = await renderHomeWithRentalsTab({
      durations: [{ id: 'a', label: '1 hour', price: '$150' }],
      helmetLabel: 'Helmet',
      // no helmetPrice
      ctaHref: '#contact',
    });

    const block = container.querySelector('[data-testid="rentals-home-block"]')!;
    expect(block.querySelector('[data-testid="rental-price-list"]')).not.toBeNull();
    expect(block.querySelector('[data-testid="rental-helmet-row"]')).toBeNull();
  });

  it('falls back to framing copy + contact CTA when there are no priced durations', async () => {
    const { container } = await renderHomeWithRentalsTab(undefined);

    const block = container.querySelector('[data-testid="rentals-home-block"]')!;
    expect(block.querySelector('[data-testid="rental-price-list"]')).toBeNull();
    expect(block.querySelector('.section-head')).not.toBeNull();

    // Default CTA destination is the contact section.
    const cta = block.querySelector('[data-testid="rentals-home-cta"]')!;
    expect(cta.getAttribute('href')).toBe('#contact');
  });
});
