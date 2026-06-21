/**
 * Build the customer-facing price label for a tour extra.
 *
 * Pure and i18n-agnostic: the caller passes the already-resolved localized
 * per-person suffix (e.g. `t('common.perPersonShort')`) so this function stays
 * trivially unit-testable.
 *
 * - `total`     → `+$140` (flat, charged once)
 * - `perPerson` → `+$20 / persona` (suffix appended after a space)
 *
 * `price` is a whole-dollar USD amount; no decimals are ever rendered.
 */
export function formatExtraPrice({
  price,
  priceType,
  perPersonSuffix,
}: {
  price: number;
  priceType: 'total' | 'perPerson';
  perPersonSuffix: string;
}): string {
  const base = `+$${price}`;
  return priceType === 'perPerson' ? `${base} ${perPersonSuffix}` : base;
}
