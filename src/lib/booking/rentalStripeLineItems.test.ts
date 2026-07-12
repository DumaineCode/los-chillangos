import { describe, expect, it } from 'vitest';

import { buildRentalLineItems } from './rentalStripeLineItems';

/**
 * Pure Stripe line-item builder for standalone rentals (Batch 3b, PR3).
 *
 * AC25: currency `mxn`, ONE line of `quantity` bikes at the per-bike price, and
 * `Σ(line cents) === round(totalAmount × 100)` by construction (mirrors the
 * cents-reconciliation discipline of `buildStripeLineItems`).
 */
describe('buildRentalLineItems', () => {
  it('emits ONE line, currency mxn, reconciles cents to the total (AC25 — Q=3 @300 → 90000)', () => {
    const items = buildRentalLineItems({
      currency: 'MXN',
      unitPrice: 300,
      quantity: 3,
      totalAmount: 900,
      reference: 'LC-RENT0001',
      durationMinutes: 120,
    });

    expect(items).toHaveLength(1);
    const line = items[0]!;
    expect(line.quantity).toBe(3);
    expect(line.price_data.currency).toBe('mxn');
    expect(line.price_data.unit_amount).toBe(Math.round(300 * 100)); // 30000

    const sumCents = items.reduce((s, i) => s + i.price_data.unit_amount * i.quantity, 0);
    expect(sumCents).toBe(Math.round(900 * 100)); // 90000

    expect(line.price_data.product_data.metadata.rentalReference).toBe('LC-RENT0001');
    // Product name reflects the ride length in hours ("Bike rental — Nh").
    expect(line.price_data.product_data.name).toMatch(/2h/);
  });

  it('reconciles for a single-bike 1h tier and lowercases an already-lowercase currency', () => {
    const items = buildRentalLineItems({
      currency: 'mxn',
      unitPrice: 200,
      quantity: 1,
      totalAmount: 200,
      reference: 'LC-RENT0002',
      durationMinutes: 60,
    });

    expect(items).toHaveLength(1);
    expect(items[0]!.price_data.currency).toBe('mxn');
    const sumCents = items.reduce((s, i) => s + i.price_data.unit_amount * i.quantity, 0);
    expect(sumCents).toBe(Math.round(200 * 100)); // 20000
    expect(items[0]!.price_data.product_data.name).toMatch(/1h/);
  });

  it('reconciles cents exactly for an integer-cent tier (M1 guard holds on the happy path)', () => {
    const items = buildRentalLineItems({
      currency: 'MXN',
      unitPrice: 250,
      quantity: 4,
      totalAmount: 1000,
      reference: 'LC-RENT0003',
      durationMinutes: 180,
    });
    const sumCents = items.reduce((s, i) => s + i.price_data.unit_amount * i.quantity, 0);
    expect(sumCents).toBe(Math.round(1000 * 100)); // 100000
  });

  it('REJECTS a tier whose unitPrice does not resolve to a whole number of cents (M1)', () => {
    // 300.005 * 100 = 30000.4999… — not an integer number of cents, so
    // `quantity × round(unitPrice×100)` would silently drift from round(total×100).
    expect(() =>
      buildRentalLineItems({
        currency: 'MXN',
        unitPrice: 300.005,
        quantity: 2,
        totalAmount: 600.01,
        reference: 'LC-RENTBAD1',
        durationMinutes: 120,
      })
    ).toThrow(/whole number of cents/i);
  });
});
