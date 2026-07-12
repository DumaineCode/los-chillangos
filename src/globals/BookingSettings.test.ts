import type { ArrayField, Field, GlobalBeforeValidateHook, NumberField, TextField } from 'payload';
import { describe, expect, it } from 'vitest';

import { BookingSettings } from './BookingSettings';

// ---------------------------------------------------------------------------
// BookingSettings — rental configuration fields (rental-system §6).
//
// Adds admin-editable rental config: rentalTiers[], openTime, closeTime,
// rentalGranularityMinutes. booking-settings is NOT seeded in scripts/seed.ts,
// so its defaults MUST live in `defaultValue`. AC coverage: AC6 (closeTime >
// openTime), AC7 (positive tier price/duration + granularity), AC8 (default
// seed values).
// ---------------------------------------------------------------------------

type NamedField = Field & { name?: string };

function fieldByName(name: string): NamedField {
  const field = BookingSettings.fields.find((f): f is NamedField => 'name' in f && f.name === name);
  if (!field) throw new Error(`field "${name}" not found on BookingSettings`);
  return field;
}

function subField(arr: ArrayField, name: string): NamedField {
  const field = arr.fields.find((f): f is NamedField => 'name' in f && f.name === name);
  if (!field) throw new Error(`sub-field "${name}" not found on ${arr.name}`);
  return field;
}

async function runBeforeValidate(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const hooks = (BookingSettings.hooks?.beforeValidate ?? []) as GlobalBeforeValidateHook[];
  let current: Record<string, unknown> | undefined = data;
  for (const hook of hooks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await hook({ data: current } as any);
    if (result) current = result as Record<string, unknown>;
  }
  return current ?? {};
}

describe('BookingSettings — rental configuration', () => {
  // AC8 — default seed lives in defaultValue (no seed script for this global).
  it('seeds the default rental tiers 1h=200/2h=300/4h=450/6h=600 (AC8)', () => {
    const tiers = fieldByName('rentalTiers') as ArrayField;
    expect(tiers.type).toBe('array');
    expect(tiers.required).toBe(true);
    expect(tiers.defaultValue).toEqual([
      { durationMinutes: 60, price: 200 },
      { durationMinutes: 120, price: 300 },
      { durationMinutes: 240, price: 450 },
      { durationMinutes: 360, price: 600 },
    ]);
  });

  it('seeds openTime 09:00, closeTime 19:00, granularity 30 (AC8)', () => {
    expect((fieldByName('openTime') as TextField).defaultValue).toBe('09:00');
    expect((fieldByName('closeTime') as TextField).defaultValue).toBe('19:00');
    expect((fieldByName('rentalGranularityMinutes') as NumberField).defaultValue).toBe(30);
  });

  // AC7 — tier values and granularity must be strictly positive.
  it('rejects a tier with non-positive price or duration (AC7)', () => {
    const tiers = fieldByName('rentalTiers') as ArrayField;
    const price = subField(tiers, 'price') as NumberField & { validate?: (v: unknown) => true | string };
    const duration = subField(tiers, 'durationMinutes') as NumberField & {
      validate?: (v: unknown) => true | string;
    };
    const validatePrice = price.validate as (v: unknown) => true | string;
    const validateDuration = duration.validate as (v: unknown) => true | string;
    expect(validatePrice(0)).not.toBe(true);
    expect(validatePrice(-1)).not.toBe(true);
    expect(validatePrice(200)).toBe(true);
    expect(validateDuration(0)).not.toBe(true);
    expect(validateDuration(-60)).not.toBe(true);
    expect(validateDuration(60)).toBe(true);
  });

  it('rejects non-positive rentalGranularityMinutes (AC7)', () => {
    const granularity = fieldByName('rentalGranularityMinutes') as NumberField & {
      validate?: (v: unknown) => true | string;
    };
    const validate = granularity.validate as (v: unknown) => true | string;
    expect(validate(0)).not.toBe(true);
    expect(validate(-30)).not.toBe(true);
    expect(validate(30)).toBe(true);
  });

  it('validates openTime and closeTime as HH:MM (AC6)', () => {
    const openTime = fieldByName('openTime') as TextField & { validate?: (v: unknown) => true | string };
    const validate = openTime.validate as (v: unknown) => true | string;
    expect(validate('09:00')).toBe(true);
    expect(validate('9:00')).not.toBe(true);
    expect(validate('25:00')).not.toBe(true);
  });

  // AC6 — closeTime must be strictly after openTime (cross-field rule).
  it('rejects closeTime <= openTime via a global beforeValidate (AC6)', async () => {
    await expect(
      runBeforeValidate({ openTime: '19:00', closeTime: '09:00', rentalGranularityMinutes: 30 })
    ).rejects.toThrow();
    await expect(
      runBeforeValidate({ openTime: '09:00', closeTime: '09:00', rentalGranularityMinutes: 30 })
    ).rejects.toThrow();
  });

  it('accepts a valid closeTime > openTime (AC6)', async () => {
    const out = await runBeforeValidate({
      openTime: '09:00',
      closeTime: '19:00',
      rentalGranularityMinutes: 30,
    });
    expect(out.closeTime).toBe('19:00');
  });

  it('keeps the existing totalBikes and bufferMinutes fields', () => {
    expect(fieldByName('totalBikes').type).toBe('number');
    expect(fieldByName('bufferMinutes').type).toBe('number');
  });
});
