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
    <a
      href={typeof href === 'string' ? href : JSON.stringify(href)}
      data-locale-link=""
      {...rest}
    >
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
    hero: { h1a: 'Ride', h1b: 'the', h1c: 'real', h1d: ' CDMX', ...hero },
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
// The two NEW CTAs (rentals, plan-your-own-trip) render only when their label
// is non-empty, so pre-refresh CMS rows keep the original 2-CTA hero. Internal
// routes (/rentals) go through the locale-aware Link; anchors (#tours,
// #contact) stay plain <a>. The quote block renders only when `quote` has
// content and always carries its attribution.
// ---------------------------------------------------------------------------

const FULL_HERO: HeroOverrides = {
  ctaPrimary: 'See tours',
  ctaGhost: 'How we work',
  ctaRentals: 'Rent a bike',
  ctaPlan: 'Plan your own trip',
};

describe('HomePage — hero CTAs (visual refresh)', () => {
  it('renders 4 CTAs in spec order when the new labels are populated', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, FULL_HERO);

    const ctas = container.querySelectorAll('.hero-cine-ctas a');
    expect(ctas).toHaveLength(4);

    const labels = Array.from(ctas).map((a) => a.textContent?.replace('→', '').trim());
    expect(labels).toEqual(['See tours', 'Rent a bike', 'Plan your own trip', 'How we work']);
  });

  it('applies code-side default hrefs for the new CTAs (/rentals, #contact)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, FULL_HERO);

    const ctas = Array.from(container.querySelectorAll('.hero-cine-ctas a'));
    const byLabel = (label: string) => ctas.find((a) => a.textContent?.includes(label));

    expect(byLabel('See tours')?.getAttribute('href')).toBe('#tours');
    expect(byLabel('Rent a bike')?.getAttribute('href')).toBe('/rentals');
    expect(byLabel('Plan your own trip')?.getAttribute('href')).toBe('#contact');
  });

  it('honors CMS-provided hrefs over the code-side defaults', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      ctaRentalsHref: '/rentals?bike=city',
      ctaPlanHref: 'https://wa.me/5255',
    });

    const ctas = Array.from(container.querySelectorAll('.hero-cine-ctas a'));
    const byLabel = (label: string) => ctas.find((a) => a.textContent?.includes(label));

    expect(byLabel('Rent a bike')?.getAttribute('href')).toBe('/rentals?bike=city');
    expect(byLabel('Plan your own trip')?.getAttribute('href')).toBe('https://wa.me/5255');
  });

  it('routes /rentals through the locale-aware Link but keeps anchors plain', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, FULL_HERO);

    const ctas = Array.from(container.querySelectorAll('.hero-cine-ctas a'));
    const byLabel = (label: string) => ctas.find((a) => a.textContent?.includes(label));

    // Internal route → mocked next-intl Link (marked with data-locale-link).
    expect(byLabel('Rent a bike')?.hasAttribute('data-locale-link')).toBe(true);
    // Anchors → plain <a>, NOT localized.
    expect(byLabel('See tours')?.hasAttribute('data-locale-link')).toBe(false);
    expect(byLabel('Plan your own trip')?.hasAttribute('data-locale-link')).toBe(false);
  });

  it('renders only the original 2 CTAs when the new labels are unset (existing rows)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ctaPrimary: 'See tours',
      ctaGhost: 'How we work',
    });

    const ctas = container.querySelectorAll('.hero-cine-ctas a');
    expect(ctas).toHaveLength(2);
    expect(ctas[0].textContent).toContain('See tours');
    expect(ctas[1].textContent).toContain('How we work');
  });

  it('treats whitespace-only new labels as empty (no blank buttons)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ctaPrimary: 'See tours',
      ctaGhost: 'How we work',
      ctaRentals: '   ',
      ctaPlan: '',
    });

    expect(container.querySelectorAll('.hero-cine-ctas a')).toHaveLength(2);
  });
});

describe('HomePage — hero quote (visual refresh)', () => {
  const QUOTE = 'Feet, what do I need you for when I have wings to fly?';

  it('renders the quote with its attribution inside the hero bottom block', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: QUOTE,
      quoteAuthor: 'Frida Kahlo',
    });

    const figure = container.querySelector('.hero-cine-bot figure.hero-cine-quote');
    expect(figure).not.toBeNull();

    const blockquote = figure!.querySelector('blockquote');
    expect(blockquote).not.toBeNull();
    expect(blockquote!.textContent).toContain(QUOTE);

    // Attribution always shows when a quote shows.
    const caption = figure!.querySelector('figcaption');
    expect(caption).not.toBeNull();
    expect(caption!.textContent).toContain('Frida Kahlo');
  });

  it('renders no quote block when the quote field is empty', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, {
      ...FULL_HERO,
      quote: '',
      quoteAuthor: 'Frida Kahlo',
    });

    expect(container.querySelector('.hero-cine-quote')).toBeNull();
    // The hero itself is unaffected — CTAs still render.
    expect(container.querySelectorAll('.hero-cine-ctas a')).toHaveLength(4);
  });

  it('renders no quote block when the quote field is absent (existing rows)', async () => {
    const { container } = await renderHome(DEFAULT_SERVICES, FULL_HERO);

    expect(container.querySelector('.hero-cine-quote')).toBeNull();
  });
});
