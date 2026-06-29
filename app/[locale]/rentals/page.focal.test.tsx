import { render, screen } from '@testing-library/react';
import type { ComponentProps, CSSProperties } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RentalsCatalogPage from './page';

// ---------------------------------------------------------------------------
// Rentals catalog page (R4) — published-only listing.
//
// RentalsCatalogPage is an async RSC that queries Payload for PUBLISHED
// rentals and renders a RentalCard grid. We mock the Payload boundary and the
// runtime (next-intl, next/image, Link, RentalCard) and assert the page:
//   - queries with a published-only `where`,
//   - renders one card node per returned rental,
//   - renders the localized empty state when there are no rentals.
// Drafts never reach this page because the query filters them out at the DB —
// here we assert the query SHAPE so a regression that drops the filter fails.
// ---------------------------------------------------------------------------

const findMock = vi.fn();

vi.mock('../../../src/lib/payload', () => ({
  getPayload: () => Promise.resolve({ find: findMock }),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock('../../../i18n/navigation', () => ({
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

// Render a deterministic stand-in for each card so we can count grid items and
// read the linked slug without depending on RentalCard's full markup.
vi.mock('../../../src/components/RentalCard', () => ({
  RentalCard: ({ rental }: { rental: { slug?: string | null; name: string } }) => (
    <a data-testid="rental-card" href={`/rentals/${rental.slug}`}>
      {rental.name}
    </a>
  ),
}));

type RentalFixture = { id: number; slug: string; name: string; _status: string };

function rental(id: number, slug: string, name: string): RentalFixture {
  return { id, slug, name, _status: 'published' };
}

async function renderCatalog(docs: RentalFixture[]) {
  findMock.mockResolvedValue({ docs });
  const ui = await RentalsCatalogPage({ params: Promise.resolve({ locale: 'en' }) });
  return render(ui);
}

beforeEach(() => {
  findMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RentalsCatalogPage (R4)', () => {
  it('renders one card per published rental and queries published-only', async () => {
    await renderCatalog([
      rental(1, 'montana-ebike', 'Montaña E-Bike'),
      rental(2, 'city-cruiser', 'City Cruiser'),
    ]);

    const cards = screen.getAllByTestId('rental-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute('href', '/rentals/montana-ebike');
    expect(cards[1]).toHaveAttribute('href', '/rentals/city-cruiser');
    expect(screen.getByText('Montaña E-Bike')).toBeInTheDocument();
    expect(screen.getByText('City Cruiser')).toBeInTheDocument();

    // The DB query MUST filter to published — this is what keeps drafts out of
    // the public catalog (spec R4).
    expect(findMock).toHaveBeenCalledTimes(1);
    const args = findMock.mock.calls[0][0];
    expect(args.collection).toBe('rentals');
    expect(args.where).toEqual({ _status: { equals: 'published' } });
  });

  it('renders the localized empty state and no cards when there are no rentals', async () => {
    await renderCatalog([]);

    expect(screen.queryAllByTestId('rental-card')).toHaveLength(0);
    // The empty-state copy renders via the mocked translator (key passthrough).
    expect(screen.getByText('catalog.empty')).toBeInTheDocument();
  });
});
