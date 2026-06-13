/**
 * Presentation helpers for booking emails.
 *
 * Pure + deterministic so they're trivial to unit-test. All date/time
 * formatting is pinned to the tour's local calendar (America/Mexico_City);
 * the stored `date` is a timestamp at CDMX midnight and `time` is a "HH:MM"
 * clock label, so we never want the server's TZ to leak in.
 */

export type EmailLocale = 'en' | 'es';

const LOCALE_TAG: Record<EmailLocale, string> = {
  en: 'en-US',
  es: 'es-MX',
};

const TIME_ZONE = 'America/Mexico_City';

/** "$1,250.00" — `amount` is in major currency units (dollars, not cents). */
export function formatMoney(amount: number, currency: string, locale: EmailLocale): string {
  try {
    return new Intl.NumberFormat(LOCALE_TAG[locale], {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    // Unknown ISO currency → fall back to a plain number + code.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** "Saturday, March 14, 2026" / "sábado, 14 de marzo de 2026". */
export function formatBookingDate(dateISO: string, locale: EmailLocale): string {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return dateISO;
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(d);
}

/** "HH:MM" 24h → "6:00 PM" (en) / "18:00 h" (es). Returns input if malformed. */
export function formatTime(hhmm: string, locale: EmailLocale): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return hhmm;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (locale === 'es') return `${hhmm} h`;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${minutes} ${period}`;
}

/**
 * Replace `{token}` placeholders with values. Unknown tokens are left intact
 * so a typo in the CMS shows up visibly rather than silently blanking copy.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole
  );
}

/** Split a textarea value into trimmed, non-empty lines (for bullet lists). */
export function toLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
