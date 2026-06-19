/**
 * WhatsApp number helpers for the public site.
 *
 * The `ContactInfo.whatsapp` global stores a single value in E.164 format
 * (e.g. `+525555555555`). We deliberately keep ONE editable field so the
 * client never has to maintain a separate "display" string. The link form and
 * the human-readable form are both derived from that single source of truth.
 */

/**
 * Strip every non-digit character so the value can be dropped into a
 * `https://wa.me/<digits>` deep link. Returns an empty string when there are
 * no digits, which callers should treat as "no WhatsApp configured".
 */
export function toWhatsAppDigits(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\D+/g, '');
}

/**
 * Build the `wa.me` link from a raw E.164-ish value. Returns `null` when the
 * value yields no digits so the caller can skip rendering the button.
 */
export function buildWhatsAppLink(raw: string | null | undefined): string | null {
  const digits = toWhatsAppDigits(raw);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

/**
 * Format an E.164-ish value into a human-readable string for display, derived
 * purely from the stored number (no extra admin field).
 *
 * - Mexican numbers (`+52`, 10 national digits) → `+52 55 5555 5555`.
 * - Anything else → a generic, readable grouping that keeps the leading `+`
 *   and country code, e.g. `+1 415 555 0123`.
 *
 * Falls back to the trimmed raw input when it can't make sense of the value,
 * so the button never shows an empty label for a non-empty number.
 */
export function formatWhatsAppDisplay(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const digits = toWhatsAppDigits(trimmed);
  if (!digits) return trimmed;

  // Mexico: country code 52 + 10 national digits → +52 AA BBBB CCCC
  if (digits.startsWith('52') && digits.length === 12) {
    const national = digits.slice(2);
    const area = national.slice(0, 2);
    const part1 = national.slice(2, 6);
    const part2 = national.slice(6);
    return `+52 ${area} ${part1} ${part2}`;
  }

  // Generic international fallback. We can't infer the country code length
  // reliably from digits alone, so we use a couple of safe heuristics:
  //   - NANP (+1 + 10 national digits) → 1-digit code.
  //   - 12 digits → assume a 2-digit code (the common case for our markets).
  //   - otherwise → 1-digit code.
  // Then group the national part in readable chunks.
  const ccLen = digits.startsWith('1') && digits.length === 11 ? 1 : digits.length === 12 ? 2 : 1;
  const cc = digits.slice(0, ccLen);
  const national = digits.slice(ccLen);
  const groups = groupNationalDigits(national);
  return `+${cc}${groups.length ? ` ${groups.join(' ')}` : ''}`;
}

/**
 * Split national digits into readable groups. Uses 3-digit groups, with the
 * trailing remainder kept as 4 digits when possible (common phone cadence).
 */
function groupNationalDigits(national: string): string[] {
  if (!national) return [];
  const groups: string[] = [];
  let rest = national;
  while (rest.length > 4) {
    groups.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  groups.push(rest);
  return groups;
}
