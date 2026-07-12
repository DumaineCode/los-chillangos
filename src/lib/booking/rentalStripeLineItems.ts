/**
 * Stripe line-item builder for standalone bike rentals (Batch 3b / PR3).
 *
 * MONEY-CRITICAL and PURE. Mirrors the cents-reconciliation DISCIPLINE of
 * `buildStripeLineItems`, but a rental is far simpler than a tour booking: there
 * are no extras, so it is always a SINGLE line of `quantity` bikes at the tier's
 * per-bike price.
 *
 * Reconciliation guarantee (AC25): with `totalAmount = quantity × unitPrice` and
 * integer tier prices,
 *   quantity × round(unitPrice × 100) === round(totalAmount × 100)
 * holds by construction, so `Σ(line cents) === round(totalAmount × 100)`. Currency
 * is emitted lowercased (`mxn`) exactly like the booking builder.
 */

interface StripeLineItem {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: {
      name: string;
      description?: string;
      metadata: Record<string, string>;
    };
  };
}

export interface BuildRentalLineItemsInput {
  /** 3-letter currency (e.g. `MXN`); emitted lowercased. */
  currency: string;
  /** Per-bike price in major units (MXN). */
  unitPrice: number;
  /** Number of bikes (Stripe line `quantity`). */
  quantity: number;
  /** Authoritative total = quantity × unitPrice (used for the reconciliation guard). */
  totalAmount: number;
  /** Public rental reference, surfaced in the line-item metadata. */
  reference: string;
  /** Ride length in minutes — drives the human-readable "Bike rental — Nh" name. */
  durationMinutes: number;
}

/** Human-readable ride length: whole hours as `Nh`, otherwise `N min`. */
function formatDuration(durationMinutes: number): string {
  if (Number.isFinite(durationMinutes) && durationMinutes > 0 && durationMinutes % 60 === 0) {
    return `${durationMinutes / 60}h`;
  }
  return `${durationMinutes} min`;
}

/**
 * Build the Stripe `line_items` array for a rental. One line, `quantity` bikes,
 * `unit_amount = unitPrice × 100` cents. The reconciliation guard is intrinsic:
 * `quantity × unit_amount === round(totalAmount × 100)` whenever `totalAmount =
 * quantity × unitPrice` AND the tier price is a whole number of cents. Both
 * invariants are asserted at runtime (M1) so a mis-priced tier fails loudly
 * instead of drifting the customer's charge.
 */
export function buildRentalLineItems(input: BuildRentalLineItemsInput): StripeLineItem[] {
  const currency = input.currency.toLowerCase();

  // Reconciliation guard (M1): `Σ(line cents) === round(totalAmount × 100)` only
  // holds when the per-bike price is a whole number of cents. If `unitPrice × 100`
  // is not an integer, `quantity × round(unitPrice×100)` would silently drift from
  // `round(totalAmount×100)`, so we refuse to build a line that would not reconcile.
  const rawCents = input.unitPrice * 100;
  if (!Number.isInteger(rawCents)) {
    throw new Error(
      `Rental unitPrice ${input.unitPrice} does not resolve to a whole number of cents ` +
        `(${rawCents}); refusing to build a Stripe line that would not reconcile.`
    );
  }
  const unitAmount = rawCents;

  // Defense in depth: assert the intrinsic reconciliation actually holds for this
  // input before we hand it to Stripe.
  const lineCents = unitAmount * input.quantity;
  const totalCents = Math.round(input.totalAmount * 100);
  if (lineCents !== totalCents) {
    throw new Error(
      `Rental line cents ${lineCents} do not reconcile with total cents ${totalCents} ` +
        `(unitPrice ${input.unitPrice} × quantity ${input.quantity} vs totalAmount ${input.totalAmount}).`
    );
  }

  return [
    {
      quantity: input.quantity,
      price_data: {
        currency,
        unit_amount: unitAmount,
        product_data: {
          name: `Bike rental — ${formatDuration(input.durationMinutes)}`,
          metadata: {
            rentalReference: input.reference,
          },
        },
      },
    },
  ];
}
