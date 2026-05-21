import { describe, expect, it } from 'vitest';

import { stepDateSchema, stepDetailsSchema, stepPeopleSchema } from './schema';

describe('stepDateSchema', () => {
  it('accepts a valid Tuesday in the near future with a time slot', () => {
    const tuesday = nextDow(2); // 2 = Tuesday
    const result = stepDateSchema.safeParse({ date: tuesday, time: '14:00' });

    expect(result.success).toBe(true);
  });

  it('rejects Mondays with errors.mondayClosed', () => {
    const monday = nextDow(1);
    const result = stepDateSchema.safeParse({ date: monday, time: '14:00' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.mondayClosed');
    }
  });

  it('rejects dates in the past with errors.pastDate', () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    // Avoid landing on a Monday (we'd get both errors and the test would still pass,
    // but cleaner if we test pastDate in isolation).
    if (lastWeek.getDay() === 1) lastWeek.setDate(lastWeek.getDate() - 1);

    const result = stepDateSchema.safeParse({ date: lastWeek, time: '14:00' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.pastDate');
    }
  });

  it('rejects when time is empty', () => {
    const tuesday = nextDow(2);
    const result = stepDateSchema.safeParse({ date: tuesday, time: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.timeRequired');
    }
  });

  it('rejects when date is missing', () => {
    const result = stepDateSchema.safeParse({ date: undefined, time: '14:00' });

    expect(result.success).toBe(false);
  });
});

describe('stepPeopleSchema', () => {
  it('accepts valid input within bounds', () => {
    const result = stepPeopleSchema.safeParse({ adults: 2, teens: 1, privatize: false });

    expect(result.success).toBe(true);
  });

  it('accepts adults=1 teens=0 (minimum solo booking)', () => {
    const result = stepPeopleSchema.safeParse({ adults: 1, teens: 0, privatize: true });

    expect(result.success).toBe(true);
  });

  it('rejects adults=0 with errors.minAdults', () => {
    const result = stepPeopleSchema.safeParse({ adults: 0, teens: 1, privatize: false });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.minAdults');
    }
  });

  it('rejects when adults + teens > 8 with errors.maxGroup', () => {
    const result = stepPeopleSchema.safeParse({ adults: 5, teens: 5, privatize: false });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.maxGroup');
    }
  });

  it('rejects adults > 8', () => {
    const result = stepPeopleSchema.safeParse({ adults: 9, teens: 0, privatize: false });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.maxGroup');
    }
  });

  it('rejects teens > 7', () => {
    const result = stepPeopleSchema.safeParse({ adults: 1, teens: 8, privatize: false });

    expect(result.success).toBe(false);
  });
});

describe('stepDetailsSchema', () => {
  it('accepts a valid full payload', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'hana@example.com',
      whatsappOptional: '+52 55 1234 5678',
    });

    expect(result.success).toBe(true);
  });

  it('accepts an empty whatsappOptional', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'hana@example.com',
      whatsappOptional: '',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a missing whatsappOptional', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'Hana Kobayashi',
      email: 'hana@example.com',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a too-short name', () => {
    const result = stepDetailsSchema.safeParse({
      name: 'H',
      email: 'hana@example.com',
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
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('errors.whatsappInvalid');
    }
  });
});

/**
 * Return the next Date (today or later) whose `getDay()` equals `dow`.
 * dow: 0=Sun, 1=Mon, …, 6=Sat. Always returns a date strictly in the future
 * relative to "today at 00:00" so pastDate doesn't fire.
 */
function nextDow(dow: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  // Advance until the day matches AND we're at least 1 day in the future.
  while (d.getDay() !== dow || d.getTime() < Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}
