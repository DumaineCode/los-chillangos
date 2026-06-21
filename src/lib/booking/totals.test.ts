import { describe, expect, it } from 'vitest';

import { computeBookingTotals } from './totals';

describe('computeBookingTotals', () => {
  it('sums adults only when teens=0 and no extras', () => {
    const out = computeBookingTotals({
      adults: 2,
      teens: 0,
      pricePerPerson: 89,
      selectedExtras: [],
    });

    expect(out.totalPersons).toBe(2);
    expect(out.totalAmount).toBe(178);
  });

  it('charges teens at the same per-person price (no discount)', () => {
    // Everyone pays the flat per-person price — adults and teens alike.
    // The wizard preview (`calculatePrice`) mirrors this; the parity test
    // in `pricing.test.ts` guards against drift.
    const out = computeBookingTotals({
      adults: 2,
      teens: 1,
      pricePerPerson: 89,
      selectedExtras: [],
    });

    expect(out.totalPersons).toBe(3);
    expect(out.totalAmount).toBe(89 * 3);
  });

  it('adds a flat (total) extra once on top of headcount × price', () => {
    // "Tour privado" is now an extra (140, total) flowing through the unified
    // contract — there is no privatize boolean in the active path anymore.
    const out = computeBookingTotals({
      adults: 2,
      teens: 0,
      pricePerPerson: 89,
      selectedExtras: [{ price: 140, priceType: 'total' }],
    });

    expect(out.totalAmount).toBe(178 + 140);
  });

  it('scales a perPerson extra by headcount', () => {
    const out = computeBookingTotals({
      adults: 2,
      teens: 1,
      pricePerPerson: 80,
      selectedExtras: [{ price: 20, priceType: 'perPerson' }],
    });

    // base 80*3 = 240, extra 20*3 = 60
    expect(out.totalAmount).toBe(240 + 60);
  });

  it('no-extras regression: total equals the base subtotal exactly', () => {
    const out = computeBookingTotals({
      adults: 1,
      teens: 0,
      pricePerPerson: 100,
      selectedExtras: [],
    });

    expect(out.totalAmount).toBe(100);
  });

  it('handles solo booking', () => {
    const out = computeBookingTotals({
      adults: 1,
      teens: 0,
      pricePerPerson: 100,
      selectedExtras: [],
    });

    expect(out.totalPersons).toBe(1);
    expect(out.totalAmount).toBe(100);
  });

  it('treats missing numeric inputs as 0 (defensive)', () => {
    // The collection hook may invoke this with partially-undefined sibling
    // data on a fresh create. We want a deterministic 0, not NaN.
    const out = computeBookingTotals({
      adults: undefined,
      teens: undefined,
      pricePerPerson: undefined,
      selectedExtras: undefined,
    });

    expect(out.totalPersons).toBe(0);
    expect(out.totalAmount).toBe(0);
  });
});
