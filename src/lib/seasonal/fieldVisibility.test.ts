import { describe, expect, it } from 'vitest';

import {
  isStandardFieldVisible,
  isStandardGalleryRequired,
  validateStandardGallery,
} from './fieldVisibility';

/**
 * Unit tests for the admin field-visibility predicates used by the Tours
 * collection. These pure functions back the `admin.condition` and `validate`
 * hooks so the duplicated/always-visible field behavior is testable outside
 * the Payload admin (which cannot be rendered in vitest).
 *
 * Acceptance criteria (single ordered gallery model — AC3, AC6):
 *   - Standard-only fields (gallery, photoDescription, aboutP1/P2) must HIDE
 *     when the tour is seasonal and SHOW otherwise.
 *   - The standard gallery is required (min 1 on publish) ONLY for standard
 *     tours; a seasonal tour publishes without it (it renders
 *     `seasonal.seasonalHero` / `seasonal.gallery` instead).
 *   - Non-seasonal behavior is unchanged: the gallery stays required.
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

describe('isStandardGalleryRequired', () => {
  it('does not require a gallery for seasonal tours', () => {
    expect(isStandardGalleryRequired({ isSeasonal: true })).toBe(false);
  });

  it('requires a gallery for standard tours', () => {
    expect(isStandardGalleryRequired({ isSeasonal: false })).toBe(true);
  });

  it('requires a gallery for legacy tours (isSeasonal null)', () => {
    expect(isStandardGalleryRequired({ isSeasonal: null })).toBe(true);
  });

  it('requires a gallery when data is undefined', () => {
    expect(isStandardGalleryRequired(undefined)).toBe(true);
  });
});

describe('validateStandardGallery', () => {
  it('passes for a seasonal tour even with an empty gallery', () => {
    expect(validateStandardGallery([], { data: { isSeasonal: true } })).toBe(true);
  });

  it('passes for a seasonal tour regardless of value (undefined)', () => {
    expect(validateStandardGallery(undefined, { data: { isSeasonal: true } })).toBe(true);
  });

  it('fails for a standard tour with an empty array', () => {
    expect(validateStandardGallery([], { data: { isSeasonal: false } })).toBe(
      'Add at least one gallery image before publishing.'
    );
  });

  it('fails for a standard tour with an undefined gallery', () => {
    expect(validateStandardGallery(undefined, { data: { isSeasonal: false } })).toBe(
      'Add at least one gallery image before publishing.'
    );
  });

  it('fails for a standard tour with a null gallery', () => {
    expect(validateStandardGallery(null, { data: { isSeasonal: false } })).toBe(
      'Add at least one gallery image before publishing.'
    );
  });

  it('passes for a standard tour with at least one gallery row', () => {
    expect(validateStandardGallery([{ image: 1 }], { data: { isSeasonal: false } })).toBe(true);
  });

  it('passes for an arbitrarily large standard gallery (no max-count rule) (AC4)', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ image: i + 1 }));
    expect(validateStandardGallery(many, { data: { isSeasonal: false } })).toBe(true);
  });

  it('fails for a legacy tour (isSeasonal null) with an empty gallery', () => {
    expect(validateStandardGallery([], { data: { isSeasonal: null } })).toBe(
      'Add at least one gallery image before publishing.'
    );
  });
});
