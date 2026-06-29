import { z } from 'zod';

/**
 * POST /api/contact payload schema.
 *
 * Contract between the public ContactForm and the server route. Deliberately
 * tiny — name, email, message are required; phone is the single optional
 * channel. `''` is accepted for phone so the client can send a stable shape
 * without conditional key removal (mirrors checkoutPayload's whatsapp).
 *
 * `locale` lets the owner-notification email and the stored record carry the
 * visitor's language, matching the rest of the site (en | es).
 *
 * `rental` and `accessories` are ADDITIVE OPTIONAL fields for the rentals
 * inquiry CTA (R7 — rentals-inquiry-cta seam): they carry which bike slug and
 * which accessory references the visitor is asking about. The existing
 * ContactForm omits both and keeps validating unchanged. The seam stays
 * engine-free — no pricing, availability, fleet, or Stripe fields live here.
 */
export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/)
    .optional()
    .or(z.literal('')),
  message: z.string().trim().min(10).max(2000),
  locale: z.enum(['en', 'es']),
  rental: z.string().trim().min(1).max(200).optional(),
  accessories: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

export type ContactMessagePayload = z.infer<typeof contactMessageSchema>;
