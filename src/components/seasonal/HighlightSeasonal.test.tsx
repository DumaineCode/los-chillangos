import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import enMessages from '../../../messages/en.json';
import type { Tour } from '../../payload-types';
import { HighlightSeasonal } from './HighlightSeasonal';

// Mock the locale-aware Link (wraps next/navigation, unresolvable in jsdom).
vi.mock('../../../i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: ComponentProps<'a'> & { href: unknown }) => (
    <a href={typeof href === 'string' ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

function makeTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 9,
    slug: 'dia-de-muertos',
    title: 'Día de Muertos',
    category: 'walking',
    duration: '5h',
    price: 145,
    shortDescription: 'A night among the marigolds.',
    isSeasonal: true,
    _status: 'published',
    seasonal: {
      tagline: 'One night the city glows',
      eventLocation: 'Tlaxcala',
      seasonalHero: { mediaType: 'image', image: { id: 1, url: '/media/hero.jpg' } },
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Tour;
}

function renderHighlight(tour: Tour | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HighlightSeasonal tour={tour} eyebrow="This season" locale="en" />
    </NextIntlClientProvider>
  );
}

describe('HighlightSeasonal', () => {
  it('renders a highlight linking to the tour detail page when a tour is set', () => {
    renderHighlight(makeTour());

    expect(screen.getByText('Día de Muertos')).toBeInTheDocument();
    expect(screen.getByText('This season')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('dia-de-muertos'));
  });

  it('renders nothing (no layout node) when no tour is set', () => {
    const { container } = renderHighlight(null);
    expect(container).toBeEmptyDOMElement();
  });
});
