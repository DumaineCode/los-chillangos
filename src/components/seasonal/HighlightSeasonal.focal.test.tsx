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
      seasonalHero: {
        mediaType: 'image',
        image: { id: 1, url: '/media/hero.jpg', focalX: 40, focalY: 15 },
      },
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Tour;
}

function renderHighlight(tour: Tour) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HighlightSeasonal tour={tour} eyebrow="This season" locale="en" />
    </NextIntlClientProvider>
  );
}

/**
 * HighlightSeasonal focal-point integration (FR-1, FR-2).
 *
 * The hero banner (or its poster fallback) applies the stored focal point as
 * object-position, defaulting to `50% 50%` for legacy/null focal. The brand
 * stamp <img> is decorative (alt="") and ignored via the cover-image alt.
 */
describe('HighlightSeasonal — focal point', () => {
  it('applies the stored focal point on the hero cover image (FR-1)', () => {
    renderHighlight(makeTour());

    const cover = screen.getByAltText('Día de Muertos');
    expect(cover).toHaveStyle({ objectPosition: '40% 15%' });
    expect(cover).toHaveStyle({ objectFit: 'cover' });
  });

  it('defaults to 50% 50% for legacy/null focal (FR-2)', () => {
    renderHighlight(
      makeTour({
        seasonal: {
          seasonalHero: { mediaType: 'image', image: { id: 1, url: '/media/hero.jpg' } },
        },
      } as Partial<Tour>)
    );

    expect(screen.getByAltText('Día de Muertos')).toHaveStyle({ objectPosition: '50% 50%' });
  });
});
