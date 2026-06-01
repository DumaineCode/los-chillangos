/**
 * Booking totals — snapshotted at booking time.
 *
 * `pricing.ts` is the wizard-side preview model (flat per-person price plus
 * the +USD 140 privatize add-on). This module computes the persisted
 * snapshot that will be stored on the `bookings` row (`totalPersons`,
 * `totalAmount`) and sent to Stripe. The Bookings collection field hook
 * calls this so admin-edited and API-created rows stay consistent.
 *
 * Design notes:
 *   - `pricePerPerson` is whatever the caller agreed to charge per head AT
 *     booking time. It is a snapshot, not a foreign key to `tours.price`.
 *   - The math here is intentionally trivial (headcount × price) so the DB
 *     total equals what Stripe charges and what the wizard preview shows,
 *     with no hidden adjustments.
 *   - A parity test in `pricing.test.ts` asserts `calculatePrice` and
 *     `computeBookingTotals` return the same total for the same inputs.
 *   - Undefined inputs collapse to 0 so a partial form save in `/admin`
 *     doesn't produce NaN.
 */
export interface BookingTotalsInput {
  adults: number | null | undefined;
  teens: number | null | undefined;
  pricePerPerson: number | null | undefined;
  privatize: boolean | null | undefined;
  privatizeFee: number | null | undefined;
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
  const privatizeFee = num(input.privatizeFee);
  const privatize = Boolean(input.privatize);

  const totalPersons = adults + teens;
  const totalAmount = totalPersons * pricePerPerson + (privatize ? privatizeFee : 0);

  return { totalPersons, totalAmount };
}
