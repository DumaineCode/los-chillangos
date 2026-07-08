import { describe, expect, it } from 'vitest';

import { contactMessageSchema } from './contactMessage';

// ---------------------------------------------------------------------------
// contactMessageSchema — public contact form payload.
//
// The contract is deliberately tiny: name (min2), email, message (min10) and
// locale are required; phone is the single optional channel ('' accepted so the
// client can send a stable shape). No rental/inquiry fields exist — rentals are
// a CMS-driven price list on the home, not a per-bike inquiry.
// ---------------------------------------------------------------------------

const contactPayload = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '',
  message: 'I would like to know more about your tours.',
  locale: 'en' as const,
};

describe('contactMessageSchema', () => {
  it('validates a well-formed contact payload', () => {
    const parsed = contactMessageSchema.safeParse(contactPayload);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Ada Lovelace');
      expect(parsed.data.message).toBe('I would like to know more about your tours.');
      expect(parsed.data.locale).toBe('en');
    }
  });

  it('accepts a payload without a phone (optional channel)', () => {
    const parsed = contactMessageSchema.safeParse({
      name: contactPayload.name,
      email: contactPayload.email,
      message: contactPayload.message,
      locale: contactPayload.locale,
    });
    expect(parsed.success).toBe(true);
  });

  it('enforces the required fields', () => {
    expect(contactMessageSchema.safeParse({ ...contactPayload, name: 'A' }).success).toBe(false);
    expect(
      contactMessageSchema.safeParse({ ...contactPayload, email: 'not-an-email' }).success
    ).toBe(false);
    expect(
      contactMessageSchema.safeParse({ ...contactPayload, message: 'too short' }).success
    ).toBe(false);
    expect(contactMessageSchema.safeParse({ ...contactPayload, locale: 'fr' }).success).toBe(false);
  });

  it('ignores unknown keys (e.g. legacy rental/accessories) — they are stripped', () => {
    const parsed = contactMessageSchema.safeParse({
      ...contactPayload,
      rental: 'some-bike',
      accessories: ['helmet'],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('rental' in parsed.data).toBe(false);
      expect('accessories' in parsed.data).toBe(false);
    }
  });
});
