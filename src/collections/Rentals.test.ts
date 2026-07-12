import type { CollectionBeforeValidateHook, Field, NumberField } from 'payload';
import { describe, expect, it } from 'vitest';

import { Rentals } from './Rentals';
import { getCDMXDayRange } from '../lib/booking/availability';

// ---------------------------------------------------------------------------
// Rentals collection — standalone bike rental record (rental-system §6).
//
// These tests exercise the collection CONFIG statically (fields + hooks +
// validators), mirroring the other collection tests in this repo — there is no
// Payload DB in the vitest jsdom harness. AC coverage: AC1 (totalAmount derived
// + read-only, ignores client total), AC2 (reference auto-fill), AC3 (positive
// integer quantity/duration).
// ---------------------------------------------------------------------------

type NamedField = Field & { name?: string };

function fieldByName(name: string): NamedField {
  const field = Rentals.fields.find((f): f is NamedField => 'name' in f && f.name === name);
  if (!field) throw new Error(`field "${name}" not found on Rentals`);
  return field;
}

/**
 * Run the collection-level beforeValidate chain over a plain `data` object.
 * `extra` lets a test supply `operation` / `req` / `context` for the anonymous-
 * create security gate; existing callers omit it (operation stays undefined).
 */
async function runBeforeValidate(
  data: Record<string, unknown>,
  extra: { operation?: string; req?: unknown; context?: unknown } = {},
): Promise<Record<string, unknown>> {
  const hooks = (Rentals.hooks?.beforeValidate ?? []) as CollectionBeforeValidateHook[];
  let current: Record<string, unknown> | undefined = data;
  for (const hook of hooks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await hook({ data: current, ...extra } as any);
    if (result) current = result as Record<string, unknown>;
  }
  return current ?? {};
}

