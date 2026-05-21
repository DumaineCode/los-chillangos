import { describe, expect, it } from 'vitest';

import { calculatePrice } from './pricing';

describe('calculatePrice', () => {
  it('returns just adults × price when no teens and no privatize', () => {
    const b = calculatePrice({ pricePerAdult: 89, adults: 2, teens: 0, privatize: false });

    expect(b.subtotal).toBe(178);
    expect(b.addon).toBe(0);
    expect(b.total).toBe(178);
  });

  it('applies 20% off for teens', () => {
    // 89 * 0.8 = 71.2 → rounded to 71
    const b = calculatePrice({ pricePerAdult: 89, adults: 2, teens: 1, privatize: false });

    expect(b.pricePerTeen).toBe(71);
    expect(b.subtotal).toBe(178 + 71);
    expect(b.total).toBe(249);
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
