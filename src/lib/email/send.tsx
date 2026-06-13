import { render } from '@react-email/render';
import * as React from 'react';

import { getPayload } from '../payload';
import { BookingConfirmation } from '../../emails/BookingConfirmation';
import { OwnerNotification } from '../../emails/OwnerNotification';
import { EMAIL_STRINGS } from '../../emails/strings';
import { isEmailConfigured, resend } from './client';
import { DEFAULT_EMAIL_COPY, type EmailCopy } from './defaults';
import { getEmailFrom, getOwnerEmailFromEnv, getReplyToFromEnv } from './env';
import {
  formatBookingDate,
  formatMoney,
  formatTime,
  interpolate,
  toLines,
  type EmailLocale,
} from './format';

/**
 * Booking email orchestrator.
 *
 * Called from the Stripe webhook on the `pending → paid` transition. It loads
 * the booking + tour title (in the guest's locale) + the editable
 * `email-content` global + `contact-info` global, then renders and sends:
 *   1. a styled confirmation to the guest, and
 *   2. an internal notification to the owner.
 *
 * Contract: this function NEVER throws. Each send is isolated and logged so a
 * transient Resend failure on one email can't block the other or bubble a 500
 * back to Stripe (which would retry into the webhook's idempotent short-circuit
 * and silently drop the email). The webhook also wraps the call defensively.
 */
export async function sendBookingEmails(bookingId: number): Promise<void> {
  if (!isEmailConfigured) {
    console.warn('[email] RESEND_API_KEY not set — skipping booking emails', { bookingId });
    return;
  }

  let data: BookingEmailData | null = null;
  try {
    data = await loadBookingEmailData(bookingId);
  } catch (err) {
    console.error('[email] failed to load booking email data', { bookingId, err });
    return;
  }
  if (!data) {
    console.warn('[email] booking not found for email send', { bookingId });
    return;
  }

  await sendConfirmation(data);
  await sendOwnerNotification(data);
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

interface BookingEmailData {
  locale: EmailLocale;
  reference: string;
  tourTitle: string;
  dateLabel: string;
  timeLabel: string;
  guestsLabel: string;
  totalLabel: string;
  customer: { name: string; firstName: string; email: string; whatsapp: string | null };
  copy: EmailCopy;
  logoUrl: string | null;
  contact: {
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    addressLabel: string | null;
  } | null;
  adminUrl: string | null;
}

interface BookingDoc {
  id: number;
  reference?: string | null;
  tour?: number | { id: number } | null;
  date?: string | null;
  time?: string | null;
  adults?: number | null;
  teens?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  customer?: {
    name?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    locale?: string | null;
  } | null;
}

async function loadBookingEmailData(bookingId: number): Promise<BookingEmailData | null> {
  const payload = await getPayload();

  const booking = (await payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 0,
    overrideAccess: true,
  })) as BookingDoc | null;

  if (!booking || !booking.customer?.email) return null;

  const locale: EmailLocale = booking.customer.locale === 'es' ? 'es' : 'en';
  const strings = EMAIL_STRINGS[locale];

  const tourId = typeof booking.tour === 'object' ? booking.tour?.id : booking.tour;
  const tourTitle = tourId ? await loadTourTitle(tourId, locale) : 'Tour';

  const copy = await loadCopy(locale);
  const { logoUrl, contact } = await loadGlobals(locale);

  const adults = booking.adults ?? 0;
  const teens = booking.teens ?? 0;
  const currency = booking.currency ?? 'USD';
  const fullName = booking.customer.name?.trim() || (locale === 'es' ? 'viajero' : 'traveler');

  return {
    locale,
    reference: booking.reference ?? `#${booking.id}`,
    tourTitle,
    dateLabel: booking.date ? formatBookingDate(booking.date, locale) : '',
    timeLabel: booking.time ? formatTime(booking.time, locale) : '',
    guestsLabel: strings.guests(adults, teens),
    totalLabel: formatMoney(booking.totalAmount ?? 0, currency, locale),
    customer: {
      name: fullName,
      firstName: fullName.split(' ')[0] ?? fullName,
      email: booking.customer.email,
      whatsapp: booking.customer.whatsapp?.trim() || null,
    },
    copy,
    logoUrl,
    contact,
    adminUrl: buildAdminUrl(booking.id),
  };
}

async function loadTourTitle(tourId: number, locale: EmailLocale): Promise<string> {
  try {
    const payload = await getPayload();
    const tour = (await payload.findByID({
      collection: 'tours',
      id: tourId,
      depth: 0,
      locale,
      fallbackLocale: 'en',
      overrideAccess: true,
    })) as { title?: string | null } | null;
    return tour?.title?.trim() || 'Tour';
  } catch {
    return 'Tour';
  }
}

/** Merge the editable global over the per-locale code defaults. */
async function loadCopy(locale: EmailLocale): Promise<EmailCopy> {
  const fallback = DEFAULT_EMAIL_COPY[locale];
  try {
    const payload = await getPayload();
    const global = (await payload.findGlobal({
      slug: 'email-content',
      locale,
      fallbackLocale: 'en',
      depth: 0,
    })) as { confirmation?: Partial<EmailCopy> | null } | null;
    const c = global?.confirmation ?? {};
    return {
      subject: pick(c.subject, fallback.subject),
      previewText: pick(c.previewText, fallback.previewText),
      greeting: pick(c.greeting, fallback.greeting),
      intro: pick(c.intro, fallback.intro),
      goodToKnow: pick(c.goodToKnow, fallback.goodToKnow),
      meetingPoint: pick(c.meetingPoint, fallback.meetingPoint),
      closing: pick(c.closing, fallback.closing),
      signature: pick(c.signature, fallback.signature),
      footnote: pick(c.footnote, fallback.footnote),
    };
  } catch {
    return fallback;
  }
}

