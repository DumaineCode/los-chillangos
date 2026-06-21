import { z } from 'zod';

/**
 * POST /api/booking/checkout payload schema (Sub-etapa C).
 *
 * This is the contract between the wizard (StepConfirm) and the server
 * checkout endpoint. Keep field names aligned with the Bookings collection
 * so a single intent type can flow through Stripe metadata and back into
 * Payload without renaming dance.
 *
 * `whatsapp` is optional — the wizard's StepDetails treats it as such.
 * `''` is accepted so the wizard can send a stable shape without conditional
 * key removal.
 */
/**
 * A single selected extra as sent by the wizard.
 *
 * SECURITY: the client transmits ONLY the `extraId` (and `priceType` as a UI
 * hint). It deliberately carries NO price — the checkout route re-resolves the
 * authoritative price and name from Payload by `extraId` so a tampered client
 * can never set its own amount. `z.object` strips any extra keys (e.g. a
 * smuggled `price`), so the parsed value is always just `{ extraId, priceType }`.
 */
export const selectedExtraInputSchema = z.object({
  extraId: z.number().int().positive(),
  priceType: z.enum(['total', 'perPerson']),
});

export const checkoutPayloadSchema = z.object({
  tourId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  adults: z.number().int().min(1),
  teens: z.number().int().min(0),
  selectedExtras: z.array(selectedExtraInputSchema).default([]),
  customer: z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    whatsapp: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s\-()]{7,20}$/)
      .optional()
      .or(z.literal('')),
    country: z.string().min(2),
    locale: z.enum(['en', 'es']),
  }),
});

export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;
