'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type CheckoutPayload = {
  tourId: number;
  date: string;
  time: string;
  adults: number;
  teens: number;
  privatize: boolean;
  customer: {
    name: string;
    email: string;
    whatsapp: string;
    locale: 'en' | 'es';
  };
};

type Props = {
  /** Fully built payload ready to POST to /api/booking/checkout. */
  payload: CheckoutPayload;
};

/**
 * Confirmation step (Sub-etapa C).
 *
 * Replaces the WhatsApp deep-link CTA (Sub-etapa B) with a Stripe Checkout
 * redirect:
 *   1. Click "Pay & confirm" → POST /api/booking/checkout
 *   2. Server validates availability, creates `bookings` row in `pending`,
 *      creates Stripe Checkout Session, returns `checkoutUrl`.
 *   3. Client redirects via `window.location.assign(checkoutUrl)`.
 *   4. On Stripe, the customer pays. On return, success / cancelled pages
 *      handle the result (`/[locale]/book/success?ref=...&session_id=...`).
 *
 * Error mapping uses the `error` string returned by the server. Anything
 * unknown falls back to `errors.unexpected`.
 */
export function StepConfirm({ payload }: Props) {
  const t = useTranslations('booking.steps.confirm');
  const tBooking = useTranslations('booking');
  const tErrors = useTranslations('booking.errors');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePay() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/booking/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(translateError(body.error, tErrors));
        setSubmitting(false);
        return;
      }

      const body = (await res.json()) as { checkoutUrl?: string };
      if (!body.checkoutUrl) {
        setErrorMessage(tErrors('unexpected'));
        setSubmitting(false);
        return;
      }
      // Leave to Stripe.
      window.location.assign(body.checkoutUrl);
    } catch (err) {
      console.error('[checkout] request failed', err);
      setErrorMessage(tErrors('unexpected'));
      setSubmitting(false);
    }
  }

  return (
    <div style={{ textAlign: 'center' }} data-testid="booking-step-4">
      <h2>{t('title')}</h2>
      <p className="lede">{t('lede')}</p>

      <button
        type="button"
        className="btn btn-terra btn-lg"
        onClick={handlePay}
        disabled={submitting}
        style={{ marginTop: 24 }}
        data-testid="booking-confirm"
      >
        {submitting ? tBooking('creating') : `${tBooking('payCta')} →`}
      </button>

      {errorMessage ? (
        <p
          role="alert"
          style={{
            marginTop: 16,
            padding: '12px 16px',
            background: 'var(--cream)',
            border: '1px solid var(--terra)',
            borderRadius: 6,
            color: 'var(--terra)',
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      <p
        className="mono"
        style={{
          marginTop: 32,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {t('footer')}
      </p>
    </div>
  );
}

function translateError(
  code: string | undefined,
  tErrors: ReturnType<typeof useTranslations<'booking.errors'>>
): string {
  switch (code) {
    case 'no-seats-left':
      return tErrors('noSeatsLeft');
    case 'cutoff-passed':
      return tErrors('cutoffPassed');
    case 'day-closed':
      return tErrors('dayClosed');
    case 'past-date':
      return tErrors('pastDate');
    case 'unknown-slot':
      return tErrors('unknownSlot');
    case 'over-slot-capacity':
      return tErrors('maxGroupSlot');
    case 'tour-not-published':
      return tErrors('tourNotPublished');
    case 'tour-not-found':
      return tErrors('tourNotFound');
    default:
      return tErrors('unexpected');
  }
}
