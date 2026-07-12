import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { HOLD_TTL_MINUTES } from '../../../../src/lib/booking/availability';
import { sendBookingEmails } from '../../../../src/lib/email/send';
import { getPayload } from '../../../../src/lib/payload';
import { stripe } from '../../../../src/lib/stripe/client';
import { getWebhookSecret } from '../../../../src/lib/stripe/env';
import { STRIPE_EVENT } from '../../../../src/lib/stripe/events';

/**
 * Stripe webhook handler (Sub-etapa C + Batch 3b rental support).
 *
 * Contract:
 *   - Reads the RAW body via `request.text()`. `stripe.webhooks.constructEvent`
 *     hashes the raw bytes; parsing first would mutate whitespace and break
 *     the signature.
 *   - `runtime = 'nodejs'` because constructEvent uses Node's `crypto` module.
 *   - `dynamic = 'force-dynamic'` so Next never caches POSTs here.
 *
 * Response policy:
 *   - 400 ONLY on signature failure or missing signature header.
 *   - 200 for everything else, including unknown event types and logical no-ops.
 *   - 500 only on unexpected exceptions inside an event handler (Stripe retries;
 *     our handlers are idempotent so that's safe).
 *
 * Multi-collection routing (Batch 3b):
 *   - `metadata.kind` selects the target collection: `'rental'` → `rentals`,
 *     anything else (default `'booking'`) → `bookings`. The completed/expired/
 *     failure handlers are collection-agnostic via a small `{ collection, id }`
 *     dispatch, so a single code path serves both domains.
 *
 * Late-payment auto-refund (AC30 — the promised free fix):
 *   - The auto-refund trigger is keyed on the hold ACTUALLY having lapsed
 *     (`holdExpiresAt < paidInstant`), NOT on the swept status label. A row still
 *     labeled `pending` because the sweep has not run yet still refunds when its
 *     hold instant has passed. This shared keying also benefits tour bookings; it
 *     is SCOPED to the refund-trigger condition only (no oversell-posture change,
 *     no transactional guard).
 *   - CRITICAL (C1): `paidInstant` is the STRIPE PAYMENT instant derived from the
 *     event's `created` timestamp (epoch seconds → ms), NOT our handler's wall
 *     clock. A delayed delivery or a retry-after-500 can push our PROCESSING time
 *     past `holdExpiresAt` for a customer who paid ON TIME; keying on `new Date()`
 *     would then wrongly auto-refund + cancel that in-time booking. Threading the
 *     event timestamp makes an in-time payment commit pending → paid even when our
 *     handler runs late, while genuinely-late payments (paid after the hold truly
 *     expired) still refund. Applies to bookings AND rentals via the shared
 *     dispatch.
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
    console.error('[stripe-webhook] handler threw for event', event.id, event.type, err);
    return new NextResponse('Internal error', { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case STRIPE_EVENT.CHECKOUT_SESSION_COMPLETED:
      await onCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        resolvePaymentInstant(event)
      );
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
      console.info('[stripe-webhook] ignoring event type', event.type, event.id);
      return;
  }
}

/**
 * The instant the customer actually paid, taken from the Stripe event's `created`
 * timestamp (epoch seconds → ms). This is the authoritative payment time for the
 * hold-lapsed decision (C1). Falls back to the current wall clock only when the
 * event carries no usable `created` value, so callers always get a valid Date.
 */
function resolvePaymentInstant(event: Stripe.Event): Date {
  const createdSec = event.created;
  if (typeof createdSec === 'number' && Number.isFinite(createdSec) && createdSec > 0) {
    return new Date(createdSec * 1000);
  }
  return new Date();
}

