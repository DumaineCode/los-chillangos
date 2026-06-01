/**
 * Booking totals — snapshotted at booking time.
 *
 * `pricing.ts` is the UI/marketing price model (with the teen 20% discount
 * and the +USD 140 privatize add-on). That model can change.
 *
 * This module is different: it computes the persisted snapshot that will be
 * stored on the `bookings` row (`totalPersons`, `totalAmount`). The Bookings
 * collection field hook calls this so admin-edited and API-created rows stay
 * consistent.
 *
 * Design notes:
 *   - `pricePerPerson` is whatever the caller agreed to charge per head AT
 *     booking time. It is a snapshot, not a foreign key to `tours.price`.
 *   - This layer does NOT apply the teen discount — the caller (API route or
 *     admin) is expected to have already chosen the right per-person price.
 *     Keeping the math here trivial (headcount × price) means the DB total
 *     equals what Stripe will charge, with no hidden adjustments.
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
