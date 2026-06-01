/**
 * Booking reference generator.
 *
 * Public-facing booking codes look like `LC-7F3A91C2`.
 *
 *   - `LC` = "Los Chillangos". Stable brand prefix.
 *   - 8 uppercase chars derived from `crypto.randomUUID()`:
 *     strip dashes, take the first 8 hex chars, uppercase. UUID v4 supplies
 *     ~32 bits of entropy in those 8 chars (≈ 4.3B values), which is more
 *     than enough for human-readable booking refs given the `unique` index
 *     on the column. A collision is caught by the DB UNIQUE constraint —
 *     the API in Sub-etapa C will retry on conflict.
 *
 * Pure function. Used by:
 *   - The Bookings collection `beforeValidate` hook (auto-fill on manual
 *     admin creates, or programmatic `payload.create` where caller didn't
 *     pre-generate one).
 *   - The booking API route in Sub-etapa C, which pre-generates so it can
 *     return the reference to the client before persisting.
 */
export function generateBookingReference(): string {
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return `LC-${uuid.slice(0, 8).toUpperCase()}`;
}
