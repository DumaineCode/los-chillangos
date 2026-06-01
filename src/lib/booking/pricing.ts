/**
 * Booking price model (wizard-side preview).
 *
 * Pure function, separate from the UI, so the same number that shows in the
 * summary panel also goes into the WhatsApp message body and (critically)
 * matches what Stripe will charge.
 *
 *   subtotal = (adults + teens) × pricePerAdult
 *   privatizeAddOn = privatize ? PRIVATIZE_FLAT : 0
 *   estimatedTotal = subtotal + privatizeAddOn
 *
 * Numbers are USD whole dollars. There is intentionally NO teen discount:
 * this function must mirror `computeBookingTotals` in `./totals.ts`, which
 * is what gets snapshotted on the bookings row and sent to Stripe. The
 * `pricing.test.ts` parity tests guard against drift.
 */
export interface PriceInputs {
  pricePerAdult: number;
  adults: number;
  teens: number;
  privatize: boolean;
}

export interface PriceBreakdown {
  pricePerAdult: number;
  subtotal: number;
  addon: number;
  total: number;
}

/** Flat USD add-on charged when a customer privatizes the departure. */
export const PRIVATIZE_FLAT = 140;

/** Wizard-side price preview. Must mirror computeBookingTotals (no teen discount; flat per-person price). */
export function calculatePrice(input: PriceInputs): PriceBreakdown {
  const subtotal = (input.adults + input.teens) * input.pricePerAdult;
  const addon = input.privatize ? PRIVATIZE_FLAT : 0;
  return {
    pricePerAdult: input.pricePerAdult,
    subtotal,
    addon,
    total: subtotal + addon,
  };
}
