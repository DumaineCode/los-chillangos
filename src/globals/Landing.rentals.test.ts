import { describe, expect, it } from 'vitest';
import type { Field, TabsField } from 'payload';

import { Landing } from './Landing';

// ---------------------------------------------------------------------------
// Landing `rentals` named tab (R6) — featured rentals home block config.
//
// The home page renders a featured rentals block (eyebrow/title/sub + CTA
// label) linking to /rentals. Like every Landing section it lives as a NAMED
// tab so its data namespaces under `landing.rentals.*` (the section field names
// collide across tabs). This test asserts the tab exists with the expected
// localized marketing fields — mirroring the seasonal tab that already lives in
// Landing and relates to a collection.
// ---------------------------------------------------------------------------

function getTabs(): TabsField {
  const tabsField = Landing.fields.find((f): f is TabsField => f.type === 'tabs');
  if (!tabsField) throw new Error('Landing has no tabs field');
  return tabsField;
}

function getRentalsTab() {
  const tabs = getTabs();
  const tab = tabs.tabs.find((t) => 'name' in t && t.name === 'rentals');
  if (!tab) throw new Error('Landing has no rentals tab');
  return tab;
}

function fieldByName(fields: Field[], name: string): Field | undefined {
  return fields.find((f) => 'name' in f && f.name === name);
}

describe('Landing — rentals named tab (R6)', () => {
  it('defines a `rentals` named tab so its data namespaces under landing.rentals', () => {
    const tab = getRentalsTab();
    expect('name' in tab && tab.name).toBe('rentals');
    // Named tab → localized human label, mirroring the other Landing tabs.
    expect(tab.label).toEqual({ en: 'Bike rentals', es: 'Renta de bicicletas' });
  });

  it('exposes localized eyebrow/title/sub + ctaLabel marketing fields', () => {
    const tab = getRentalsTab();
    const fields = 'fields' in tab ? tab.fields : [];

    for (const name of ['eyebrow', 'title', 'sub', 'ctaLabel']) {
      const field = fieldByName(fields, name);
      expect(field, `expected a "${name}" field on the rentals tab`).toBeDefined();
      // Marketing copy is localized (slug/destination are not — the CTA points
      // at the fixed /rentals route via next-intl's localized Link).
      expect(
        field && 'localized' in field && field.localized,
        `expected "${name}" to be localized`
      ).toBe(true);
    }
  });
});
