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
export const checkoutPayloadSchema = z.object({
  tourId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  adults: z.number().int().min(1),
  teens: z.number().int().min(0),
  privatize: z.boolean(),
  customer: z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    whatsapp: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s\-()]{7,20}$/)
      .optional()
      .or(z.literal('')),
    locale: z.enum(['en', 'es']),
  }),
});

export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;
