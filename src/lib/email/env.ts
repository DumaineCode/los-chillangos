/**
 * Email environment helpers.
 *
 * Mirrors `src/lib/stripe/env.ts`: small functions that read + normalize the
 * email-related env vars in one place so the send code stays declarative.
 *
 * Required for real delivery:
 *   - RESEND_API_KEY       — read by `client.ts`.
 *   - EMAIL_FROM           — verified-domain sender, e.g.
 *                            "Los Chillangos <reservas@loschillangos.com>".
 *                            Falls back to Resend's shared dev sender, which
 *                            ONLY delivers to your own Resend account email.
 * Optional:
 *   - BOOKING_NOTIFY_EMAIL — owner notification recipient. When unset, the
 *                            send code falls back to the ContactInfo global.
 *   - EMAIL_REPLY_TO       — Reply-To on the customer confirmation so guest
 *                            replies reach a human. Defaults to the owner addr.
 */

/** Resend's shared sandbox sender — only delivers to the account owner. */
const DEV_FALLBACK_FROM = 'Los Chillangos <onboarding@resend.dev>';

export function getEmailFrom(): string {
  const v = process.env.EMAIL_FROM?.trim();
  return v && v.length > 0 ? v : DEV_FALLBACK_FROM;
}

/** Owner notification recipient from env, or null to fall back to ContactInfo. */
export function getOwnerEmailFromEnv(): string | null {
  const v = process.env.BOOKING_NOTIFY_EMAIL?.trim();
  return v && v.length > 0 ? v : null;
}

/** Explicit Reply-To override, or null to let the send code derive one. */
export function getReplyToFromEnv(): string | null {
  const v = process.env.EMAIL_REPLY_TO?.trim();
  return v && v.length > 0 ? v : null;
}
