/**
 * Booking price model (wizard-side preview).
 *
 * Pure function, separate from the UI, so the same number that shows in the
 * summary panel also goes into the persisted snapshot and (critically) matches
 * what Stripe will charge.
 *
 *   subtotal = (adults + teens) × pricePerAdult
 *   extras   = Σ extrasAmount(selectedExtras, adults + teens)
 *   total    = subtotal + extras
 *
 * Numbers are USD whole dollars. There is intentionally NO teen discount:
 * this function must mirror `computeBookingTotals` in `./totals.ts`, which is
 * what gets snapshotted on the bookings row and sent to Stripe. The
 * `pricing.test.ts` parity tests guard against drift.
 *
 * The legacy hardcoded "privatize" add-on (a single +USD 140 boolean) has been
 * REMOVED from the active flow. "Tour privado" — and every other add-on — now
 * flows through the unified `selectedExtras` contract below. Historical
 * bookings keep their `privatize`/`privatizeFee` columns, but no active code
 * path computes or writes them.
 */

/**
 * The shared pricing contract for a single selected extra.
 *
 * Consumed IDENTICALLY by `calculatePrice` (wizard preview) and
 * `computeBookingTotals` (persisted snapshot / Stripe), so the two can never
 * drift. `pax` is the headcount the extra scales against (adults + teens).
 */
export interface SelectedExtra {
  price: number;
  priceType: 'total' | 'perPerson';
}

export interface PriceInputs {
  pricePerAdult: number;
  adults: number;
  teens: number;
  selectedExtras?: ReadonlyArray<SelectedExtra>;
}

export interface PriceBreakdown {
  pricePerAdult: number;
  subtotal: number;
  /** Combined amount of all selected extras (0 when none selected). */
  extras: number;
  total: number;
}

/**
 * Sum the amount contributed by a set of selected extras.
 *
 *   - `total`     extras add their price ONCE, regardless of `pax`.
 *   - `perPerson` extras add `price × pax`.
 *
 * Pure and side-effect-free so both pricing functions can share it verbatim.
 */
export function extrasAmount(xs: ReadonlyArray<SelectedExtra>, pax: number): number {
  return xs.reduce((sum, x) => sum + (x.priceType === 'perPerson' ? x.price * pax : x.price), 0);
}

/** Wizard-side price preview. Must mirror computeBookingTotals (no teen discount; flat per-person price). */
export function calculatePrice(input: PriceInputs): PriceBreakdown {
  const pax = input.adults + input.teens;
  const subtotal = pax * input.pricePerAdult;
  const extras = extrasAmount(input.selectedExtras ?? [], pax);
  return {
    pricePerAdult: input.pricePerAdult,
    subtotal,
    extras,
    total: subtotal + extras,
  };
}