async function loadGlobals(
  locale: EmailLocale
): Promise<{ logoUrl: string | null; contact: BookingEmailData['contact'] }> {
  let logoUrl: string | null = null;
  let contact: BookingEmailData['contact'] = null;

  try {
    const payload = await getPayload();
    const emailGlobal = (await payload.findGlobal({
      slug: 'email-content',
      locale,
      fallbackLocale: 'en',
      depth: 1,
    })) as { logo?: { url?: string | null } | null } | null;
    logoUrl = absolutize(emailGlobal?.logo?.url ?? null);
  } catch {
    /* logo is optional */
  }

  try {
    const payload = await getPayload();
    const info = (await payload.findGlobal({
      slug: 'contact-info',
      locale,
      fallbackLocale: 'en',
      depth: 0,
    })) as {
      whatsapp?: string | null;
      email?: string | null;
      address?: string | null;
      addressLabel?: string | null;
    } | null;
    if (info) {
      contact = {
        whatsapp: info.whatsapp?.trim() || null,
        email: info.email?.trim() || null,
        address: info.address?.trim() || null,
        addressLabel: info.addressLabel?.trim() || null,
      };
    }
  } catch {
    /* contact block is optional */
  }

  return { logoUrl, contact };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function sendConfirmation(data: BookingEmailData): Promise<void> {
  const strings = EMAIL_STRINGS[data.locale];
  const tokens = {
    name: data.customer.firstName,
    tour: data.tourTitle,
    reference: data.reference,
  };

  const subject = interpolate(data.copy.subject, tokens);
  const props = {
    previewText: interpolate(data.copy.previewText, tokens),
    copy: {
      greeting: interpolate(data.copy.greeting, tokens),
      intro: interpolate(data.copy.intro, tokens),
      goodToKnow: toLines(data.copy.goodToKnow),
      meetingPoint: data.copy.meetingPoint || null,
      closing: data.copy.closing || null,
      signature: data.copy.signature || null,
    },
    labels: {
      detailsTitle: strings.detailsTitle,
      goodToKnowTitle: strings.goodToKnowTitle,
      meetingPointTitle: strings.meetingPointTitle,
      reference: strings.label.reference,
      tour: strings.label.tour,
      date: strings.label.date,
      time: strings.label.time,
      guests: strings.label.guests,
      total: strings.label.total,
    },
    facts: {
      reference: data.reference,
      tourTitle: data.tourTitle,
      dateLabel: data.dateLabel,
      timeLabel: data.timeLabel,
      guestsLabel: data.guestsLabel,
      totalLabel: data.totalLabel,
    },
    logoUrl: data.logoUrl,
    contact: data.contact,
    footnote: data.copy.footnote || null,
  };

  const replyTo =
    getReplyToFromEnv() ?? getOwnerEmailFromEnv() ?? data.contact?.email ?? undefined;

  try {
    const html = await render(<BookingConfirmation {...props} />);
    const text = await render(<BookingConfirmation {...props} />, { plainText: true });
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: data.customer.email,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error('[email] confirmation send returned error', {
        reference: data.reference,
        to: data.customer.email,
        error,
      });
    }
  } catch (err) {
    console.error('[email] confirmation send threw', { reference: data.reference, err });
  }
}

async function sendOwnerNotification(data: BookingEmailData): Promise<void> {
  const owner = getOwnerEmailFromEnv() ?? data.contact?.email ?? null;
  if (!owner) {
    console.warn('[email] no owner recipient configured (set BOOKING_NOTIFY_EMAIL)', {
      reference: data.reference,
    });
    return;
  }

  const element = (
    <OwnerNotification
      reference={data.reference}
      tourTitle={data.tourTitle}
      dateLabel={data.dateLabel}
      timeLabel={data.timeLabel}
      guestsLabel={data.guestsLabel}
      totalLabel={data.totalLabel}
      customer={{
        name: data.customer.name,
        email: data.customer.email,
        whatsapp: data.customer.whatsapp,
        locale: data.locale,
      }}
      adminUrl={data.adminUrl}
    />
  );

  try {
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: owner,
      subject: `New booking — ${data.reference} · ${data.tourTitle}`,
      html,
      text,
      // Replies go straight to the guest.
      replyTo: data.customer.email,
    });
    if (error) {
      console.error('[email] owner notification send returned error', {
        reference: data.reference,
        to: owner,
        error,
      });
    }
  } catch (err) {
    console.error('[email] owner notification send threw', { reference: data.reference, err });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick(value: string | null | undefined, fallback: string): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return v.length > 0 ? v : fallback;
}

/** Turn a possibly-relative media URL into an absolute one for email clients. */
function absolutize(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (!base) return null; // relative URL is useless in an inbox — drop it
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function buildAdminUrl(bookingId: number): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/admin/collections/bookings/${bookingId}`;
}
