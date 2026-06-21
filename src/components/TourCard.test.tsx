import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Media, Tour } from '../payload-types';
import { TourCard } from './TourCard';

// Locale-aware Link wraps next/navigation (unresolvable in jsdom).
vi.mock('../../i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: ComponentProps<'a'> & { href: unknown }) => (
    <a href={typeof href === 'string' ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

// getTranslations is a server-only async helper; stub it with an identity-ish fn.
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

function media(url: string, focal?: { focalX: number; focalY: number }): Media {
  return { id: 1, url, alt: '', updatedAt: '', createdAt: '', ...focal } as Media;
}

function tour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 1,
    slug: 'centro',
    title: 'Centro Histórico',
    price: 45,
    duration: '3h',
    shortDescription: 'A ride through downtown.',
    ...overrides,
  } as Tour;
}

/**
 * TourCard focal-point integration (FR-1, FR-5).
 *
 * The home-grid thumbnail carries its focal point as object-position; tours with
 * no resolvable media render the placeholder block with no <img>.
 */
describe('TourCard — focal point', () => {
  it('applies the hero focal point as object-position (FR-1)', async () => {
    render(await TourCard({ tour: tour({ heroImage: media('/hero.jpg', { focalX: 60, focalY: 20 }) }), locale: 'en' }));

    const img = screen.getByRole('img');
    expect(img).toHaveStyle({ objectPosition: '60% 20%' });
    expect(img).toHaveStyle({ objectFit: 'cover' });
  });

  it('renders no image when no media resolves (FR-5, keeps placeholder)', async () => {
    render(await TourCard({ tour: tour({ heroImage: null }), locale: 'en' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Centro Histórico')).toBeInTheDocument();
  });
});
