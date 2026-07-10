/**
 * Single system currency.
 *
 * Business decision (locked): the whole site — tours AND bike rentals — charges
 * in Mexican pesos. There is intentionally NO currency selector and NO
 * conversion layer: foreign customers still pay, their bank converts at the
 * card-network rate. See docs/BUSINESS_RULES.md §6 (currency).
 *
 * This is the ONE place the ISO code lives. Money paths (checkout, Stripe line
 * items, the persisted booking snapshot) and every price display read from here
 * so the charged currency and the shown currency can never drift.
 *
 * MXN is a 2-decimal currency, so the existing `× 100` (centavos) convention in
 * `stripeLineItems.ts` is correct unchanged — this is NOT a zero-decimal
 * currency like JPY.
 */
export const BOOKING_CURRENCY = 'MXN';
