import { z } from 'zod';

import { isDateBeforeTodayInTourTZ, isWeekdayAvailable } from './availability';

/**
 * Booking flow Zod schemas (Sub-etapa B).
 *
 * Each step has its own schema so the wizard can validate incrementally.
 * Error messages are i18n KEYS (not human strings) — the form renders them
 * through `useTranslations('booking.errors')`. Keep keys flat and stable.
 *
 * `stepDateSchema` and `stepPeopleSchema` are now FACTORIES that take a tour
 * context (available weekdays, per-slot capacity). The factory pattern keeps
 * the wizard form pure — the tour data flows in once at render time and the
 * schemas only know about the validation rules.
 *
 * The wizard still owns "now" so tests can pin it. In production the caller
 * passes nothing and the helper defaults to `new Date()`.
 */

/**
 * Step 1 — Pick a date + time.
 *
 *   - `date` must be a Date and:
 *       * its calendar weekday (in CDMX) must be in `availableDays`
 *       * it must not be strictly before today (in CDMX)
 *   - `time` is required (free-form; the wizard offers chips derived from
 *     `tour.timeSlots`).
 *
 * Same-day cutoff is intentionally NOT enforced here — the client doesn't
 * always know "now" with second precision, and re-rendering chips on a 1s
 * tick would flicker. The server route in Sub-etapa C is the authoritative
 * gate for `< 2h to departure`.
 */
export function stepDateSchema(ctx: {
  availableDays: ReadonlyArray<string | number>;
  now?: Date;
}) {
  return z
    .object({
      date: z.date({ message: 'errors.dateRequired' }),
      time: z.string().min(1, 'errors.timeRequired'),
    })
    .superRefine((value, zctx) => {
      if (!isWeekdayAvailable(value.date, ctx.availableDays)) {
        zctx.addIssue({
          code: 'custom',
          path: ['date'],
          message: 'errors.dayClosed',
        });
      }
      if (isDateBeforeTodayInTourTZ(value.date, ctx.now)) {
        zctx.addIssue({
          code: 'custom',
          path: ['date'],
          message: 'errors.pastDate',
        });
      }
    });
}

/**
 * Step 2 — How many people + privatize add-on.
 *
 * Capacity is dynamic per slot (Sub-etapa B). The factory takes the chosen
 * slot's capacity and enforces:
 *   - adults: integer, 1..capacity
 *   - teens: integer, 0..capacity
 *   - adults + teens <= capacity
 *   - privatize: boolean (price preview only — flat fee snapshotted at write)
 *
 * TODO: when next-intl error rendering grows placeholder support, pass
 * `{capacity}` into the localized `errors.maxGroupSlot` message instead of
 * the current fixed string.
 */
export function stepPeopleSchema(ctx: { slotCapacity: number }) {
  const cap = Math.max(1, Math.trunc(ctx.slotCapacity));
  return z
    .object({
      adults: z
        .number({ message: 'errors.minAdults' })
        .int()
        .min(1, 'errors.minAdults')
        .max(cap, 'errors.maxGroupSlot'),
      teens: z.number().int().min(0).max(cap, 'errors.maxGroupSlot'),
      privatize: z.boolean(),
    })
    .refine((d) => d.adults + d.teens <= cap, {
      message: 'errors.maxGroupSlot',
      path: ['teens'],
    });
}

/**
 * Step 3 — Your details. Static (not tour-dependent).
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

export type StepDateInput = z.infer<ReturnType<typeof stepDateSchema>>;
export type StepPeopleInput = z.infer<ReturnType<typeof stepPeopleSchema>>;
export type StepDetailsInput = z.infer<typeof stepDetailsSchema>;
