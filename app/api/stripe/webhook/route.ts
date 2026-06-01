import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { HOLD_TTL_MINUTES } from '../../../../src/lib/booking/availability';
import { getPayload } from '../../../../src/lib/payload';
import { stripe } from '../../../../src/lib/stripe/client';
import { getWebhookSecret } from '../../../../src/lib/stripe/env';
import { STRIPE_EVENT } from '../../../../src/lib/stripe/events';

/**
 * Stripe webhook handler (Sub-etapa C).
 *
 * Contract:
 *   - Reads the RAW body via `request.text()`. `stripe.webhooks.constructEvent`
 *     hashes the raw bytes; parsing first would mutate whitespace and break
 *     the signature.
 *   - `runtime = 'nodejs'` because constructEvent uses Node's `crypto` module.
 *     Don't move to the edge runtime without switching to constructEventAsync
 *     with the SubtleCrypto provider.
 *   - `dynamic = 'force-dynamic'` to make sure Next never caches POSTs here.
 *
 * Response policy:
 *   - 400 ONLY on signature failure or missing signature header. Stripe will
 *     surface the failure in the dashboard and keep delivering the next
 *     event normally.
 *   - 200 for everything else, including unknown event types and logical
 *     no-ops. A non-2xx triggers Stripe's retry storm — we'd rather ack
 *     and log than queue up duplicate work.
 *   - 500 only on unexpected exceptions inside an event handler. Stripe
 *     will retry — our handlers are idempotent so that's safe.
 *
 * Idempotency:
 *   - `checkout.session.completed` is the only event that flips to `paid`.
 *     Re-delivery of the same event must NOT issue a second update. We
 *     check `booking.status === 'paid'` and short-circuit.
 *   - `expired` / `cancelled` flips are similarly short-circuited.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new NextResponse('Missing stripe-signature header', { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    return new NextResponse(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // Handler crashed — let Stripe retry. Our handlers are idempotent
    // (paid → no second write, expired → no-op, etc) so retry is safe.
    console.error('[stripe-webhook] handler threw for event', event.id, event.type, err);
    return new NextResponse('Internal error', { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case STRIPE_EVENT.CHECKOUT_SESSION_COMPLETED:
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case STRIPE_EVENT.CHECKOUT_SESSION_EXPIRED:
      await onCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      return;
    case STRIPE_EVENT.CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED:
      await onPaymentFailedFromSession(event.data.object as Stripe.Checkout.Session);
      return;
    case STRIPE_EVENT.PAYMENT_INTENT_PAYMENT_FAILED:
      await onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      return;
    default:
      // Acknowledge unknown events so Stripe stops retrying.
      console.info('[stripe-webhook] ignoring event type', event.type, event.id);
      return;
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = readBookingId(session.metadata);
  if (bookingId === null) {
    console.warn('[stripe-webhook] checkout.session.completed missing bookingId metadata', {
      sessionId: session.id,
    });
    return;
  }

  const booking = await findBookingById(bookingId);
  if (!booking) {
    console.warn('[stripe-webhook] checkout.session.completed for unknown booking', {
      bookingId,
      sessionId: session.id,
    });
    return;
  }

  // Already-terminal idempotent short-circuits. Stripe re-delivers events on
  // any non-2xx; both branches must return 200 without writing again.
  if (booking.status === 'paid' || booking.status === 'refunded') {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Late-payment auto-refund. The customer completed Stripe Checkout AFTER
  // our 15-min seat hold lapsed (status expired) OR after we cancelled the
  // booking for any reason. We don't keep the money: Stripe holds a 30-min
  // session minimum, so this window can legitimately exist.
  //
  // Idempotency key `refund-{reference}` makes Stripe reject a second refund
  // for the same booking even if this webhook is re-delivered.
  if (booking.status === 'expired' || booking.status === 'cancelled') {
    if (!paymentIntentId) {
      // checkout.session.completed without a payment_intent should be
      // impossible for `mode: 'payment'`. Log loudly and stop.
      console.error(
        '[stripe-webhook] completed event without payment_intent — cannot auto-refund',
        { bookingId, sessionId: session.id, currentStatus: booking.status }
      );
      return;
    }

    const reference = booking.reference ?? `id-${bookingId}`;
    try {
      await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          // Closest valid RefundCreateParams.reason. The real reason lives in
          // metadata.autoRefundReason for our own records.
          reason: 'requested_by_customer',
          metadata: {
            bookingId: String(bookingId),
            bookingReference: reference,
            autoRefundReason: 'hold-expired-before-payment',
          },
        },
        { idempotencyKey: `refund-${reference}` }
      );
    } catch (refundErr) {
      // Throwing makes the outer handler return 500 → Stripe retries the
      // webhook. The idempotencyKey above prevents the eventual successful
      // retry from issuing a second refund.
      console.error('[stripe-webhook] auto-refund failed', {
        bookingId,
        paymentIntentId,
        currentStatus: booking.status,
        err: refundErr,
      });
      throw refundErr;
    }

    const payload = await getPayload();
    await payload.update({
      collection: 'bookings',
      id: bookingId,
      overrideAccess: true,
      data: {
        status: 'refunded',
        stripePaymentIntentId: paymentIntentId,
        notes: appendNote(
          booking.notes,
          `Auto-refunded: customer completed Stripe Checkout after the ${HOLD_TTL_MINUTES}-minute hold expired.`
        ),
      },
    });
    return;
  }

  // Happy path: pending → paid.
  const payload = await getPayload();
  await payload.update({
    collection: 'bookings',
    id: bookingId,
    overrideAccess: true,
    data: {
      status: 'paid',
      paidAt: new Date().toISOString(),
      stripePaymentIntentId: paymentIntentId,
      holdExpiresAt: null,
    },
  });
}

async function onCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = readBookingId(session.metadata);
  if (bookingId === null) return;

  const booking = await findBookingById(bookingId);
  if (!booking) return;
  if (booking.status !== 'pending') return; // already paid/expired/cancelled

  const payload = await getPayload();
  await payload.update({
    collection: 'bookings',
    id: bookingId,
    overrideAccess: true,
    data: { status: 'expired' },
  });
}

async function onPaymentFailedFromSession(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = readBookingId(session.metadata);
  if (bookingId === null) return;
  await cancelPendingWithNote(bookingId, 'Async payment failed');
}

async function onPaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const bookingId = readBookingId(pi.metadata);
  if (bookingId === null) return;
  const reason = pi.last_payment_error?.message ?? 'unknown';
  await cancelPendingWithNote(bookingId, `Payment failed: ${reason}`);
}

async function cancelPendingWithNote(bookingId: number, note: string): Promise<void> {
  const booking = await findBookingById(bookingId);
  if (!booking) return;
  if (booking.status !== 'pending') return;

  const payload = await getPayload();
  await payload.update({
    collection: 'bookings',
    id: bookingId,
    overrideAccess: true,
    data: { status: 'cancelled', notes: note },
  });
}

function readBookingId(metadata: Stripe.Metadata | null | undefined): number | null {
  const raw = metadata?.bookingId;
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

type BookingForWebhook = {
  id: number;
  status: string;
  reference?: string | null;
  notes?: string | null;
};

async function findBookingById(id: number): Promise<BookingForWebhook | null> {
  const payload = await getPayload();
  const result = await payload.find({
    collection: 'bookings',
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const docs = (result as { docs?: BookingForWebhook[] }).docs ?? [];
  return docs[0] ?? null;
}

/**
 * Append a new line to an existing notes string without losing earlier
 * history. Returns just the new line if `existing` is empty. Used by the
 * late-pay auto-refund branch so admin-visible notes don't get clobbered.
 */
function appendNote(existing: string | null | undefined, line: string): string {
  if (!existing || existing.trim().length === 0) return line;
  return `${existing}\n${line}`;
}
