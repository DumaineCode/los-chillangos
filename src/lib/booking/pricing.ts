/**
 * Booking price model (PR 5).
 *
 * Pure function, separate from the UI, so the same number that shows in the
 * summary panel also goes into the WhatsApp message body.
 *
 *   subtotal = adults × price + teens × price × 0.8
 *   privatizeAddOn = privatize ? 140 : 0
 *   estimatedTotal = subtotal + privatizeAddOn
 *
 * Numbers are USD whole dollars. Rounding to the nearest dollar keeps the
 * display tidy and matches the legacy behavior approximately.
 */
export interface PriceInputs {
  pricePerAdult: number;
  adults: number;
  teens: number;
  privatize: boolean;
}

export interface PriceBreakdown {
  pricePerAdult: number;
  pricePerTeen: number;
  subtotal: number;
  addon: number;
  total: number;
}

const TEEN_DISCOUNT = 0.8; // 20% off the adult price
const PRIVATIZE_FLAT = 140;

export function calculatePrice(input: PriceInputs): PriceBreakdown {
  const pricePerTeen = Math.round(input.pricePerAdult * TEEN_DISCOUNT);
  const subtotal = input.adults * input.pricePerAdult + input.teens * pricePerTeen;
  const addon = input.privatize ? PRIVATIZE_FLAT : 0;
  return {
    pricePerAdult: input.pricePerAdult,
    pricePerTeen,
    subtotal,
    addon,
    total: subtotal + addon,
  };
}
