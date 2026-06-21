import { type SelectedExtra, extrasAmount } from './pricing';

/**
 * Booking totals — snapshotted at booking time.
 *
 * `pricing.ts` is the wizard-side preview model (flat per-person price plus the
 * unified `selectedExtras` contract). This module computes the persisted
 * snapshot stored on the `bookings` row (`totalPersons`, `totalAmount`) and
 * sent to Stripe. The Bookings collection field hook calls this so admin-edited
 * and API-created rows stay consistent.
 *
 * Design notes:
 *   - `pricePerPerson` is whatever the caller agreed to charge per head AT
 *     booking time. It is a snapshot, not a foreign key to `tours.price`.
 *   - `selectedExtras` is the SAME shape `calculatePrice` consumes, so the two
 *     can never drift. A parity test in `pricing.test.ts` asserts they return
 *     the same total for identical inputs.
 *   - The math is intentionally trivial (headcount × price + extras) so the DB
 *     total equals what Stripe charges and what the wizard preview shows.
 *   - Undefined inputs collapse to 0 so a partial form save in `/admin`
 *     doesn't produce NaN.
 *
 * Legacy `privatize`/`privatizeFee` are NO LONGER part of the active total. The
 * columns remain on the Bookings collection for historical rows, but the active
 * pricing path computes from `selectedExtras` only. Historical rows that
 * predate extras simply pass an empty `selectedExtras` and keep their stored
 * `totalAmount` (the headcount × pricePerPerson term reproduces their base; the
 * old privatize fee, if any, is preserved as-is on the row and not recomputed).
 */
export interface BookingTotalsInput {
  adults: number | null | undefined;
  teens: number | null | undefined;
  pricePerPerson: number | null | undefined;
  selectedExtras?: ReadonlyArray<SelectedExtra> | null;
}

export interface BookingTotals {
  totalPersons: number;
  totalAmount: number;
}

function num(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function computeBookingTotals(input: BookingTotalsInput): BookingTotals {
  const adults = num(input.adults);
  const teens = num(input.teens);
  const pricePerPerson = num(input.pricePerPerson);

  const totalPersons = adults + teens;
  const extras = extrasAmount(input.selectedExtras ?? [], totalPersons);
  const totalAmount = totalPersons * pricePerPerson + extras;

  return { totalPersons, totalAmount };
}
