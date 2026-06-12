import { describe, expect, it } from 'vitest';

import {
  isHeroImageRequired,
  isStandardFieldVisible,
  validateHeroImage,
} from './fieldVisibility';

/**
 * Unit tests for the admin field-visibility predicates used by the Tours
 * collection. These pure functions back the `admin.condition` and `validate`
 * hooks so the duplicated/always-visible field behavior is testable outside
 * the Payload admin (which cannot be rendered in vitest).
 *
 * Acceptance criteria (owner complaint — seasonal tour admin UX):
 *   - Standard-only fields (heroImage, photoDescription, gallery, aboutP1/P2,
 *     headlineA/B) must HIDE when the tour is seasonal and SHOW otherwise.
 *   - heroImage is required ONLY for standard tours; a seasonal tour publishes
 *     without it (it uses `seasonal.seasonalHero` instead).
 *   - Non-seasonal behavior is unchanged: heroImage stays required.
 */

describe('isStandardFieldVisible', () => {
  it('hides standard-only fields when the tour is seasonal', () => {
    expect(isStandardFieldVisible({ isSeasonal: true })).toBe(false);
  });

  it('shows standard-only fields when the tour is explicitly not seasonal', () => {
    expect(isStandardFieldVisible({ isSeasonal: false })).toBe(true);
  });

  it('shows standard-only fields for legacy tours (isSeasonal null)', () => {
    expect(isStandardFieldVisible({ isSeasonal: null })).toBe(true);
  });

  it('shows standard-only fields when data is undefined', () => {
    expect(isStandardFieldVisible(undefined)).toBe(true);
  });
});

describe('isHeroImageRequired', () => {
  it('does not require heroImage for seasonal tours', () => {
    expect(isHeroImageRequired({ isSeasonal: true })).toBe(false);
  });

  it('requires heroImage for standard tours', () => {
    expect(isHeroImageRequired({ isSeasonal: false })).toBe(true);
  });

  it('requires heroImage for legacy tours (isSeasonal null)', () => {
    expect(isHeroImageRequired({ isSeasonal: null })).toBe(true);
  });
});

describe('validateHeroImage', () => {
  it('passes for a seasonal tour even with no hero image', () => {
    expect(validateHeroImage(undefined, { data: { isSeasonal: true } })).toBe(true);
  });

  it('passes for a seasonal tour with no data branch resolved to seasonal', () => {
    expect(validateHeroImage(null, { data: { isSeasonal: true } })).toBe(true);
  });

  it('fails for a standard tour with no hero image', () => {
    expect(validateHeroImage(undefined, { data: { isSeasonal: false } })).toBe(
      'Hero image is required.'
    );
  });

  it('passes for a standard tour with a hero image upload id', () => {
    expect(validateHeroImage(42, { data: { isSeasonal: false } })).toBe(true);
  });

  it('fails for a legacy tour (isSeasonal null) with no hero image', () => {
    expect(validateHeroImage(null, { data: { isSeasonal: null } })).toBe(
      'Hero image is required.'
    );
  });
});
