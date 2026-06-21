import { render } from '@testing-library/react';
import type { ComponentProps, CSSProperties } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from './page';

// ---------------------------------------------------------------------------
// Focal-point integration for the home page image sites (FR-12).
//
// HomePage is an async Server Component reaching into Payload, next/headers,
// next-intl/server and the locale-aware Link. We mock that runtime boundary and
// assert object-position on the rendered cover images. The next/image mock here
// FORWARDS `style` + `className` (unlike page.test.tsx's lightweight stub) so we
// can read object-position off the exact element.
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
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock('../../i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: ComponentProps<'a'> & { href: unknown }) => (
    <a href={typeof href === 'string' ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    style,
    className,
  }: {
    src: string;
    alt: string;
    style?: CSSProperties;
    className?: string;
  }) => <img src={src} alt={alt} style={style} className={className} />,
}));

vi.mock('../../src/lib/seasonal/getActiveSeasonalTour', () => ({
  getActiveSeasonalTour: () => Promise.resolve(null),
}));
vi.mock('../../src/components/seasonal/HighlightSeasonal', () => ({
  HighlightSeasonal: () => null,
}));
vi.mock('../../src/components/TourCard', () => ({
  TourCard: () => null,
}));
vi.mock('../../src/components/contact/Contact', () => ({
  Contact: () => null,
}));

type FocalMedia = {
  id: number;
  url: string;
  alt: string;
  focalX: number | null;
  focalY: number | null;
  updatedAt: string;
};

function media(focalX: number | null, focalY: number | null, url = '/media/x.jpg'): FocalMedia {
  return { id: 1, url, alt: '', focalX, focalY, updatedAt: '2026-01-01T00:00:00.000Z' };
}

type LandingOpts = {
  heroImage?: unknown;
  mediaType?: string;
  testimonialItems?: unknown[];
  teamItems?: unknown[];
};

function buildLanding(opts: LandingOpts) {
  return {
    hero: {
      h1a: 'Ride',
      h1b: 'the',
      h1c: 'real',
      h1d: ' CDMX',
      mediaType: opts.mediaType ?? 'image',
      heroImage: opts.heroImage ?? null,
    },
    marquee: { text: 'marquee' },
    values: { eyebrow: 'V', title: 'V', sub: '', items: [] },
    about: { eyebrow: 'A', title: 'About', p1: '', p2: '', meetCta: '' },
    testimonial: { eyebrow: 'Testimonials', items: opts.testimonialItems ?? [] },
    services: undefined,
    team: { eyebrow: 'Team', title: 'Team', sub: '', items: opts.teamItems ?? [] },
    faq: { eyebrow: 'FAQ', title: 'FAQ', items: [] },
    seasonal: { eyebrow: '' },
  };
}

async function renderHome(opts: LandingOpts) {
  findGlobalMock.mockImplementation(({ slug }: { slug: string }) => {
    if (slug === 'landing') return Promise.resolve(buildLanding(opts));
    return Promise.resolve(null);
  });
  findMock.mockResolvedValue({ docs: [] });

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

describe('HomePage — image focal points (FR-12)', () => {
  it('frames the home hero image by its focal point', async () => {
    const { container } = await renderHome({ heroImage: media(80, 20, '/media/hero.jpg') });

    const hero = container.querySelector('.hero-cine-img');
    expect(hero).not.toBeNull();
    expect(hero).toHaveStyle({ objectPosition: '80% 20%' });
    expect(hero).toHaveStyle({ objectFit: 'cover' });
  });

  it('defaults the home hero image to 50% 50% for legacy/null focal', async () => {
    const { container } = await renderHome({ heroImage: media(null, null, '/media/hero.jpg') });

    expect(container.querySelector('.hero-cine-img')).toHaveStyle({ objectPosition: '50% 50%' });
  });

  it('frames the circular testimonial avatar by its focal point', async () => {
    const { container } = await renderHome({
      testimonialItems: [{ quote: 'Great', name: 'Ana', loc: 'CDMX', avatar: media(25, 75) }],
    });

    const avatar = container.querySelector('.testimonial-avatar img');
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveStyle({ objectPosition: '25% 75%' });
    expect(avatar).toHaveStyle({ objectFit: 'cover' });
  });

  it('defaults a null-focal avatar to 50% 50% (no regression under border-radius)', async () => {
    const { container } = await renderHome({
      testimonialItems: [{ quote: 'q', name: 'Ana', loc: 'CDMX', avatar: media(null, null) }],
    });

    expect(container.querySelector('.testimonial-avatar img')).toHaveStyle({
      objectPosition: '50% 50%',
    });
  });

  it('frames the circular team photo by its focal point', async () => {
    const { container } = await renderHome({
      teamItems: [{ name: 'Beto', role: 'Guide', photo: media(10, 90) }],
    });

    const photo = container.querySelector('.team-photo img');
    expect(photo).not.toBeNull();
    expect(photo).toHaveStyle({ objectPosition: '10% 90%' });
    expect(photo).toHaveStyle({ objectFit: 'cover' });
  });

  it('defaults a null-focal team photo to 50% 50%', async () => {
    const { container } = await renderHome({
      teamItems: [{ name: 'Beto', role: 'Guide', photo: media(null, null) }],
    });

    expect(container.querySelector('.team-photo img')).toHaveStyle({ objectPosition: '50% 50%' });
  });
});
