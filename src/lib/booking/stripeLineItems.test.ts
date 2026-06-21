import { describe, expect, it } from 'vitest';

import {
  buildStripeLineItems,
  resolveSelectedExtras,
  type ResolvableExtra,
  type SelectedExtraSnapshot,
} from './stripeLineItems';

/**
 * Money-critical guards for the Stripe line-item builder.
 *
 * The authoritative number is `totalAmount` (the persisted snapshot Stripe
 * charges). When we split it into a base line + one line per extra, the SUM of
 * every line's cents MUST equal `round(totalAmount * 100)` exactly — no 1-cent
 * drift. The base line is DERIVED as `round(totalAmount*100) − Σ(extra cents)`
 * so reconciliation holds by construction.
 */

const tourPrivado: ResolvableExtra = {
  id: 7,
  name: 'Tour privado',
  price: 140,
  priceType: 'total',
  active: true,
};

const transfer: ResolvableExtra = {
  id: 9,
  name: 'Airport transfer',
  price: 20,
  priceType: 'perPerson',
  active: true,
};

describe('resolveSelectedExtras (server re-resolves price/name by extraId)', () => {
  it('resolves each selected extraId to the authoritative price + name', () => {
    const snapshot = resolveSelectedExtras(
      [{ extraId: 7, priceType: 'total' }],
      [tourPrivado, transfer],
      3
    );

    expect(snapshot).toEqual([
      { extraId: 7, name: 'Tour privado', unitPrice: 140, priceType: 'total', computedAmount: 140 },
    ]);
  });

  it('computes perPerson amount from pax, not from any client value', () => {
    const snapshot = resolveSelectedExtras(
      [{ extraId: 9, priceType: 'perPerson' }],
      [tourPrivado, transfer],
      3
    );

    expect(snapshot[0]?.computedAmount).toBe(60); // 20 × 3
    expect(snapshot[0]?.unitPrice).toBe(20);
  });

  it('ignores the client-supplied priceType and uses the resolved one (anti-tamper)', () => {
    // Client lies that the perPerson transfer is "total" to be charged once.
    const snapshot = resolveSelectedExtras(
      [{ extraId: 9, priceType: 'total' }],
      [tourPrivado, transfer],
      3
    );

    // Server resolves the REAL priceType (perPerson) → 20 × 3 = 60.
    expect(snapshot[0]?.priceType).toBe('perPerson');
    expect(snapshot[0]?.computedAmount).toBe(60);
  });

  it('drops selections that do not resolve to a known active extra', () => {
    const snapshot = resolveSelectedExtras(
      [{ extraId: 404, priceType: 'total' }],
      [tourPrivado, transfer],
      2
    );

    expect(snapshot).toEqual([]);
  });

  it('drops inactive extras', () => {
    const snapshot = resolveSelectedExtras(
      [{ extraId: 7, priceType: 'total' }],
      [{ ...tourPrivado, active: false }],
      2
    );

    expect(snapshot).toEqual([]);
  });
});

describe('buildStripeLineItems (Σ line cents === totalAmount cents)', () => {
  const base = (extras: SelectedExtraSnapshot[]) =>
    buildStripeLineItems({
      baseProductName: 'E-bike Classic — 2026-07-01 09:00',
      baseDescription: '3 person(s)',
      currency: 'USD',
      totalAmount: 89 * 3 + 140, // base 267 + extra 140 = 407
      selectedExtras: extras,
      metadata: { tourSlug: 'ebike-classic', bookingReference: 'LC-AB12CD34' },
    });

  it('emits one base line + one line per extra', () => {
    const items = base([
      { extraId: 7, name: 'Tour privado', unitPrice: 140, priceType: 'total', computedAmount: 140 },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]?.price_data.product_data.name).toBe('E-bike Classic — 2026-07-01 09:00');
    expect(items[1]?.price_data.product_data.name).toBe('Tour privado');
    expect(items[1]?.price_data.unit_amount).toBe(140 * 100);
    expect(items[1]?.quantity).toBe(1);
  });

  it('reconciles: Σ(unit_amount × quantity) === round(totalAmount × 100)', () => {
    const totalAmount = 89 * 3 + 140; // 407
    const items = buildStripeLineItems({
      baseProductName: 'Base',
      baseDescription: '3 person(s)',
      currency: 'USD',
      totalAmount,
      selectedExtras: [
        { extraId: 7, name: 'Tour privado', unitPrice: 140, priceType: 'total', computedAmount: 140 },
      ],
      metadata: { tourSlug: 's', bookingReference: 'LC-1' },
    });

    const sumCents = items.reduce((s, i) => s + i.price_data.unit_amount * i.quantity, 0);
    expect(sumCents).toBe(Math.round(totalAmount * 100));
    // Base line = total cents − extra cents
    expect(items[0]?.price_data.unit_amount).toBe(Math.round(totalAmount * 100) - 140 * 100);
  });

  it('reconciles with TWO extras (base + 2 lines = 3 line items)', () => {
    const totalAmount = 80 * 3 + 80 + 20 * 3; // base 240 + 80 + 60 = 380
    const items = buildStripeLineItems({
      baseProductName: 'Base',
      baseDescription: '3 person(s)',
      currency: 'USD',
      totalAmount,
      selectedExtras: [
        { extraId: 1, name: 'A', unitPrice: 80, priceType: 'total', computedAmount: 80 },
        { extraId: 2, name: 'B', unitPrice: 20, priceType: 'perPerson', computedAmount: 60 },
      ],
      metadata: { tourSlug: 's', bookingReference: 'LC-2' },
    });

    expect(items).toHaveLength(3);
    const sumCents = items.reduce((s, i) => s + i.price_data.unit_amount * i.quantity, 0);
    expect(sumCents).toBe(Math.round(totalAmount * 100));
  });

  it('no-double-charge: never emits a privatize line; a single Tour privado extra appears exactly once', () => {
    const totalAmount = 89 * 2 + 140; // 318
    const items = buildStripeLineItems({
      baseProductName: 'Base',
      baseDescription: '2 person(s)',
      currency: 'USD',
      totalAmount,
      selectedExtras: [
        { extraId: 7, name: 'Tour privado', unitPrice: 140, priceType: 'total', computedAmount: 140 },
      ],
      metadata: { tourSlug: 's', bookingReference: 'LC-3' },
    });

    const privadoLines = items.filter((i) => i.price_data.product_data.name === 'Tour privado');
    expect(privadoLines).toHaveLength(1);
    expect(privadoLines[0]?.price_data.unit_amount).toBe(140 * 100);

    const sumCents = items.reduce((s, i) => s + i.price_data.unit_amount * i.quantity, 0);
    expect(sumCents).toBe(Math.round(totalAmount * 100));
  });

  it('with no extras emits a single base line equal to the full total', () => {
    const totalAmount = 89 * 2; // 178
    const items = buildStripeLineItems({
      baseProductName: 'Base',
      baseDescription: '2 person(s)',
      currency: 'USD',
      totalAmount,
      selectedExtras: [],
      metadata: { tourSlug: 's', bookingReference: 'LC-4' },
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.price_data.unit_amount).toBe(Math.round(totalAmount * 100));
  });
});
