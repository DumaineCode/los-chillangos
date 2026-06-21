import { describe, expect, it } from 'vitest';

import type { Media, Tour } from '../../payload-types';

import { selectCardThumbnail } from './cardThumbnail';

/**
 * Unit coverage for `selectCardThumbnail` — the structured variant that returns
 * a focal-point-aware `{ url, objectPosition, alt }` for the home-grid card,
 * preserving the same priority chain as `selectCardThumbnailUrl`.
 *
 * Covers FR-1 (focal honored) and FR-5 (single source of truth / null parity).
 */

function media(url: string, focal?: { focalX: number; focalY: number }): Media {
  return { id: 1, url, updatedAt: '', createdAt: '', ...focal } as Media;
}

function tour(overrides: Partial<Tour>): Tour {
  return { id: 1, slug: 't', title: 'T', price: 0, shortDescription: '', ...overrides } as Tour;
}

describe('selectCardThumbnail', () => {
  it('returns the hero image with its focal point as object-position (FR-1)', () => {
    const result = selectCardThumbnail(
      tour({ heroImage: media('/hero.jpg', { focalX: 25, focalY: 75 }) })
    );
    expect(result?.url).toBe('/hero.jpg');
    expect(result?.objectPosition).toBe('25% 75%');
  });

  it('defaults to 50% 50% when the hero has no focal point (FR-2 parity)', () => {
    const result = selectCardThumbnail(tour({ heroImage: media('/hero.jpg') }));
    expect(result?.objectPosition).toBe('50% 50%');
  });

  it('falls back to the seasonal hero image for a seasonal tour without heroImage', () => {
    const result = selectCardThumbnail(
      tour({
        isSeasonal: true,
        heroImage: null,
        seasonal: {
          seasonalHero: { mediaType: 'image', image: media('/seasonal.jpg', { focalX: 10, focalY: 90 }) },
        },
      })
    );
    expect(result?.url).toBe('/seasonal.jpg');
    expect(result?.objectPosition).toBe('10% 90%');
  });

  it('falls back to the seasonal poster when a seasonal video tour has no image', () => {
    const result = selectCardThumbnail(
      tour({
        isSeasonal: true,
        heroImage: null,
        seasonal: {
          seasonalHero: { mediaType: 'video', image: null, poster: media('/poster.jpg') },
        },
      })
    );
    expect(result?.url).toBe('/poster.jpg');
  });

  it('prefers heroImage over seasonal media when both exist on a seasonal tour', () => {
    const result = selectCardThumbnail(
      tour({
        isSeasonal: true,
        heroImage: media('/hero.jpg'),
        seasonal: { seasonalHero: { mediaType: 'image', image: media('/seasonal.jpg') } },
      })
    );
    expect(result?.url).toBe('/hero.jpg');
  });

  it('returns null when nothing resolves (keeps placeholder) (FR-5)', () => {
    const result = selectCardThumbnail(
      tour({
        isSeasonal: true,
        heroImage: null,
        seasonal: { seasonalHero: { mediaType: 'image', image: null, poster: null } },
      })
    );
    expect(result).toBeNull();
  });

  it('never reads seasonal media for a non-seasonal tour (FR-5)', () => {
    const result = selectCardThumbnail(
      tour({
        isSeasonal: false,
        heroImage: null,
        seasonal: { seasonalHero: { mediaType: 'image', image: media('/seasonal.jpg') } },
      })
    );
    expect(result).toBeNull();
  });
});