describe('Rentals collection', () => {
  it('is an operational collection with versioning off and permissive create', () => {
    expect(Rentals.slug).toBe('rentals');
    expect(Rentals.versions).toBe(false);
    // create is permissive (server route validates); read/update/delete need a user.
    expect(Rentals.access?.create?.({} as never)).toBe(true);
    expect(Rentals.access?.read?.({ req: { user: null } } as never)).toBe(false);
    expect(Rentals.access?.read?.({ req: { user: { id: 1 } } } as never)).toBe(true);
  });

  // AC1 — totalAmount is derived and read-only, ignoring any client-sent total.
  it('derives totalAmount = quantity × unitPrice and ignores a client-sent total (AC1)', async () => {
    const out = await runBeforeValidate({
      quantity: 3,
      unitPrice: 300,
      totalAmount: 5, // hostile client value — must be overwritten
      date: '2026-07-15T20:00:00.000Z',
    });
    expect(out.totalAmount).toBe(900);
  });

  it('marks totalAmount as read-only (AC1)', () => {
    const total = fieldByName('totalAmount') as NumberField;
    expect(total.admin?.readOnly).toBe(true);
    expect(total.required).toBe(true);
  });

  // AC2 — reference auto-fills when missing, and an existing one is preserved.
  it('auto-fills a unique reference when missing (AC2)', async () => {
    const out = await runBeforeValidate({ quantity: 1, unitPrice: 200, date: '2026-07-15T20:00:00.000Z' });
    expect(out.reference).toMatch(/^LC-[0-9A-F]{8}$/);
  });

  it('preserves an already-set reference (AC2)', async () => {
    const out = await runBeforeValidate({
      reference: 'LC-DEADBEEF',
      quantity: 1,
      unitPrice: 200,
      date: '2026-07-15T20:00:00.000Z',
    });
    expect(out.reference).toBe('LC-DEADBEEF');
  });

  it('normalizes date to CDMX calendar-day midnight', async () => {
    const raw = '2026-07-15T20:00:00.000Z';
    const out = await runBeforeValidate({ quantity: 1, unitPrice: 200, date: raw });
    const expected = getCDMXDayRange(new Date(raw)).startUTC.toISOString();
    expect(new Date(out.date as string).toISOString()).toBe(expected);
  });

  // AC3 — quantity and duration must be positive integers.
  it('rejects non-positive / non-integer quantity (AC3)', () => {
    const quantity = fieldByName('quantity') as NumberField;
    const validate = quantity.validate as (v: unknown) => true | string;
    expect(validate(0)).not.toBe(true);
    expect(validate(-1)).not.toBe(true);
    expect(validate(1.5)).not.toBe(true);
    expect(validate(1)).toBe(true);
  });

  it('rejects non-positive / non-integer durationMinutes (AC3)', () => {
    const duration = fieldByName('durationMinutes') as NumberField;
    const validate = duration.validate as (v: unknown) => true | string;
    expect(validate(0)).not.toBe(true);
    expect(validate(-60)).not.toBe(true);
    expect(validate(30.5)).not.toBe(true);
    expect(validate(60)).toBe(true);
  });

  it('validates startTime as HH:MM 24h', () => {
    const startTime = fieldByName('startTime') as NamedField & { validate?: (v: unknown) => true | string };
    const validate = startTime.validate as (v: unknown) => true | string;
    expect(validate('09:00')).toBe(true);
    expect(validate('24:00')).not.toBe(true);
    expect(validate('9:00')).not.toBe(true);
    expect(validate('')).not.toBe(true);
  });

  it('defaults currency to MXN and validates a 3-letter uppercase code', () => {
    const currency = fieldByName('currency') as NamedField & {
      defaultValue?: unknown;
      validate?: (v: unknown) => true | string;
    };
    expect(currency.defaultValue).toBe('MXN');
    const validate = currency.validate as (v: unknown) => true | string;
    expect(validate('MXN')).toBe(true);
    expect(validate('mxn')).not.toBe(true);
    expect(validate('MX')).not.toBe(true);
  });

  it('defaults status to pending with the shared lifecycle enum', () => {
    const status = fieldByName('status') as NamedField & {
      defaultValue?: unknown;
      options?: Array<{ value: string }>;
    };
    expect(status.defaultValue).toBe('pending');
    const values = (status.options ?? []).map((o) => o.value);
    expect(values).toEqual(['pending', 'paid', 'expired', 'cancelled', 'refunded']);
  });

  // ---------------------------------------------------------------------------
  // B1 security hardening — anonymous-create privileged-field gate.
  //
  // `create` access is permissive (server checkout route calls payload.create
  // with no req.user). That means a raw anonymous `POST /api/rentals` could set
  // privileged fields directly (status:'paid' bypassing Stripe, a far-future
  // holdExpiresAt, paidAt/stripePaymentIntentId). The beforeValidate hook must
  // force a safe state for anonymous, non-trusted creates while leaving admins,
  // updates, and the trusted checkout route (req.context.trustedRentalCreate)
  // untouched.
  // ---------------------------------------------------------------------------
  describe('anonymous-create security gate (B1)', () => {
    const FAR_FUTURE = '2099-01-01T00:00:00.000Z';
    const base = () => ({
      quantity: 2,
      unitPrice: 300,
      date: '2026-07-15T20:00:00.000Z',
    });

    it('forces status to pending on anonymous create even when client sends paid', async () => {
      const out = await runBeforeValidate(
        { ...base(), status: 'paid' },
        { operation: 'create', req: { user: null } },
      );
      expect(out.status).toBe('pending');
    });

    it('coerces any non-pending client status to pending on anonymous create', async () => {
      for (const hostile of ['paid', 'refunded', 'cancelled', 'expired']) {
        const out = await runBeforeValidate(
          { ...base(), status: hostile },
          { operation: 'create', req: { user: null } },
        );
        expect(out.status).toBe('pending');
      }
    });

    it('clears paidAt and stripePaymentIntentId on anonymous create', async () => {
      const out = await runBeforeValidate(
        { ...base(), status: 'paid', paidAt: FAR_FUTURE, stripePaymentIntentId: 'pi_hack' },
        { operation: 'create', req: { user: null } },
      );
      expect(out.paidAt ?? null).toBeNull();
      expect(out.stripePaymentIntentId ?? null).toBeNull();
    });

    it('ignores a client-sent far-future holdExpiresAt on anonymous create', async () => {
      const out = await runBeforeValidate(
        { ...base(), holdExpiresAt: FAR_FUTURE },
        { operation: 'create', req: { user: null } },
      );
      expect(out.holdExpiresAt ?? null).toBeNull();
    });

    it('does NOT override privileged fields when an authenticated admin creates', async () => {
      const out = await runBeforeValidate(
        { ...base(), status: 'paid', paidAt: FAR_FUTURE, stripePaymentIntentId: 'pi_admin', holdExpiresAt: FAR_FUTURE },
        { operation: 'create', req: { user: { id: 1 } } },
      );
      expect(out.status).toBe('paid');
      expect(out.paidAt).toBe(FAR_FUTURE);
      expect(out.stripePaymentIntentId).toBe('pi_admin');
      expect(out.holdExpiresAt).toBe(FAR_FUTURE);
    });

    it('does NOT override on update (admin can transition status to paid)', async () => {
      const out = await runBeforeValidate(
        { ...base(), status: 'paid', paidAt: FAR_FUTURE },
        { operation: 'update', req: { user: { id: 1 } } },
      );
      expect(out.status).toBe('paid');
      expect(out.paidAt).toBe(FAR_FUTURE);
    });

    it('lets the trusted checkout route set a server-controlled holdExpiresAt', async () => {
      // The B3b checkout route creates rentals server-side (no req.user) but marks
      // the create as trusted via req.context.trustedRentalCreate. The gate must
      // then allow the server-set holdExpiresAt and pending status through.
      const serverHold = '2026-07-15T20:15:00.000Z';
      const out = await runBeforeValidate(
        { ...base(), status: 'pending', holdExpiresAt: serverHold },
        { operation: 'create', req: { user: null, context: { trustedRentalCreate: true } } },
      );
      expect(out.status).toBe('pending');
      expect(out.holdExpiresAt).toBe(serverHold);
    });
  });
});
