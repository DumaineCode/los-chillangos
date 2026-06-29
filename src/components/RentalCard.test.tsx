import { render, screen } from '@testing-library/react';
import type { ComponentProps, CSSProperties } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RentalCard } from './RentalCard';
import type { Rental } from '../payload-types';

// ---------------------------------------------------------------------------
// RentalCard (R4) — public summary card for the rentals catalog grid.
//
// RentalCard is a NEW card (it does NOT reuse TourCard, which hard-reads
// tour.price/duration/distance and links to /tours). It mirrors TourCard's
// markup for visual parity but is typed to the Rental payload type: it shows
// the bike name, the informative (verbatim) price, and links to
// /rentals/{slug}. RentalCard is an async Server Component, so we mock the
// runtime boundary (next-intl, next/image, next-intl Link) and await it.
// ---------------------------------------------------------------------------

vi.mock('next-intl/server', () => ({
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

function makeRental(overrides: Partial<Rental> = {}): Rental {
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
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    _status: 'published',
    ...overrides,
  };
}

async function renderCard(rental: Rental) {
  const ui = await RentalCard({ rental, locale: 'en' });
  return render(ui);
}

describe('RentalCard (R4)', () => {
  it('renders the bike name, verbatim price, and links to /rentals/{slug}', async () => {
    const { container } = await renderCard(
      makeRental({ slug: 'montana-ebike', name: 'Montaña E-Bike', price: '$150/day' })
    );

    expect(screen.getByText('Montaña E-Bike')).toBeInTheDocument();
    // Price is shown verbatim — no math, no "$" prefix synthesised by the card.
    expect(screen.getByText('$150/day')).toBeInTheDocument();

    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', '/rentals/montana-ebike');
  });

  it('renders a different rental (triangulation) with its own slug and price', async () => {
    const { container } = await renderCard(
      makeRental({ slug: 'city-cruiser', name: 'City Cruiser', price: '$90/day' })
    );

    expect(screen.getByText('City Cruiser')).toBeInTheDocument();
    expect(screen.getByText('$90/day')).toBeInTheDocument();
    expect(container.querySelector('a')).toHaveAttribute('href', '/rentals/city-cruiser');
  });

  it('renders the hero image with its alt text when a hydrated media doc is present', async () => {
    const { container } = await renderCard(
      makeRental({
        name: 'Montaña E-Bike',
        heroImage: {
          id: 7,
          url: '/media/bike-hero.jpg',
          alt: 'Trail bike on a ridge',
          updatedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        } as Rental['heroImage'],
      })
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', expect.stringContaining('/media/bike-hero.jpg'));
    expect(img).toHaveAttribute('alt', 'Trail bike on a ridge');
  });

  it('falls back to a placeholder block (no img) when no hero image is set', async () => {
    const { container } = await renderCard(makeRental({ name: 'No Photo Bike', heroImage: null }));

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.placeholder')).not.toBeNull();
    // The name still renders so the card never collapses.
    expect(screen.getByText('No Photo Bike')).toBeInTheDocument();
  });
});
