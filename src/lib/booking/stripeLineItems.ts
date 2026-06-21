import { extrasAmount } from './pricing';

/**
 * Server-side extras resolution + Stripe line-item construction.
 *
 * MONEY-CRITICAL. Two concerns live here, both pure and fully unit-tested:
 *
 *  1. `resolveSelectedExtras` — the server NEVER trusts a client-supplied
 *     price or priceType. It takes the client's `{ extraId }` selections and
 *     re-resolves the authoritative `price`, `name` and `priceType` from the
 *     extras the tour actually offers (fetched from Payload), then computes
 *     each extra's amount against the real `pax`. Unknown or inactive extras
 *     are dropped.
 *
 *  2. `buildStripeLineItems` — splits the authoritative `totalAmount` into a
 *     base line plus one line per resolved extra. Rounding happens per line
 *     (cents); the base line is DERIVED as
 *         round(totalAmount*100) − Σ(extra line cents)
 *     so `Σ(line cents) === round(totalAmount*100)` holds by construction with
 *     no 1-cent drift. The legacy privatize add-on is gone — no privatize line
 *     is ever emitted; "Tour privado" is just another extra.
 */

/** A client selection: only the id (priceType is a hint, re-resolved server-side). */
export interface SelectedExtraInput {
  extraId: number;
  priceType: 'total' | 'perPerson';
}

/** An extra as offered by the tour (resolved from Payload). */
export interface ResolvableExtra {
  id: number;
  name: string;
  price: number;
  priceType: 'total' | 'perPerson';
  active?: boolean | null;
}

/** The frozen snapshot persisted on the booking row + used to build line items. */
export interface SelectedExtraSnapshot {
  extraId: number;
  name: string;
  unitPrice: number;
  priceType: 'total' | 'perPerson';
  computedAmount: number;
}

/**
 * Re-resolve client selections to authoritative snapshots.
 *
 * - Looks each `extraId` up in the tour's offered extras.
 * - Drops unknown extras and inactive ones (`active === false`).
 * - Uses the RESOLVED price + priceType (ignores client values).
 * - Computes `computedAmount` via the shared pricing contract:
 *   total → price once; perPerson → price × pax.
 */
export function resolveSelectedExtras(
  selections: ReadonlyArray<SelectedExtraInput>,
  offered: ReadonlyArray<ResolvableExtra>,
  pax: number
): SelectedExtraSnapshot[] {
  const byId = new Map(offered.map((e) => [e.id, e]));
  const out: SelectedExtraSnapshot[] = [];

  for (const sel of selections) {
    const extra = byId.get(sel.extraId);
    if (!extra) continue;
    if (extra.active === false) continue;

    const computedAmount = extrasAmount(
      [{ price: extra.price, priceType: extra.priceType }],
      pax
    );

    out.push({
      extraId: extra.id,
      name: extra.name,
      unitPrice: extra.price,
      priceType: extra.priceType,
      computedAmount,
    });
  }

  return out;
}

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

export interface BuildStripeLineItemsInput {
  baseProductName: string;
  baseDescription: string;
  currency: string;
  totalAmount: number;
  selectedExtras: ReadonlyArray<SelectedExtraSnapshot>;
  metadata: { tourSlug: string; bookingReference: string };
}

/**
 * Build the Stripe `line_items` array.
 *
 * One line per extra (qty 1, unit_amount = computedAmount × 100) plus a base
 * line whose cents are DERIVED from the authoritative total so the sum
 * reconciles exactly:
 *
 *   extraCents = Σ round(computedAmount × 100)
 *   baseCents  = round(totalAmount × 100) − extraCents
 *   Σ(line cents) === round(totalAmount × 100)   ✔ by construction
 */
export function buildStripeLineItems(input: BuildStripeLineItemsInput): StripeLineItem[] {
  const currency = input.currency.toLowerCase();
  const totalCents = Math.round(input.totalAmount * 100);

  const extraItems: StripeLineItem[] = input.selectedExtras.map((extra) => ({
    quantity: 1,
    price_data: {
      currency,
      unit_amount: Math.round(extra.computedAmount * 100),
      product_data: {
        name: extra.name,
        metadata: {
          tourSlug: input.metadata.tourSlug,
          bookingReference: input.metadata.bookingReference,
          extraId: String(extra.extraId),
        },
      },
    },
  }));

  const extraCents = extraItems.reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0
  );
  const baseCents = totalCents - extraCents;

  const baseItem: StripeLineItem = {
    quantity: 1,
    price_data: {
      currency,
      unit_amount: baseCents,
      product_data: {
        name: input.baseProductName,
        description: input.baseDescription,
        metadata: {
          tourSlug: input.metadata.tourSlug,
          bookingReference: input.metadata.bookingReference,
        },
      },
    },
  };

  return [baseItem, ...extraItems];
}
