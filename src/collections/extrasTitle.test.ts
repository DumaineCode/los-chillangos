import { describe, expect, it } from 'vitest';

import { resolveExtraTitle } from './extrasTitle';

/**
 * The Extras collection's `name` field is `localized: true`. Pointing
 * `admin.useAsTitle` at it makes Payload resolve the title per-locale, so each
 * extra shows up TWICE (es + en) in the Tours → extras relationship dropdown.
 *
 * The fix stores a single, NON-localized `title` column populated from the
 * localized name. `resolveExtraTitle` is the pure function that picks ONE
 * stable display string from whatever shape `name` arrives in (a single-locale
 * string on a per-locale write, or an `{ en, es }` object on an all-locales
 * write). Because the stored column holds exactly one value per row, the
 * dropdown lists each extra exactly once.
 *
 * Preference order: es → en → first non-empty locale value.
 */
describe('resolveExtraTitle', () => {
  it('returns a single-locale string write unchanged', () => {
    expect(resolveExtraTitle('Tour privado')).toBe('Tour privado');
  });

  it('prefers the Spanish value from an all-locales object', () => {
    expect(resolveExtraTitle({ en: 'Private tour', es: 'Tour privado' })).toBe('Tour privado');
  });

  it('falls back to English when Spanish is missing', () => {
    expect(resolveExtraTitle({ en: 'Airport transfer', es: '' })).toBe('Airport transfer');
  });

  it('falls back to the first non-empty locale when neither es nor en is set', () => {
    expect(resolveExtraTitle({ en: '', es: '', fr: 'Visite privée' })).toBe('Visite privée');
  });

  it('returns empty string for nullish or empty input', () => {
    expect(resolveExtraTitle(undefined)).toBe('');
    expect(resolveExtraTitle(null)).toBe('');
    expect(resolveExtraTitle('')).toBe('');
    expect(resolveExtraTitle({})).toBe('');
    expect(resolveExtraTitle({ en: '', es: '' })).toBe('');
  });

  it('trims whitespace-only locale values to empty before picking', () => {
    expect(resolveExtraTitle({ en: 'Boat ride', es: '   ' })).toBe('Boat ride');
  });
});
