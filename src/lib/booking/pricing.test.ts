import { describe, expect, it } from 'vitest';

import { PRIVATIZE_FLAT, calculatePrice } from './pricing';
import { computeBookingTotals } from './totals';

describe('calculatePrice', () => {
  it('returns just adults × price when no teens and no privatize', () => {
    const b = calculatePrice({ pricePerAdult: 89, adults: 2, teens: 0, privatize: false });

    expect(b.subtotal).toBe(178);
    expect(b.addon).toBe(0);
    expect(b.total).toBe(178);
  });

  it('charges teens at the same per-person price (no discount)', () => {
    // Teen discount was removed — the wizard preview must match what
    // computeBookingTotals (and therefore Stripe) actually charges.
    const b = calculatePrice({ pricePerAdult: 89, adults: 2, teens: 1, privatize: false });

    expect(b.subtotal).toBe(89 * 3);
    expect(b.total).toBe(89 * 3);
  });

  it('adds +140 flat when privatize=true', () => {
    const b = calculatePrice({ pricePerAdult: 89, adults: 2, teens: 0, privatize: true });

    expect(b.addon).toBe(140);
    expect(b.total).toBe(178 + 140);
  });

  it('handles solo booking', () => {
    const b = calculatePrice({ pricePerAdult: 100, adults: 1, teens: 0, privatize: false });

    expect(b.total).toBe(100);
  });
});

/**
 * Regression guard: the wizard preview (`calculatePrice`) and the persisted
 * snapshot (`computeBookingTotals`) MUST agree on the total for the same
 * inputs. If anyone re-adds a discount on one side and not the other, this
 * test fails — which is exactly the bug Sub-etapa C shipped and this fix
 * removes (Stripe was charging more than the wizard preview).
 */
describe('calculatePrice ↔ computeBookingTotals parity', () => {
  const fixtures: ReadonlyArray<{
    name: string;
    pricePerAdult: number;
    adults: number;
    teens: number;
    privatize: boolean;
  }> = [
    { name: 'adults only, no privatize', pricePerAdult: 89, adults: 2, teens: 0, privatize: false },
    { name: 'with teens, no privatize', pricePerAdult: 89, adults: 2, teens: 1, privatize: false },
    { name: 'adults only, privatized', pricePerAdult: 89, adults: 2, teens: 0, privatize: true },
    { name: 'with teens, privatized', pricePerAdult: 89, adults: 3, teens: 2, privatize: true },
    { name: 'solo adult', pricePerAdult: 100, adults: 1, teens: 0, privatize: false },
    { name: 'family of four', pricePerAdult: 75, adults: 2, teens: 2, privatize: false },
  ];

  for (const f of fixtures) {
    it(`returns the same total for: ${f.name}`, () => {
      const wizard = calculatePrice({
        pricePerAdult: f.pricePerAdult,
        adults: f.adults,
        teens: f.teens,
        privatize: f.privatize,
      });
      const snapshot = computeBookingTotals({
        adults: f.adults,
        teens: f.teens,
        pricePerPerson: f.pricePerAdult,
        privatize: f.privatize,
        privatizeFee: PRIVATIZE_FLAT,
      });

      expect(wizard.total).toBe(snapshot.totalAmount);
    });
  }
});
