import { render } from '@testing-library/react';
import type { ComponentProps, CSSProperties } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TourDetailPage from './page';

// ---------------------------------------------------------------------------
// Focal-point integration for the tour detail GalleryTile (FR-13).
//
// One change in GalleryTile covers the cover tile (gallery[0]) and every other
// gallery tile, each honoring its OWN focal point. TourDetailPage is an async Server
// Component, so we mock the runtime boundary and render the resolved tree. The
// next/image mock forwards `style` so we can read object-position per tile.
// ---------------------------------------------------------------------------

const findMock = vi.fn();

vi.mock('../../../../src/lib/payload', () => ({
  // `findGlobal` backs the booking-settings lookup added to the tour page
  // (free-cancellation window); the focal tests don't assert it, so a null
  // stub is enough — the page guards it with `?.` + `??` fallback.
  getPayload: () => Promise.resolve({ find: findMock, findGlobal: () => Promise.resolve(null) }),
}));

vi.mock('next/headers', () => ({
  draftMode: () => Promise.resolve({ isEnabled: false }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound() called — fixture tour should resolve');
  },
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock('../../../../i18n/navigation', () => ({
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

vi.mock('../../../../src/components/TourMap', () => ({ TourMap: () => null }));
vi.mock('../../../../src/components/seasonal/SeasonalTourLayout', () => ({
  SeasonalTourLayout: () => null,
}));
vi.mock('../../../../src/components/RefreshRouteOnSave', () => ({
  RefreshRouteOnSave: () => null,
}));

type FocalMedia = {
  id: number;
  url: string;
  alt: string;
  focalX: number | null;
  focalY: number | null;
  updatedAt: string;
};

function media(focalX: number | null, focalY: number | null, url: string): FocalMedia {
  return { id: Math.round(Math.random() * 1e9), url, alt: '', focalX, focalY, updatedAt: '2026-01-01T00:00:00.000Z' };
}

function makeTour(overrides: Record<string, unknown>) {
  return {
    id: 1,
    slug: 'centro-ride',
    title: 'Centro Ride',
    category: 'ebike',
    duration: '3h',
    price: 80,
    _status: 'published',
    isSeasonal: false,
    gallery: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function renderTour(tour: Record<string, unknown>) {
  findMock.mockResolvedValue({ docs: [tour] });
  const ui = await TourDetailPage({
    params: Promise.resolve({ locale: 'en', slug: 'centro-ride' }),
  });
  return render(ui);
}

beforeEach(() => {
  findMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TourDetailPage — GalleryTile focal points (FR-13)', () => {
  it('frames the cover tile (gallery[0]) and each gallery tile by its own focal point', async () => {
    const { container } = await renderTour(
      makeTour({
        gallery: [
          { image: media(80, 20, '/media/g0.jpg') },
          { image: media(10, 90, '/media/g1.jpg') },
          { image: media(35, 60, '/media/g2.jpg') },
        ],
      })
    );

    const imgs = container.querySelectorAll('.gallery-img img');
    expect(imgs).toHaveLength(3);
    // gallery[0] leads (the cover), then each tile honors its OWN focal independently.
    expect(imgs[0]).toHaveStyle({ objectPosition: '80% 20%' });
    expect(imgs[1]).toHaveStyle({ objectPosition: '10% 90%' });
    expect(imgs[2]).toHaveStyle({ objectPosition: '35% 60%' });
    expect(imgs[0]).toHaveStyle({ objectFit: 'cover' });
  });

  it('caps the rendered gallery at 5 tiles', async () => {
    const { container } = await renderTour(
      makeTour({
        gallery: Array.from({ length: 8 }, (_, i) => ({
          image: media(50, 50, `/media/g${i}.jpg`),
        })),
      })
    );

    const imgs = container.querySelectorAll('.gallery-img img');
    expect(imgs).toHaveLength(5);
  });

  it('defaults a null-focal tile to 50% 50%', async () => {
    const { container } = await renderTour(
      makeTour({ gallery: [{ image: media(null, null, '/media/g0.jpg') }] })
    );

    const imgs = container.querySelectorAll('.gallery-img img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveStyle({ objectPosition: '50% 50%' });
  });
});
