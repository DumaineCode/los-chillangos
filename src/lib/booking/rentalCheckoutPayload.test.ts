import { describe, expect, it } from 'vitest';

import { rentalCheckoutPayloadSchema } from './rentalCheckoutPayload';

/**
 * Zod contract between the rental wizard and POST /api/rental/checkout.
 * Mirrors `checkoutPayload.ts`: the client sends `durationMinutes` to pick the
 * tier; the server RE-RESOLVES the price (never trusts a client amount).
 */
describe('rentalCheckoutPayloadSchema', () => {
  const valid = {
    date: '2026-06-15',
    startTime: '09:00',
    durationMinutes: 120,
    quantity: 2,
    customer: {
      name: 'Ana P',
      email: 'ana@example.com',
      whatsapp: '',
      country: 'MX',
      locale: 'en',
    },
  };

  it('accepts a well-formed rental checkout body', () => {
    const parsed = rentalCheckoutPayloadSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects a malformed date', () => {
    const parsed = rentalCheckoutPayloadSchema.safeParse({ ...valid, date: '2026-6-1' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-integer / non-positive durationMinutes', () => {
    expect(rentalCheckoutPayloadSchema.safeParse({ ...valid, durationMinutes: 0 }).success).toBe(false);
    expect(rentalCheckoutPayloadSchema.safeParse({ ...valid, durationMinutes: 1.5 }).success).toBe(false);
  });

  it('rejects a quantity below 1 or non-integer', () => {
    expect(rentalCheckoutPayloadSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
    expect(rentalCheckoutPayloadSchema.safeParse({ ...valid, quantity: 2.5 }).success).toBe(false);
  });

  it('rejects an absurd quantity above the fleet ceiling (defense-in-depth cap)', () => {
    // evaluateRental stays authoritative, but the schema rejects nonsensical
    // inputs (e.g. 51 bikes) before any evaluation runs.
    expect(rentalCheckoutPayloadSchema.safeParse({ ...valid, quantity: 51 }).success).toBe(false);
    // The ceiling itself is still accepted.
    expect(rentalCheckoutPayloadSchema.safeParse({ ...valid, quantity: 50 }).success).toBe(true);
  });

  it('rejects a bad startTime', () => {
    expect(rentalCheckoutPayloadSchema.safeParse({ ...valid, startTime: '25:00' }).success).toBe(false);
  });
});
