import { describe, expect, it } from 'vitest';

import type { SeasonalFeature, Tour } from '../../payload-types';
import { selectFeatured } from './selectFeatured';

/**
 * Unit tests for `selectFeatured` — the pure resolution logic that decides
 * which tour (if any) is the active seasonal feature.
 *
 * Acceptance criteria (spec: "Owner selects the active seasonal tour" +
 * "Landing highlight"):
 *   - enabled + ref + published + isSeasonal  → returns that tour
 *   - disabled                                → null
 *   - ref unset                               → null
 *   - ref not present in the tour map         → null
 *   - tour exists but not published           → null
 *   - tour exists but not seasonal            → null
 */

function makeTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 7,
    slug: 'dia-de-muertos',
    title: 'Día de Muertos',
    category: 'walking',
    duration: '4h',
    price: 120,
    shortDescription: 'A seasonal night.',
    isSeasonal: true,
    _status: 'published',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Tour;
}

function makeGlobal(overrides: Partial<SeasonalFeature> = {}): SeasonalFeature {
  return {
    id: 1,
    enabled: true,
    eyebrow: 'This season',
    featuredSeasonalTour: 7,
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('selectFeatured', () => {
  it('returns the tour when enabled + ref + published + isSeasonal', () => {
    const tour = makeTour();
    const result = selectFeatured(makeGlobal(), new Map([[7, tour]]));
    expect(result).toBe(tour);
    expect(result?.slug).toBe('dia-de-muertos');
  });

  it('returns null when the feature is disabled', () => {
    const tour = makeTour();
    const result = selectFeatured(makeGlobal({ enabled: false }), new Map([[7, tour]]));
    expect(result).toBeNull();
  });

  it('returns null when featuredSeasonalTour is unset', () => {
    const result = selectFeatured(
      makeGlobal({ featuredSeasonalTour: null }),
      new Map([[7, makeTour()]])
    );
    expect(result).toBeNull();
  });

  it('returns null when the referenced id is not in the tour map', () => {
    const result = selectFeatured(makeGlobal({ featuredSeasonalTour: 99 }), new Map([[7, makeTour()]]));
    expect(result).toBeNull();
  });

  it('returns null when the referenced tour is not published', () => {
    const tour = makeTour({ _status: 'draft' });
    const result = selectFeatured(makeGlobal(), new Map([[7, tour]]));
    expect(result).toBeNull();
  });

  it('returns null when the referenced tour is not seasonal', () => {
    const tour = makeTour({ isSeasonal: false });
    const result = selectFeatured(makeGlobal(), new Map([[7, tour]]));
    expect(result).toBeNull();
  });

  it('resolves the id when featuredSeasonalTour is a populated tour object', () => {
    const tour = makeTour();
    const result = selectFeatured(
      makeGlobal({ featuredSeasonalTour: { ...tour } }),
      new Map([[7, tour]])
    );
    expect(result).toBe(tour);
  });
});