async function onCheckoutCompleted(
  session: Stripe.Checkout.Session,
  paidInstant: Date
): Promise<void> {
  const ref = readEntityRef(session.metadata);
  if (ref === null) {
    console.warn('[stripe-webhook] checkout.session.completed missing entity metadata', {
      sessionId: session.id,
    });
    return;
  }

  const entity = await findEntityById(ref.collection, ref.id);
  if (!entity) {
    console.warn('[stripe-webhook] checkout.session.completed for unknown entity', {
      ...ref,
      sessionId: session.id,
    });
    return;
  }

  // Already-terminal idempotent short-circuits.
  if (entity.status === 'paid' || entity.status === 'refunded') {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Auto-refund trigger, keyed on the hold having ACTUALLY lapsed at the REAL
  // payment instant (`holdExpiresAt < paidInstant`), NOT on our processing time
  // and NOT on the swept status label. `paidInstant` comes from the Stripe event's
  // `created` timestamp (C1), so an in-time payment we happen to process late still
  // commits pending → paid; only a payment completed AFTER the hold truly expired
  // refunds. A row still labeled `pending` whose hold instant has passed also
  // refunds (AC30). Explicit expired/cancelled labels stay covered.
  const holdLapsed =
    entity.holdExpiresAt != null &&
    Number.isFinite(new Date(entity.holdExpiresAt).getTime()) &&
    new Date(entity.holdExpiresAt).getTime() < paidInstant.getTime();

  if (entity.status === 'expired' || entity.status === 'cancelled' || holdLapsed) {
    if (!paymentIntentId) {
      console.error(
        '[stripe-webhook] completed event without payment_intent — cannot auto-refund',
        { ...ref, sessionId: session.id, currentStatus: entity.status }
      );
      return;
    }

    const reference = entity.reference ?? `id-${ref.id}`;
    try {
      await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          reason: 'requested_by_customer',
          metadata: {
            entityId: String(ref.id),
            collection: ref.collection,
            bookingReference: reference,
            autoRefundReason: 'hold-expired-before-payment',
          },
        },
        // Namespace the idempotency key by collection so a booking and a rental
        // that happen to share a reference can never collide (L1).
        { idempotencyKey: `refund-${ref.collection}-${reference}` }
      );
    } catch (refundErr) {
      console.error('[stripe-webhook] auto-refund failed', {
        ...ref,
        paymentIntentId,
        currentStatus: entity.status,
        err: refundErr,
      });
      throw refundErr;
    }

    const payload = await getPayload();
    await payload.update({
      collection: ref.collection,
      id: ref.id,
      overrideAccess: true,
      data: {
        status: 'refunded',
        stripePaymentIntentId: paymentIntentId,
        notes: appendNote(
          entity.notes,
          `Auto-refunded: customer completed Stripe Checkout after the ${HOLD_TTL_MINUTES}-minute hold expired.`
        ),
      },
    });
    return;
  }

  // Happy path: pending → paid.
  const payload = await getPayload();
  await payload.update({
    collection: ref.collection,
    id: ref.id,
    overrideAccess: true,
    data: {
      status: 'paid',
      paidAt: paidInstant.toISOString(),
      stripePaymentIntentId: paymentIntentId,
      holdExpiresAt: null,
    },
  });

  // Confirmation + owner emails fire ONLY for tour bookings on the real
  // pending → paid transition. Rentals have no email step (yet).
  if (ref.collection === 'bookings') {
    try {
      await sendBookingEmails(ref.id);
    } catch (err) {
      console.error('[stripe-webhook] booking email send failed', { bookingId: ref.id, err });
    }
  }
}

async function onCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const ref = readEntityRef(session.metadata);
  if (ref === null) return;

  const entity = await findEntityById(ref.collection, ref.id);
  if (!entity) return;
  if (entity.status !== 'pending') return; // already paid/expired/cancelled

  const payload = await getPayload();
  await payload.update({
    collection: ref.collection,
    id: ref.id,
    overrideAccess: true,
    data: { status: 'expired' },
  });
}

async function onPaymentFailedFromSession(session: Stripe.Checkout.Session): Promise<void> {
  const ref = readEntityRef(session.metadata);
  if (ref === null) return;
  await cancelPendingWithNote(ref, 'Async payment failed');
}

async function onPaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const ref = readEntityRef(pi.metadata);
  if (ref === null) return;
  const reason = pi.last_payment_error?.message ?? 'unknown';
  await cancelPendingWithNote(ref, `Payment failed: ${reason}`);
}

async function cancelPendingWithNote(ref: EntityRef, note: string): Promise<void> {
  const entity = await findEntityById(ref.collection, ref.id);
  if (!entity) return;
  if (entity.status !== 'pending') return;

  const payload = await getPayload();
  await payload.update({
    collection: ref.collection,
    id: ref.id,
    overrideAccess: true,
    data: { status: 'cancelled', notes: note },
  });
}

type EntityRef = { collection: 'bookings' | 'rentals'; id: number };

/**
 * Resolve the target collection + row id from Stripe metadata. `kind === 'rental'`
 * routes to `rentals` (`rentalId`); anything else defaults to `bookings`
 * (`bookingId`) so existing tour events are byte-for-byte unaffected.
 */
function readEntityRef(metadata: Stripe.Metadata | null | undefined): EntityRef | null {
  const kind = metadata?.kind ?? 'booking';
  if (kind === 'rental') {
    const id = parsePositiveInt(metadata?.rentalId);
    return id === null ? null : { collection: 'rentals', id };
  }
  const id = parsePositiveInt(metadata?.bookingId);
  return id === null ? null : { collection: 'bookings', id };
}

function parsePositiveInt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

type EntityForWebhook = {
  id: number;
  status: string;
  reference?: string | null;
  notes?: string | null;
  holdExpiresAt?: string | null;
};

async function findEntityById(
  collection: 'bookings' | 'rentals',
  id: number
): Promise<EntityForWebhook | null> {
  const payload = await getPayload();
  const result = await payload.find({
    collection,
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const docs = (result as { docs?: EntityForWebhook[] }).docs ?? [];
  return docs[0] ?? null;
}

/**
 * Append a new line to an existing notes string without losing earlier history.
 */
function appendNote(existing: string | null | undefined, line: string): string {
  if (!existing || existing.trim().length === 0) return line;
  return `${existing}\n${line}`;
}
