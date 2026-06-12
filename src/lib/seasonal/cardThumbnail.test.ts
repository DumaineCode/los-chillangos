import { describe, expect, it } from 'vitest';

import type { Media, Tour } from '../../payload-types';

import { selectCardThumbnailUrl } from './cardThumbnail';

/**
 * Unit coverage for the home-grid card thumbnail resolver.
 *
 * Priority (spec — Task 2):
 *   heroImage → seasonal.seasonalHero.image → seasonal.seasonalHero.poster → null
 *
 * The video is NEVER used in the grid (the poster covers the video case).
 * Non-seasonal tours must NEVER read seasonal media, even if it is populated.
 */

function media(url: string): Media {
  return { id: 1, url, updatedAt: '', createdAt: '' } as Media;
}

function tour(overrides: Partial<Tour>): Tour {
  return { id: 1, slug: 't', title: 'T', price: 0, shortDescription: '', ...overrides } as Tour;
}

describe('selectCardThumbnailUrl', () => {
  it('returns the heroImage url for a standard tour with a hero', () => {
    const result = selectCardThumbnailUrl(tour({ heroImage: media('/hero.jpg') }));
    expect(result).toBe('/hero.jpg');
  });

  it('falls back to the seasonal hero image when a seasonal tour has no heroImage', () => {
    const result = selectCardThumbnailUrl(
      tour({
        isSeasonal: true,
        heroImage: null,
        seasonal: { seasonalHero: { mediaType: 'image', image: media('/seasonal.jpg') } },
      })
    );
    expect(result).toBe('/seasonal.jpg');
  });

  it('falls back to the seasonal poster when a seasonal video tour has no image', () => {
    const result = selectCardThumbnailUrl(
      tour({
        isSeasonal: true,
        heroImage: null,
        seasonal: {
          seasonalHero: { mediaType: 'video', image: null, poster: media('/poster.jpg') },
        },
      })
    );
    expect(result).toBe('/poster.jpg');
  });

  it('returns null for a seasonal tour with no resolvable media (keeps placeholder)', () => {
    const result = selectCardThumbnailUrl(
      tour({
        isSeasonal: true,
        heroImage: null,
        seasonal: { seasonalHero: { mediaType: 'image', image: null, poster: null } },
      })
    );
    expect(result).toBeNull();
  });

  it('never reads seasonal media for a non-seasonal tour, even if populated', () => {
    const result = selectCardThumbnailUrl(
      tour({
        isSeasonal: false,
        heroImage: null,
        seasonal: { seasonalHero: { mediaType: 'image', image: media('/seasonal.jpg') } },
      })
    );
    expect(result).toBeNull();
  });

  it('prefers heroImage over seasonal media when both exist on a seasonal tour', () => {
    const result = selectCardThumbnailUrl(
      tour({
        isSeasonal: true,
        heroImage: media('/hero.jpg'),
        seasonal: { seasonalHero: { mediaType: 'image', image: media('/seasonal.jpg') } },
      })
    );
    expect(result).toBe('/hero.jpg');
  });
});
