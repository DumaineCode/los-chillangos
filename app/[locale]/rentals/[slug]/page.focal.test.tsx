import { render, screen } from '@testing-library/react';
import type { ComponentProps, CSSProperties } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RentalDetailPage from './page';

// ---------------------------------------------------------------------------
// Rental detail page (R5) — localized copy, gallery, informative price, and
// accessories with photos; 404 on a missing/unpublished slug.
//
// RentalDetailPage is an async RSC. We mock the Payload boundary and runtime
// (next-intl, next/headers draftMode, next/navigation notFound, next/image,
// Link, RefreshRouteOnSave) and assert behaviour visible to the user:
//   - the bike name, description, characteristics, and verbatim price render;
//   - each accessory renders its localized name, photo, and optional price;
//   - an unknown slug triggers notFound() (404).
// ---------------------------------------------------------------------------

const findMock = vi.fn();

vi.mock('../../../../src/lib/payload', () => ({
  getPayload: () => Promise.resolve({ find: findMock }),
}));

vi.mock('next/headers', () => ({
  draftMode: () => Promise.resolve({ isEnabled: false }),
}));

const notFoundError = new Error('NEXT_NOT_FOUND');
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw notFoundError;
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
  default: ({ src, alt, style }: { src: string; alt: string; style?: CSSProperties }) => (
    <img src={src} alt={alt} style={style} />
  ),
}));

vi.mock('../../../../src/components/RefreshRouteOnSave', () => ({
  RefreshRouteOnSave: () => null,
}));

type Media = { id: number; url: string; alt: string; updatedAt: string; createdAt: string };

function media(id: number, url: string, alt: string): Media {
  return { id, url, alt, updatedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
}

function makeRental(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'montana-ebike',
    name: 'Montaña E-Bike',
    description: 'A capable trail bike.',
    characteristics: 'Mid-drive motor · 80km range',
    price: '$150/day',
    heroImage: null,
    gallery: [],
    accessories: [],
    _status: 'published',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function renderDetail(rental: Record<string, unknown> | null) {
  findMock.mockResolvedValue({ docs: rental ? [rental] : [] });
  const ui = await RentalDetailPage({
    params: Promise.resolve({ locale: 'es', slug: 'montana-ebike' }),
  });
  return render(ui);
}

beforeEach(() => {
  findMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RentalDetailPage (R5)', () => {
  it('renders localized copy, verbatim price, and accessories with photos', async () => {
    await renderDetail(
      makeRental({
        name: 'Bici de Montaña',
        description: 'Una bici capaz para senderos.',
        characteristics: 'Motor central · 80km de autonomía',
        price: '$150/día',
        heroImage: media(10, '/media/hero.jpg', 'Bici en la cima'),
        accessories: [
          { id: 'a1', name: 'Casco', photo: media(20, '/media/helmet.jpg', 'Casco'), price: '$50/día' },
          { id: 'a2', name: 'Candado', photo: media(21, '/media/lock.jpg', 'Candado'), price: null },
        ],
      })
    );

    // Localized copy + verbatim price. The name renders in BOTH the breadcrumb
    // and the <h1>; assert the heading specifically (mirrors tours detail).
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bici de Montaña');
    expect(screen.getByText('Una bici capaz para senderos.')).toBeInTheDocument();
    expect(screen.getByText('Motor central · 80km de autonomía')).toBeInTheDocument();
    expect(screen.getByText('$150/día')).toBeInTheDocument();

    // Each accessory renders its localized name.
    expect(screen.getByText('Casco')).toBeInTheDocument();
    expect(screen.getByText('Candado')).toBeInTheDocument();
    // The accessory with a price shows it verbatim.
    expect(screen.getByText('$50/día')).toBeInTheDocument();

    // Accessory photos render (helmet + lock); hero also renders an image.
    const imgs = Array.from(document.querySelectorAll('img')).map((i) => i.getAttribute('src'));
    expect(imgs.some((src) => src?.includes('/media/helmet.jpg'))).toBe(true);
    expect(imgs.some((src) => src?.includes('/media/lock.jpg'))).toBe(true);
  });

  it('renders a rental with no accessories (triangulation) without the accessories list', async () => {
    await renderDetail(
      makeRental({ name: 'City Cruiser', price: '$90/day', accessories: [] })
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('City Cruiser');
    expect(screen.getByText('$90/day')).toBeInTheDocument();
    // No accessory rows when the array is empty.
    expect(screen.queryByTestId('accessory')).toBeNull();
  });

  it('calls notFound() (404) for an unknown / unpublished slug', async () => {
    await expect(renderDetail(null)).rejects.toThrowError('NEXT_NOT_FOUND');
  });
});
