import { describe, expect, it } from 'vitest';

import { contactMessageSchema } from './contactMessage';

// ---------------------------------------------------------------------------
// contactMessageSchema (R7 — rentals-inquiry-cta seam).
//
// Slice 3 extends the SHARED contact payload schema with two ADDITIVE OPTIONAL
// fields so the rentals inquiry CTA can carry the bike reference through the
// existing /api/contact → contact-messages seam:
//   - rental:      optional string (the bike slug)
//   - accessories: optional array of strings (accessory ids/names)
//
// The required fields (name min2, email, message min10, locale enum) stay
// required and UNCHANGED. The existing ContactForm path — which omits rental
// and accessories — MUST still validate (no regression). The new InquiryCta
// path — which includes them — MUST validate too.
//
// The seam stays engine-free: NO pricing, availability, fleet, or Stripe
// fields are accepted by the schema.
// ---------------------------------------------------------------------------

// Mirrors exactly what the existing ContactForm sends today (no rental keys).
const legacyContactPayload = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '',
  message: 'I would like to know more about your tours.',
  locale: 'en' as const,
};

// Mirrors what the new InquiryCta sends (adds rental + accessories).
const inquiryPayload = {
  name: 'Grace Hopper',
  email: 'grace@example.com',
  message: "I'm interested in renting the Montaña E-Bike bike.",
  locale: 'es' as const,
  rental: 'montana-ebike',
  accessories: ['helmet', 'lock'],
};

describe('contactMessageSchema — additive rental/accessories fields (R7)', () => {
  it('still validates the existing ContactForm payload (no rental/accessories) — no regression', () => {
    const parsed = contactMessageSchema.safeParse(legacyContactPayload);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Ada Lovelace');
      expect(parsed.data.message).toBe('I would like to know more about your tours.');
      // The optional fields are simply absent on the legacy path.
      expect(parsed.data.rental).toBeUndefined();
      expect(parsed.data.accessories).toBeUndefined();
    }
  });

  it('validates the new inquiry payload carrying rental slug + accessories', () => {
    const parsed = contactMessageSchema.safeParse(inquiryPayload);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rental).toBe('montana-ebike');
      expect(parsed.data.accessories).toEqual(['helmet', 'lock']);
      // Required fields are still parsed through.
      expect(parsed.data.name).toBe('Grace Hopper');
      expect(parsed.data.locale).toBe('es');
    }
  });

  it('accepts rental without accessories (accessories is independently optional)', () => {
    const parsed = contactMessageSchema.safeParse({
      ...legacyContactPayload,
      rental: 'city-cruiser',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rental).toBe('city-cruiser');
      expect(parsed.data.accessories).toBeUndefined();
    }
  });

  it('still enforces the required fields — rental does NOT relax name/email/message', () => {
    const tooShortName = contactMessageSchema.safeParse({ ...inquiryPayload, name: 'A' });
    expect(tooShortName.success).toBe(false);

    const badEmail = contactMessageSchema.safeParse({ ...inquiryPayload, email: 'not-an-email' });
    expect(badEmail.success).toBe(false);

    const shortMessage = contactMessageSchema.safeParse({ ...inquiryPayload, message: 'too short' });
    expect(shortMessage.success).toBe(false);

    const badLocale = contactMessageSchema.safeParse({ ...inquiryPayload, locale: 'fr' });
    expect(badLocale.success).toBe(false);
  });

  it('rejects a wrong-typed accessories field (must be an array of strings)', () => {
    const notArray = contactMessageSchema.safeParse({
      ...inquiryPayload,
      accessories: 'helmet',
    });
    expect(notArray.success).toBe(false);

    const arrayOfNumbers = contactMessageSchema.safeParse({
      ...inquiryPayload,
      accessories: [1, 2, 3],
    });
    expect(arrayOfNumbers.success).toBe(false);
  });
});
