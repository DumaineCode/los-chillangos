/**
 * WhatsApp + mailto deep-link builders (PR 5).
 *
 * These are PURE functions — no React, no Next, no I/O. The booking flow
 * collects a `BookingIntent` from the wizard and a `DeepLinkContext` from
 * the Payload `ContactInfo` global, then asks this module for the URL.
 *
 * Why three functions:
 *   - `buildMessageBody` is the source of truth for the wording. Both
 *     WhatsApp and mailto bodies share it.
 *   - `buildWhatsAppDeepLink` URL-encodes the body and stitches it to a
 *     `wa.me` URL with the digits-only phone number.
 *   - `buildMailtoLink` URL-encodes subject + body and stitches them to a
 *     `mailto:` URL.
 *
 * Localization is handled here too via `Intl.DateTimeFormat` and
 * `Intl.NumberFormat`. We accept a `locale` of either `'en' | 'es'` and
 * map to a concrete BCP-47 tag (`en-US`, `es-MX`) internally. The page-
 * level i18n labels (`Name:`, `Tour:`, etc.) are passed in as a `labels`
 * object so the caller can plug in `next-intl` translations.
 */

export type BookingLocale = 'en' | 'es';

export interface BookingIntent {
  tourTitle: string; // localized
  tourSlug: string;
  date: Date;
  time: string; // e.g. "09:00"
  adults: number;
  teens: number;
  privatize: boolean;
  estimatedTotal: number; // USD
  customerName: string;
  customerEmail: string;
  customerWhatsapp?: string;
  locale: BookingLocale;
}

export interface DeepLinkContext {
  contactWhatsapp: string; // E.164 format with leading +, e.g. "+525555555555"
  contactEmail: string;
  siteUrl: string; // used by callers if they want it (footer text is also fine)
}

export interface BookingMessageLabels {
  /** "Hi Los Chillangos! …" or the Spanish twin. */
  greeting: string;
  /** "Name", "Nombre". */
  name: string;
  /** "Tour" — same in both locales. */
  tour: string;
  /** "Date", "Fecha". */
  date: string;
  /** "Time", "Hora". */
  time: string;
  /** "People", "Personas". */
  people: string;
  /** "Add-on", "Extra". */
  privatize: string;
  /** "Estimated total", "Total estimado". */
  total: string;
  /** "Email" — same in both locales. */
  email: string;
  /** "WhatsApp" — same in both locales. */
  whatsapp: string;
  /** Sentence describing the privatize add-on, e.g. "Privatize this tour (+USD 140)". */
  privatizeValue: string;
  /** Footer line, e.g. "Sent from loschillangos.com". */
  footer: string;
  /**
   * Subject line for the mailto fallback. Receives `{tour}` as a placeholder
   * that the builder will replace with the tour title.
   */
  subject: string;
  /**
   * The plural-rendered "{n} adults" / "{n} adultos" string. The caller is
   * expected to pre-format this using its i18n library's plural support.
   */
  adultsValue: string;
  /** Same for teens. */
  teensValue: string;
}

/**
 * Build the message text used by both wa.me and mailto: bodies.
 *
 * Locale-aware:
 *   - Date renders via `Intl.DateTimeFormat(locale, { dateStyle: 'long' })`
 *   - Total renders via `Intl.NumberFormat(locale, { style:'currency', currency:'USD' })`
 *
 * Lines are joined with `\n` — both WhatsApp and mailto handle that fine
 * after URL-encoding (which turns `\n` into `%0A`).
 */
export function buildMessageBody(
  intent: BookingIntent,
  ctx: DeepLinkContext,
  labels: BookingMessageLabels
): string {
  void ctx; // ctx isn't consumed by the body itself; reserved for future use.
  const bcp47 = toBcp47(intent.locale);
  const dateFormatted = new Intl.DateTimeFormat(bcp47, { dateStyle: 'long' }).format(intent.date);
  const totalFormatted = new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(intent.estimatedTotal);

  const peopleParts: string[] = [];
  if (intent.adults > 0) peopleParts.push(labels.adultsValue);
  if (intent.teens > 0) peopleParts.push(labels.teensValue);
  const peopleStr = peopleParts.join(', ');

  const lines: string[] = [];
  lines.push(labels.greeting);
  lines.push('');
  lines.push(`${labels.name}: ${intent.customerName}`);
  lines.push(`${labels.tour}: ${intent.tourTitle}`);
  lines.push(`${labels.date}: ${dateFormatted}`);
  lines.push(`${labels.time}: ${intent.time}`);
  lines.push(`${labels.people}: ${peopleStr}`);
  if (intent.privatize) {
    lines.push(`${labels.privatize}: ${labels.privatizeValue}`);
  }
  lines.push(`${labels.total}: ${totalFormatted}`);
  lines.push(`${labels.email}: ${intent.customerEmail}`);
  if (intent.customerWhatsapp && intent.customerWhatsapp.trim().length > 0) {
    lines.push(`${labels.whatsapp}: ${intent.customerWhatsapp.trim()}`);
  }
  lines.push('');
  lines.push(`— ${labels.footer}`);

  return lines.join('\n');
}

/**
 * Build a `https://wa.me/{digits}?text={encoded}` deep link.
 *
 * The phone number is stripped of every non-digit character (so leading
 * `+`, spaces, dashes, and parens all disappear). Empty digits → throws
 * `BookingLinkError` so the caller can fall back to mailto:.
 */
export function buildWhatsAppDeepLink(
  intent: BookingIntent,
  ctx: DeepLinkContext,
  labels: BookingMessageLabels
): string {
  const digits = ctx.contactWhatsapp.replace(/\D+/g, '');
  if (digits.length === 0) {
    throw new BookingLinkError('contactWhatsapp', 'WhatsApp number is empty');
  }
  const body = buildMessageBody(intent, ctx, labels);
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

/**
 * Build a `mailto:` URL with subject + body filled in.
 *
 * Used as the fallback when the WhatsApp number isn't set.
 */
export function buildMailtoLink(
  intent: BookingIntent,
  ctx: DeepLinkContext,
  labels: BookingMessageLabels
): string {
  const email = ctx.contactEmail.trim();
  if (email.length === 0) {
    throw new BookingLinkError('contactEmail', 'Contact email is empty');
  }
  const subject = labels.subject.replace('{tour}', intent.tourTitle);
  const body = buildMessageBody(intent, ctx, labels);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Thrown when the deep-link builder can't construct a valid URL because the
 * Payload `ContactInfo` global is missing the channel the caller asked for.
 *
 * The UI catches this and either falls back to the other channel or shows
 * the "Configure WhatsApp or email in /admin" error.
 */
export class BookingLinkError extends Error {
  readonly field: 'contactWhatsapp' | 'contactEmail';
  constructor(field: 'contactWhatsapp' | 'contactEmail', message: string) {
    super(message);
    this.name = 'BookingLinkError';
    this.field = field;
  }
}

function toBcp47(locale: BookingLocale): string {
  return locale === 'es' ? 'es-MX' : 'en-US';
}
