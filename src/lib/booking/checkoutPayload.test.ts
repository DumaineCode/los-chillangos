import { describe, expect, it } from 'vitest';

import { checkoutPayloadSchema } from './checkoutPayload';

/**
 * The checkout payload is the wizard ↔ server contract. The server NEVER
 * trusts a client-supplied price: the payload only carries each extra's
 * `extraId` (and `priceType` as a UI hint); the route re-resolves the
 * authoritative price/name from Payload by `extraId`. These tests lock that
 * contract — `price` must NOT be an accepted field, and `selectedExtras`
 * defaults to an empty array when omitted.
 */
const baseCustomer = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  whatsapp: '',
  country: 'MX',
  locale: 'en' as const,
};

const basePayload = {
  tourId: 1,
  date: '2026-07-01',
  time: '09:00',
  adults: 2,
  teens: 1,
  customer: baseCustomer,
};

describe('checkoutPayloadSchema selectedExtras', () => {
  it('accepts selectedExtras with extraId + priceType', () => {
    const result = checkoutPayloadSchema.safeParse({
      ...basePayload,
      selectedExtras: [
        { extraId: 5, priceType: 'total' },
        { extraId: 8, priceType: 'perPerson' },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedExtras).toEqual([
        { extraId: 5, priceType: 'total' },
        { extraId: 8, priceType: 'perPerson' },
      ]);
    }
  });

  it('defaults selectedExtras to an empty array when omitted', () => {
    const result = checkoutPayloadSchema.safeParse(basePayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedExtras).toEqual([]);
    }
  });

  it('strips a client-supplied price (never trusts the client amount)', () => {
    const result = checkoutPayloadSchema.safeParse({
      ...basePayload,
      selectedExtras: [{ extraId: 5, priceType: 'total', price: 999999 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // The parsed extra must NOT carry a price field — the server resolves it.
      expect(result.data.selectedExtras[0]).toEqual({ extraId: 5, priceType: 'total' });
      expect('price' in result.data.selectedExtras[0]).toBe(false);
    }
  });

  it('rejects an extraId that is not a positive integer', () => {
    const result = checkoutPayloadSchema.safeParse({
      ...basePayload,
      selectedExtras: [{ extraId: 0, priceType: 'total' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown priceType', () => {
    const result = checkoutPayloadSchema.safeParse({
      ...basePayload,
      selectedExtras: [{ extraId: 5, priceType: 'weekly' }],
    });

    expect(result.success).toBe(false);
  });
});
