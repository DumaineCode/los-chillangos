/**
 * Shared Payload field validators for the booking/rental domain.
 *
 * These mirror the inline validators historically defined in `Bookings.ts`
 * (`validateHHMM`, integer headcount) so new collections (Rentals) can reuse the
 * exact same rules without duplicating them. `Bookings.ts` keeps its own inline
 * copies untouched to avoid touching the live tour-booking flow; new rental code
 * imports from here.
 */

/** HH:MM 24h validator, mirrors `Bookings.time` / `Tours.timeSlots[].time`. */
export function validateHHMM(value: string | null | undefined): true | string {
  if (!value) return 'Time is required.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return 'Time must be HH:MM in 24h format.';
  }
  return true;
}

/** Integer validator with a minimum (Payload allows decimals on number fields). */
export function validateInteger(min: number) {
  return (value: number | null | undefined): true | string => {
    if (value === null || value === undefined) return 'Required.';
    if (!Number.isInteger(value)) return 'Must be a whole number.';
    if (value < min) return `Must be at least ${min}.`;
    return true;
  };
}

/** 3-letter uppercase ISO currency code validator (mirrors `Bookings.currency`). */
export function validateCurrency(value: string | null | undefined): true | string {
  if (!value) return 'La moneda es obligatoria.';
  if (!/^[A-Z]{3}$/.test(value)) {
    return 'La moneda debe ser un código ISO de 3 letras en mayúsculas (ej.: "MXN").';
  }
  return true;
}
