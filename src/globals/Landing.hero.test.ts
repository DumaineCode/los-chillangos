import { describe, expect, it } from 'vitest';
import type { Field, TabsField } from 'payload';

import { Landing } from './Landing';

// ---------------------------------------------------------------------------
// Landing `hero` named tab — visual-refresh CTA + quote fields.
//
// The hero grows from 2 to 4 CTAs (rentals + plan-your-own-trip) and gains a
// famous-Mexican quote with attribution. Labels and the quote are localized
// marketing copy; hrefs and the author (a proper name) are NOT localized,
// matching the existing ctaPrimary/ctaGhost convention. Hrefs carry
// defaultValues so NEW rows point at /rentals and #contact out of the box —
// existing rows rely on code-side defaults in the page render.
// ---------------------------------------------------------------------------

function getTabs(): TabsField {
  const tabsField = Landing.fields.find((f): f is TabsField => f.type === 'tabs');
  if (!tabsField) throw new Error('Landing has no tabs field');
  return tabsField;
}

function getHeroTab() {
  const tabs = getTabs();
  const tab = tabs.tabs.find((t) => 'name' in t && t.name === 'hero');
  if (!tab) throw new Error('Landing has no hero tab');
  return tab;
}

function heroFieldByName(name: string): Field | undefined {
  const tab = getHeroTab();
  const fields = 'fields' in tab ? tab.fields : [];
  return fields.find((f) => 'name' in f && f.name === name);
}

describe('Landing — hero tab CTA fields (visual refresh)', () => {
  it('exposes localized ctaRentals and ctaPlan label fields', () => {
    for (const name of ['ctaRentals', 'ctaPlan']) {
      const field = heroFieldByName(name);
      expect(field, `expected a "${name}" field on the hero tab`).toBeDefined();
      expect(
        field && 'localized' in field && field.localized,
        `expected "${name}" to be localized`
      ).toBe(true);
    }
  });

  it('exposes non-localized href fields with route defaults', () => {
    const rentalsHref = heroFieldByName('ctaRentalsHref');
    expect(rentalsHref, 'expected a "ctaRentalsHref" field on the hero tab').toBeDefined();
    expect(
      rentalsHref && 'localized' in rentalsHref && rentalsHref.localized,
      'hrefs are shared across locales (next-intl Link localizes routes)'
    ).toBeFalsy();
    expect(rentalsHref && 'defaultValue' in rentalsHref && rentalsHref.defaultValue).toBe(
      '/rentals'
    );

    const planHref = heroFieldByName('ctaPlanHref');
    expect(planHref, 'expected a "ctaPlanHref" field on the hero tab').toBeDefined();
    expect(planHref && 'localized' in planHref && planHref.localized).toBeFalsy();
    expect(planHref && 'defaultValue' in planHref && planHref.defaultValue).toBe('#contact');
  });
});

describe('Landing — hero tab quote fields (visual refresh)', () => {
  it('exposes a localized quote textarea', () => {
    const quote = heroFieldByName('quote');
    expect(quote, 'expected a "quote" field on the hero tab').toBeDefined();
    expect(quote && 'type' in quote && quote.type).toBe('textarea');
    expect(quote && 'localized' in quote && quote.localized, 'quote copy is localized').toBe(true);
  });

  it('exposes a NON-localized quoteAuthor text field (proper name)', () => {
    const author = heroFieldByName('quoteAuthor');
    expect(author, 'expected a "quoteAuthor" field on the hero tab').toBeDefined();
    expect(author && 'type' in author && author.type).toBe('text');
    expect(
      author && 'localized' in author && author.localized,
      'a proper name must not fork per locale'
    ).toBeFalsy();
  });
});
