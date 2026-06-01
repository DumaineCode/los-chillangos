import { describe, expect, it } from 'vitest';

import { computeBookingTotals } from './totals';

describe('computeBookingTotals', () => {
  it('sums adults only when teens=0 and privatize=false', () => {
    const out = computeBookingTotals({
      adults: 2,
      teens: 0,
      pricePerPerson: 89,
      privatize: false,
      privatizeFee: 140,
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
      privatize: false,
      privatizeFee: 140,
    });

    expect(out.totalPersons).toBe(3);
    expect(out.totalAmount).toBe(89 * 3);
  });

  it('adds privatizeFee when privatize=true', () => {
    const out = computeBookingTotals({
      adults: 2,
      teens: 0,
      pricePerPerson: 89,
      privatize: true,
      privatizeFee: 140,
    });

    expect(out.totalAmount).toBe(178 + 140);
  });

  it('does NOT add privatizeFee when privatize=false', () => {
    const out = computeBookingTotals({
      adults: 1,
      teens: 0,
      pricePerPerson: 100,
      privatize: false,
      privatizeFee: 140,
    });

    expect(out.totalAmount).toBe(100);
  });

  it('handles solo booking', () => {
    const out = computeBookingTotals({
      adults: 1,
      teens: 0,
      pricePerPerson: 100,
      privatize: false,
      privatizeFee: 0,
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
      privatize: false,
      privatizeFee: undefined,
    });

    expect(out.totalPersons).toBe(0);
    expect(out.totalAmount).toBe(0);
  });
});
