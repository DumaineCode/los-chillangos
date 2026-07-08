import { describe, expect, it } from 'vitest';
import type { ArrayField, Field, TextField, TabsField } from 'payload';

import { Landing } from './Landing';

// ---------------------------------------------------------------------------
// Landing `rentals` named tab — home rentals PRICE LIST config.
//
// The business rents ONE bike in ONE size, so the home block is a simple,
// CMS-editable price list (a set of duration options each with its price, an
// optional helmet add-on, and a contact CTA) — NOT a catalog. Like every
// Landing section it lives as a NAMED tab so its data namespaces under
// `landing.rentals.*`. These tests assert the tab exists with the expected
// fields, including the editable `durations` array and the CTA destination.
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

describe('Landing — rentals named tab', () => {
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
      const field = fieldByName(fields, name) as TextField | undefined;
      expect(field, `expected a "${name}" field on the rentals tab`).toBeDefined();
      // Marketing copy is localized (the CTA destination is NOT — it ships its
      // own #rentals-home / WhatsApp default, kept shared across locales).
      expect(
        field && 'localized' in field && field.localized,
        `expected "${name}" to be localized`
      ).toBe(true);
    }
  });

  it('exposes a `durations` array of priced options with a localized label', () => {
    const fields = 'fields' in getRentalsTab() ? getRentalsTab().fields : [];
    const durations = fieldByName(fields, 'durations') as ArrayField | undefined;
    expect(durations, 'expected a "durations" array field').toBeDefined();
    expect(durations?.type).toBe('array');

    const label = durations?.fields.find((f): f is TextField => 'name' in f && f.name === 'label');
    expect(label, 'expected a localized "label" subfield').toBeDefined();
    expect(label && 'localized' in label && label.localized).toBe(true);
    expect(label?.required).toBe(true);

    const price = durations?.fields.find((f): f is TextField => 'name' in f && f.name === 'price');
    expect(price, 'expected a (non-localized) "price" subfield').toBeDefined();
    expect(price && 'localized' in price && price.localized).toBeFalsy();
    expect(price?.required).toBe(true);
  });

  it('exposes optional helmet label/price fields and a CTA destination defaulting to #contact', () => {
    const fields = 'fields' in getRentalsTab() ? getRentalsTab().fields : [];

    const helmetLabel = fieldByName(fields, 'helmetLabel') as TextField | undefined;
    expect(helmetLabel, 'expected a "helmetLabel" field').toBeDefined();
    expect(helmetLabel && 'localized' in helmetLabel && helmetLabel.localized).toBe(true);

    const helmetPrice = fieldByName(fields, 'helmetPrice') as TextField | undefined;
    expect(helmetPrice, 'expected a "helmetPrice" field').toBeDefined();
    // Price is display text, shared across locales (no math anywhere).
    expect(helmetPrice && 'localized' in helmetPrice && helmetPrice.localized).toBeFalsy();

    // The rentals-block CTA points at the on-page contact section by default; the
    // hero "Rent a bike" CTA is the one that defaults to #rentals-home (covered
    // in Landing.hero.test.ts).
    const ctaHref = fieldByName(fields, 'ctaHref') as TextField | undefined;
    expect(ctaHref, 'expected a "ctaHref" field').toBeDefined();
    expect(ctaHref && 'defaultValue' in ctaHref && ctaHref.defaultValue).toBe('#contact');
  });
});
