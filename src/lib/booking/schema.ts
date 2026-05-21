import { z } from 'zod';

/**
 * Booking flow Zod schemas (PR 5).
 *
 * Each step has its own schema so the wizard can validate incrementally.
 * Error messages are i18n KEYS (not human strings) — the form renders them
 * through `useTranslations('booking.errors')`. Keep keys flat and stable.
 *
 * NOTE: This is the only Zod surface in the booking flow. The wizard never
 * persists anything; these schemas exist purely to gate the Next button and
 * to give the deep-link builder a clean, validated payload.
 */

/**
 * Step 1 — Pick a date + time.
 *
 * - `date`: must be a Date, must not be a Monday (Mondays we rest), must not
 *   be in the past (compared at midnight local time).
 * - `time`: free-form string but required (the wizard offers fixed chips
 *   based on the tour's category; we don't enum the value because new
 *   tours may add slots without a schema change).
 */
export const stepDateSchema = z
  .object({
    date: z.date({ message: 'errors.dateRequired' }),
    time: z.string().min(1, 'errors.timeRequired'),
  })
  .superRefine((value, ctx) => {
    if (value.date.getDay() === 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'errors.mondayClosed',
      });
    }
    if (isBeforeToday(value.date)) {
      ctx.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'errors.pastDate',
      });
    }
  });

/**
 * Step 2 — How many people + privatize add-on.
 *
 * Constraints:
 *   - adults: integer, 1..8 (no booking without an adult)
 *   - teens: integer, 0..7
 *   - adults + teens ≤ 8 (per legacy max group)
 *   - privatize: boolean (+USD 140 flat in the price preview)
 */
export const stepPeopleSchema = z
  .object({
    adults: z
      .number({ message: 'errors.minAdults' })
      .int()
      .min(1, 'errors.minAdults')
      .max(8, 'errors.maxGroup'),
    teens: z.number().int().min(0).max(7, 'errors.maxGroup'),
    privatize: z.boolean(),
  })
  .refine((d) => d.adults + d.teens <= 8, {
    message: 'errors.maxGroup',
    path: ['teens'],
  });

/**
 * Step 3 — Your details.
 *
 * - `name`: at least 2 chars
 * - `email`: RFC 5322 basic via Zod's built-in
 * - `whatsappOptional`: if provided, must look like an international phone.
 *   Empty string is allowed.
 */
export const stepDetailsSchema = z.object({
  name: z.string().trim().min(2, 'errors.nameRequired'),
  email: z.string().trim().email('errors.emailInvalid'),
  whatsappOptional: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'errors.whatsappInvalid')
    .optional()
    .or(z.literal('')),
});

export type StepDateInput = z.infer<typeof stepDateSchema>;
export type StepPeopleInput = z.infer<typeof stepPeopleSchema>;
export type StepDetailsInput = z.infer<typeof stepDetailsSchema>;

function isBeforeToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);
  return candidate.getTime() < today.getTime();
}
