import { Resend } from 'resend';

/**
 * Server-side Resend client.
 *
 * Unlike `src/lib/stripe/client.ts`, this module NEVER throws on a missing key.
 * The Stripe client is essential to the webhook (it flips bookings to `paid`),
 * so it fails loud. Email is a non-essential side effect: a missing
 * `RESEND_API_KEY` must NOT break the webhook (that would leave paid customers
 * stuck in `pending`). Instead we expose `isEmailConfigured` and let the send
 * code skip gracefully with a warning.
 *
 * Resend's SDK performs no network I/O at construction — it only stores the
 * key — so building the singleton eagerly (even with a placeholder) is safe.
 */
const apiKey = process.env.RESEND_API_KEY?.trim();

/** True when a real key is present (or under test, where the SDK is mocked). */
export const isEmailConfigured = Boolean(apiKey) || process.env.NODE_ENV === 'test';

export const resend = new Resend(apiKey || 're_unconfigured_placeholder');
