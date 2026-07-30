import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import enMessages from '../../../messages/en.json';
import type { Tour } from '../../payload-types';
import { SeasonalTourLayout } from './SeasonalTourLayout';

// The locale-aware Link wraps next/navigation, which vitest can't resolve in
// jsdom. Mock it with a plain anchor that serializes the href so we can assert
// the booking link target (behavior), not the routing internals.
vi.mock('../../../i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: ComponentProps<'a'> & { href: unknown }) => {
    const serialized =
      typeof href === 'string'
        ? href
        : (() => {
            const h = href as unknown as { pathname?: string; query?: Record<string, string> };
            const qs = h.query ? '?' + new URLSearchParams(h.query).toString() : '';
            return `${h.pathname ?? ''}${qs}`;
          })();
    return (
      <a href={serialized} {...rest}>
        {children}
      </a>
    );
  },
}));

/**
 * Component tests for SeasonalTourLayout — the seasonal detail template.
 *
 * Acceptance criteria (spec: "Seasonal detail layout"):
 *   - renders the seasonal hero (tagline, location, event date) from the tour
 *   - reuses the booking sidebar: price + a "Book" link to /book?tour=slug
 *   - degrades gracefully when optional sections are missing (no crash)
 */

function makeTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 5,
    slug: 'dia-de-muertos',
    title: 'Día de Muertos',
    category: 'walking',
    duration: '5h',
    price: 145,
    shortDescription: 'A night among the marigolds.',
    isSeasonal: true,
    _status: 'published',
    seasonal: {
      eventDate: '2026-11-02T00:00:00.000Z',
      eventLocation: 'Tlaxcala',
      tagline: 'One night the city glows',
      seasonalHero: { mediaType: 'image', image: { id: 1, url: '/media/hero.jpg' } },
      gallery: [],
      storytelling: [],
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Tour;
}

function renderLayout(tour: Tour) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SeasonalTourLayout tour={tour} locale="en" freeCancellationDays={3} />
    </NextIntlClientProvider>
  );
}

describe('SeasonalTourLayout', () => {
  it('renders the seasonal hero tagline and location from the tour', () => {
    renderLayout(makeTour());
    expect(screen.getByText('One night the city glows')).toBeInTheDocument();
    expect(screen.getByText('Tlaxcala')).toBeInTheDocument();
  });

  it('reuses the booking sidebar with the tour price and a book link', () => {
    renderLayout(makeTour());
    // Price shown in the booking aside.
    expect(screen.getAllByText('$145').length).toBeGreaterThan(0);
    // Book link targets the standard booking flow with the tour slug.
    const bookLink = screen.getByRole('link', { name: /book/i });
    expect(bookLink).toHaveAttribute('href', expect.stringContaining('/book'));
    expect(bookLink).toHaveAttribute('href', expect.stringContaining('dia-de-muertos'));
  });

  it('labels the sidebar price as per person, never as a total', () => {
    renderLayout(makeTour());
    // `tour.price` is per person — the wizard defaults to 2 adults, so
    // labeling it "Total" showed users a price that then "doubled" at Step 2.
    expect(screen.getByText(enMessages.detail.summary.perPerson)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.detail.summary.total)).not.toBeInTheDocument();
  });

  it('does not crash when gallery and storytelling are missing', () => {
    const tour = makeTour({
      seasonal: {
        tagline: 'Quiet season',
        eventLocation: 'Centro',
        seasonalHero: { mediaType: 'image' },
      },
    } as Partial<Tour>);
    renderLayout(tour);
    // Hero still renders its tagline + location...
    expect(screen.getByText('Quiet season')).toBeInTheDocument();
    expect(screen.getByText('Centro')).toBeInTheDocument();
    // ...but the story and gallery sections are omitted entirely.
    expect(screen.queryByText(enMessages.seasonal.storyEyebrow)).not.toBeInTheDocument();
    expect(screen.queryByText(enMessages.seasonal.galleryEyebrow)).not.toBeInTheDocument();
    // The booking sidebar still works regardless of optional content.
    expect(screen.getByRole('link', { name: /book/i })).toBeInTheDocument();
  });
});
