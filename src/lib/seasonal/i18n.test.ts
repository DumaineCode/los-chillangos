import { describe, expect, it } from 'vitest';

import enMessages from '../../../messages/en.json';
import esMessages from '../../../messages/es.json';

/**
 * i18n coverage for the `seasonal` namespace.
 *
 * Acceptance criteria (spec: "i18n coverage"): every static seasonal key must
 * resolve in BOTH en and es with no missing-key fallback. We assert structural
 * parity (same keys both locales) and that every value is a non-empty string.
 */

const REQUIRED_KEYS = [
  'eyebrow',
  'featuredLabel',
  'dateLabel',
  'locationLabel',
  'storyEyebrow',
  'galleryEyebrow',
  'viewEvent',
  'back',
  'bookCta',
  'comingSoon',
] as const;

function seasonalOf(messages: Record<string, unknown>): Record<string, string> {
  const ns = messages['seasonal'];
  expect(ns, 'seasonal namespace must exist').toBeDefined();
  return ns as Record<string, string>;
}

describe('seasonal i18n coverage', () => {
  it('defines every required seasonal key in English with a non-empty value', () => {
    const en = seasonalOf(enMessages as Record<string, unknown>);
    for (const key of REQUIRED_KEYS) {
      expect(typeof en[key], `en.seasonal.${key}`).toBe('string');
      expect(en[key].trim().length, `en.seasonal.${key} non-empty`).toBeGreaterThan(0);
    }
  });

  it('defines every required seasonal key in Spanish with a non-empty value', () => {
    const es = seasonalOf(esMessages as Record<string, unknown>);
    for (const key of REQUIRED_KEYS) {
      expect(typeof es[key], `es.seasonal.${key}`).toBe('string');
      expect(es[key].trim().length, `es.seasonal.${key} non-empty`).toBeGreaterThan(0);
    }
  });

  it('has identical seasonal key sets across en and es (no missing-key fallback)', () => {
    const en = seasonalOf(enMessages as Record<string, unknown>);
    const es = seasonalOf(esMessages as Record<string, unknown>);
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });
});
