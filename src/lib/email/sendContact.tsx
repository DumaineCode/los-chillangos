import { render } from '@react-email/render';
import * as React from 'react';

import { getPayload } from '../payload';
import { ContactNotification } from '../../emails/ContactNotification';
import { isEmailConfigured, resend } from './client';
import { getEmailFrom, getOwnerEmailFromEnv } from './env';

export interface ContactEmailInput {
  messageId: number;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  locale: 'en' | 'es';
}

/**
 * Send the owner a notification when the public contact form is submitted.
 *
 * Mirrors `sendBookingEmails`' contract: this function NEVER throws. A missing
 * Resend key or a transient send failure is logged and swallowed so it can't
 * turn a successful form submission (the row is already saved) into a 500.
 *
 * Reply-To is set to the visitor's email so the owner can hit "reply" and
 * answer them directly.
 */
export async function sendContactNotification(input: ContactEmailInput): Promise<void> {
  if (!isEmailConfigured) {
    console.warn('[email] RESEND_API_KEY not set — skipping contact notification', {
      messageId: input.messageId,
    });
    return;
  }

  const owner = getOwnerEmailFromEnv() ?? (await loadContactEmail());
  if (!owner) {
    console.warn('[email] no owner recipient configured (set BOOKING_NOTIFY_EMAIL)', {
      messageId: input.messageId,
    });
    return;
  }

  const element = (
    <ContactNotification
      name={input.name}
      email={input.email}
      phone={input.phone}
      message={input.message}
      locale={input.locale}
      adminUrl={buildAdminUrl(input.messageId)}
    />
  );

  try {
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: owner,
      subject: `New contact message — ${input.name}`,
      html,
      text,
      // Replies go straight to the visitor.
      replyTo: input.email,
    });
    if (error) {
      console.error('[email] contact notification send returned error', {
        messageId: input.messageId,
        to: owner,
        error,
      });
    }
  } catch (err) {
    console.error('[email] contact notification send threw', {
      messageId: input.messageId,
      err,
    });
  }
}

/** Fallback owner recipient: the email on the ContactInfo global. */
async function loadContactEmail(): Promise<string | null> {
  try {
    const payload = await getPayload();
    const info = (await payload.findGlobal({
      slug: 'contact-info',
      depth: 0,
    })) as { email?: string | null } | null;
    return info?.email?.trim() || null;
  } catch {
    return null;
  }
}

function buildAdminUrl(messageId: number): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/admin/collections/contact-messages/${messageId}`;
}
