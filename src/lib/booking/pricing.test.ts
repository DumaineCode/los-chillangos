import { describe, expect, it } from 'vitest';

import { calculatePrice, extrasAmount, type SelectedExtra } from './pricing';
import { computeBookingTotals } from './totals';

describe('extrasAmount', () => {
  it('adds a total-type extra once regardless of headcount', () => {
    const xs: SelectedExtra[] = [{ price: 80, priceType: 'total' }];

    expect(extrasAmount(xs, 4)).toBe(80);
    expect(extrasAmount(xs, 1)).toBe(80);
  });

  it('scales a perPerson-type extra by pax', () => {
    const xs: SelectedExtra[] = [{ price: 20, priceType: 'perPerson' }];

    // adults=2 + teens=1 → pax=3
    expect(extrasAmount(xs, 3)).toBe(60);
  });

  it('sums multiple extras additively (total + perPerson)', () => {
    const xs: SelectedExtra[] = [
      { price: 80, priceType: 'total' },
      { price: 20, priceType: 'perPerson' },
    ];

    // 80 (once) + 20*3 (per person) = 140
    expect(extrasAmount(xs, 3)).toBe(140);
  });

  it('returns 0 for an empty selection', () => {
    expect(extrasAmount([], 4)).toBe(0);
  });
});

describe('calculatePrice', () => {
  it('returns just adults × price when no teens and no extras', () => {
    const b = calculatePrice({ pricePerAdult: 89, adults: 2, teens: 0, selectedExtras: [] });

    expect(b.subtotal).toBe(178);
    expect(b.extras).toBe(0);
    expect(b.total).toBe(178);
  });

  it('charges teens at the same per-person price (no discount)', () => {
    // Teen discount was removed — the wizard preview must match what
    // computeBookingTotals (and therefore Stripe) actually charges.
    const b = calculatePrice({ pricePerAdult: 89, adults: 2, teens: 1, selectedExtras: [] });

    expect(b.subtotal).toBe(89 * 3);
    expect(b.total).toBe(89 * 3);
  });

  it('adds a flat (total) extra once on top of the subtotal', () => {
    // Replaces the legacy hardcoded +140 privatize add-on: "Tour privado" is
    // now just an extra (price 140, type total) flowing through selectedExtras.
    const b = calculatePrice({
      pricePerAdult: 89,
      adults: 2,
      teens: 0,
      selectedExtras: [{ price: 140, priceType: 'total' }],
    });

    expect(b.extras).toBe(140);
    expect(b.total).toBe(178 + 140);
  });

  it('no-extras regression: total equals the base subtotal exactly', () => {
    const b = calculatePrice({ pricePerAdult: 75, adults: 2, teens: 2, selectedExtras: [] });

    expect(b.extras).toBe(0);
    expect(b.total).toBe(b.subtotal);
    expect(b.total).toBe(75 * 4);
  });

  it('handles solo booking', () => {
    const b = calculatePrice({ pricePerAdult: 100, adults: 1, teens: 0, selectedExtras: [] });

    expect(b.total).toBe(100);
  });
});

/**
 * Regression guard: the wizard preview (`calculatePrice`) and the persisted
 * snapshot (`computeBookingTotals`) MUST agree on the total for the same
 * inputs — INCLUDING the unified `selectedExtras` contract. If anyone applies
 * extras math to one side and not the other, this test fails (this is exactly
 * the drift the Stripe "charged more than preview" bug exposed).
 *
 * The legacy privatize fixtures were rewritten as selectedExtras fixtures: the
 * privatize path no longer exists in the active flow.
 */
describe('calculatePrice ↔ computeBookingTotals parity', () => {
  const fixtures: ReadonlyArray<{
    name: string;
    pricePerAdult: number;
    adults: number;
    teens: number;
    selectedExtras: SelectedExtra[];
  }> = [
    { name: 'adults only, no extras', pricePerAdult: 89, adults: 2, teens: 0, selectedExtras: [] },
    { name: 'with teens, no extras', pricePerAdult: 89, adults: 2, teens: 1, selectedExtras: [] },
    {
      name: 'flat extra (Tour privado 140, total) once',
      pricePerAdult: 89,
      adults: 2,
      teens: 0,
      selectedExtras: [{ price: 140, priceType: 'total' }],
    },
    {
      name: 'flat extra with teens — still added once',
      pricePerAdult: 89,
      adults: 3,
      teens: 2,
      selectedExtras: [{ price: 140, priceType: 'total' }],
    },
    {
      name: 'perPerson extra scales by pax',
      pricePerAdult: 80,
      adults: 2,
      teens: 1,
      selectedExtras: [{ price: 20, priceType: 'perPerson' }],
    },
    {
      name: 'multiple extras additive (80 total + 20 perPerson × 3 = 140)',
      pricePerAdult: 80,
      adults: 2,
      teens: 1,
      selectedExtras: [
        { price: 80, priceType: 'total' },
        { price: 20, priceType: 'perPerson' },
      ],
    },
    { name: 'solo adult', pricePerAdult: 100, adults: 1, teens: 0, selectedExtras: [] },
    { name: 'family of four', pricePerAdult: 75, adults: 2, teens: 2, selectedExtras: [] },
  ];

  for (const f of fixtures) {
    it(`returns the same total for: ${f.name}`, () => {
      const wizard = calculatePrice({
        pricePerAdult: f.pricePerAdult,
        adults: f.adults,
        teens: f.teens,
        selectedExtras: f.selectedExtras,
      });
      const snapshot = computeBookingTotals({
        adults: f.adults,
        teens: f.teens,
        pricePerPerson: f.pricePerAdult,
        selectedExtras: f.selectedExtras,
      });

      expect(wizard.total).toBe(snapshot.totalAmount);
    });
  }
});
