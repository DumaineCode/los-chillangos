import { describe, expect, it } from 'vitest';

import { stepDateSchema, stepDetailsSchema, stepPeopleSchema } from './schema';

/**
 * Schema tests after the Sub-etapa B factory rewire.
 *
 * Both `stepDateSchema` and `stepPeopleSchema` are now factories that take a
 * tour context. We fix `now` to a CDMX-stable instant so weekday + past-date
 * logic is deterministic on any CI runner.
 *
 * NOW = 2026-06-15T14:00:00Z = Monday 2026-06-15T08:00:00 CDMX.
 */
const NOW = new Date('2026-06-15T14:00:00Z');

// Always-open weekly tour (every day).
const OPEN_EVERY_DAY = ['0', '1', '2', '3', '4', '5', '6'] as const;
// Tour that runs only Wed Fri Sun.
const OPEN_WED_FRI_SUN = ['0', '3', '5'] as const;

function makeDate(iso: string) {
  return new Date(iso);
}

describe('stepDateSchema (factory)', () => {
  it('accepts a future open day with a time slot', () => {
    const schema = stepDateSchema({ availableDays: OPEN_EVERY_DAY, now: NOW });
    // 2026-06-17 = Wed CDMX, in the future relative to NOW.
    const date = makeDate('2026-06-17T18:00:00Z');
    const result = schema.safeParse({ date, time: '09:00' });
    expect(result.success).toBe(true);
  });

  it('rejects a date the tour does not run with errors.dayClosed', () => {
    // Tour runs Wed/Fri/Sun. 2026-06-15 is Monday CDMX → closed.
    const schema = stepDateSchema({ availableDays: OPEN_WED_FRI_SUN, now: NOW });
    const date = makeDate('2026-06-15T18:00:00Z');
    const result = schema.safeParse({ date, time: '09:00' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.dayClosed');
    }
  });

  it('rejects past dates with errors.pastDate', () => {
    const schema = stepDateSchema({ availableDays: OPEN_EVERY_DAY, now: NOW });
    // 2026-06-10 is well before NOW (2026-06-15 CDMX).
    const date = makeDate('2026-06-10T18:00:00Z');
    const result = schema.safeParse({ date, time: '09:00' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.pastDate');
    }
  });

  it('rejects when time is empty', () => {
    const schema = stepDateSchema({ availableDays: OPEN_EVERY_DAY, now: NOW });
    const date = makeDate('2026-06-17T18:00:00Z');
    const result = schema.safeParse({ date, time: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.timeRequired');
    }
  });

  it('rejects when date is missing', () => {
    const schema = stepDateSchema({ availableDays: OPEN_EVERY_DAY, now: NOW });
    const result = schema.safeParse({ date: undefined, time: '09:00' });
    expect(result.success).toBe(false);
  });

  it('treats empty availableDays as closed every day', () => {
    const schema = stepDateSchema({ availableDays: [], now: NOW });
    const date = makeDate('2026-06-17T18:00:00Z');
    const result = schema.safeParse({ date, time: '09:00' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.dayClosed');
    }
  });
});

describe('stepDateSchema (seasonal window)', () => {
  // Seasonal tour: bookable only inside seasonWindow [start..end], NOT on
  // recurring weekdays. Window bounds serialize as midnight UTC (Payload date).
  const SEASONAL = {
    isSeasonal: true,
    availableDays: ['5'], // Fridays — must be ignored for seasonal tours
    seasonal: {
      seasonWindow: { start: '2026-08-14T06:00:00.000Z', end: '2026-08-14T06:00:00.000Z' },
    },
  } as const;
  // NOW pinned before the event so past-date logic never interferes.
  const SEASONAL_NOW = new Date('2026-08-01T14:00:00Z');

  it('accepts the in-window seasonal date even though it is not a recurring open weekday', () => {
    const schema = stepDateSchema({ ...SEASONAL, now: SEASONAL_NOW });
    // 2026-08-14 is a Friday CDMX, but the point is the WINDOW admits it.
    const date = makeDate('2026-08-14T18:00:00Z');
    const result = schema.safeParse({ date, time: '18:00' });
    expect(result.success).toBe(true);
  });

  it('rejects a Friday OUTSIDE the seasonal window with errors.dayClosed', () => {
    const schema = stepDateSchema({ ...SEASONAL, now: SEASONAL_NOW });
    // 2026-08-21 is a Friday CDMX (would pass the old weekday model) but is
    // outside the single-date Aug-14 window → closed.
    const date = makeDate('2026-08-21T18:00:00Z');
    const result = schema.safeParse({ date, time: '18:00' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.dayClosed');
    }
  });
});

describe('stepPeopleSchema (factory)', () => {
  it('accepts valid input within slot capacity', () => {
    const schema = stepPeopleSchema({ slotCapacity: 8 });
    const result = schema.safeParse({ adults: 2, teens: 1, selectedExtras: [] });
    expect(result.success).toBe(true);
  });

  it('accepts a single solo adult', () => {
    const schema = stepPeopleSchema({ slotCapacity: 8 });
    const result = schema.safeParse({ adults: 1, teens: 0, selectedExtras: [] });
    expect(result.success).toBe(true);
  });

  it('defaults selectedExtras to an empty array when omitted', () => {
    const schema = stepPeopleSchema({ slotCapacity: 8 });
    const result = schema.safeParse({ adults: 2, teens: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedExtras).toEqual([]);
    }
  });

  it('accepts a yes/no extra selection ({ extraId, priceType })', () => {
    const schema = stepPeopleSchema({ slotCapacity: 8 });
    const result = schema.safeParse({
      adults: 2,
      teens: 0,
      selectedExtras: [{ extraId: 3, priceType: 'total' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects adults=0 with errors.minAdults', () => {
    const schema = stepPeopleSchema({ slotCapacity: 8 });
    const result = schema.safeParse({ adults: 0, teens: 1, selectedExtras: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.minAdults');
    }
  });

  it('rejects when adults + teens > slotCapacity with errors.maxGroupSlot', () => {
    const schema = stepPeopleSchema({ slotCapacity: 4 });
    const result = schema.safeParse({ adults: 3, teens: 2, selectedExtras: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.maxGroupSlot');
    }
  });

  it('rejects adults > slotCapacity', () => {
    const schema = stepPeopleSchema({ slotCapacity: 4 });
    const result = schema.safeParse({ adults: 5, teens: 0, selectedExtras: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.maxGroupSlot');
    }
  });

  it('accepts exactly slotCapacity', () => {
    const schema = stepPeopleSchema({ slotCapacity: 6 });
    const result = schema.safeParse({ adults: 4, teens: 2, selectedExtras: [] });
    expect(result.success).toBe(true);
  });
});

describe('stepDetailsSchema', () => {
  it('accepts a valid full payload', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'hana@example.com',
      whatsappOptional: '+52 55 1234 5678',
      country: 'MX',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty whatsappOptional', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'hana@example.com',
      whatsappOptional: '',
      country: 'US',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a missing whatsappOptional', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'hana@example.com',
      country: 'AR',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a too-short name', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'H',
      email: 'hana@example.com',
      country: 'MX',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.nameRequired');
    }
  });

  it('rejects an invalid email', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'not-an-email',
      country: 'MX',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.emailInvalid');
    }
  });

  it('rejects an invalid whatsappOptional format', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'hana@example.com',
      whatsappOptional: 'not a phone',
      country: 'MX',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.whatsappInvalid');
    }
  });

  it('rejects a missing country', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'hana@example.com',
      country: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.countryRequired');
    }
  });
});
