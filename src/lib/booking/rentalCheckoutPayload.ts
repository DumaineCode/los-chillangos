import { z } from 'zod';

/**
 * POST /api/rental/checkout payload schema (Batch 3b / PR3).
 *
 * The contract between the rental wizard and the server checkout endpoint.
 * Mirrors `checkoutPayload.ts`: the client sends `durationMinutes` to identify
 * the tier, and NO price — the checkout route re-resolves `unitPrice` from
 * `BookingSettings.rentalTiers` server-side so a tampered client can never set
 * its own amount. `z.object` strips any smuggled `unitPrice`/`totalAmount`.
 *
 * `whatsapp` is optional; `''` is accepted so the wizard can send a stable shape.
 *
 * `quantity` carries a defensive upper bound (`MAX_RENTAL_QUANTITY`): a sane fleet
 * ceiling that rejects absurd inputs before any evaluation runs. `evaluateRental`
 * remains the authoritative availability check — this cap only stops nonsense early.
 */
export const MAX_RENTAL_QUANTITY = 50;

export const rentalCheckoutPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().positive(),
  quantity: z.number().int().min(1).max(MAX_RENTAL_QUANTITY),
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

export type RentalCheckoutPayload = z.infer<typeof rentalCheckoutPayloadSchema>;
