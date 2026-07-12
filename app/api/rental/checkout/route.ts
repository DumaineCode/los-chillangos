import type { RequiredDataFromCollectionSlug } from 'payload';
import { NextResponse } from 'next/server';

import {
  HOLD_TTL_MINUTES,
  STRIPE_SESSION_TTL_MINUTES,
} from '../../../../src/lib/booking/availability';
import { getRentalDayState } from '../../../../src/lib/booking/rentalDayState';
import { evaluateRental } from '../../../../src/lib/booking/rentalEvaluator';
import { rentalCheckoutPayloadSchema } from '../../../../src/lib/booking/rentalCheckoutPayload';
import { buildRentalLineItems } from '../../../../src/lib/booking/rentalStripeLineItems';
import { generateBookingReference } from '../../../../src/lib/booking/reference';
import { BOOKING_CURRENCY } from '../../../../src/lib/booking/currency';
import { getPayload } from '../../../../src/lib/payload';
import { stripe } from '../../../../src/lib/stripe/client';
import { getSiteUrl } from '../../../../src/lib/stripe/env';

/**
 * POST /api/rental/checkout (Batch 3b / PR3).
 *
 * Standalone bike-rental checkout. Mirrors the tour-booking checkout as a
 * read-then-create flow with NO transaction — it inherits the same minimal
 * simultaneous-checkout TOCTOU window tours already have (client-accepted
 * limitation, obs 133). We do NOT add a transactional guard and do NOT modify
 * the tour flow. The three-pillar oversell posture applies: conservative
 * live-pending counting + this authoritative re-validation + the webhook
 * late-payment auto-refund.
 *
 * Steps:
 *   1. Validate the payload (Zod).
 *   2. Load the day-state (1 findGlobal + 3 finds via getRentalDayState).
 *   3. Resolve the tier by durationMinutes (server-side price — NEVER trust the
 *      client) → 422 if none.
 *   4. AUTHORITATIVE evaluateRental re-validation → 422 on any invalid verdict
 *      (AC26). No pending row is created on rejection.
 *   5. Create the pending rental with holdExpiresAt = now + HOLD_TTL_MINUTES
 *      (AC5), passing `context.trustedRentalCreate` so the B1 anonymous-create
 *      gate does not null the hold / force status.
 *   6. Create the Stripe Checkout Session (kind=rental metadata, idempotency
 *      key `rental-<ref>`).
 *   7. Persist the session id; return { checkoutUrl, reference }.
 *   8. On Stripe failure: mark the rental cancelled and return 502.
 */
export async function POST(request: Request): Promise<Response> {
  // 1. Parse + validate payload.
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonNoStore({ error: 'invalid-payload', issues: [] }, 400);
  }
  const parsed = rentalCheckoutPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return jsonNoStore({ error: 'invalid-payload', issues: parsed.error.issues }, 400);
  }
  const data = parsed.data;

  const now = new Date();
  // Noon-UTC anchor lands on the requested CDMX calendar day for any server TZ.
  const anchor = new Date(`${data.date}T12:00:00Z`);

  // 2. Load the day's committed fleet picture + policy.
  const payload = await getPayload();
  const { day, cfg, tiers } = await getRentalDayState({ payload, date: anchor, now });

  // 3. Resolve the tier server-side. The client's durationMinutes only SELECTS a
  // tier; the price is authoritative from settings (never trusted from client).
  const tier = tiers.find((t) => t.durationMinutes === data.durationMinutes);
  if (!tier) {
    return jsonNoStore({ error: 'unknown-tier' }, 422);
  }
  const unitPrice = tier.price;

  // 4. Authoritative re-validation — catches stale advisory availability, esp.
  // `fleet`. Rejection creates NO pending row (AC26).
  const verdict = evaluateRental(
    { date: anchor, startTime: data.startTime, durationMinutes: data.durationMinutes, quantity: data.quantity },
    day,
    cfg,
    now
  );
  if (!verdict.valid) {
    return jsonNoStore({ error: 'rental-unavailable', reason: verdict.reason }, 422);
  }

  // 5. Create the pending rental hold.
  const totalAmount = data.quantity * unitPrice;
  const reference = generateBookingReference();
  const holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60_000);
  const stripeSessionExpiresAt = new Date(now.getTime() + STRIPE_SESSION_TTL_MINUTES * 60_000);

  const rentalData: RequiredDataFromCollectionSlug<'rentals'> = {
    reference,
    date: anchor.toISOString(),
    startTime: data.startTime,
    durationMinutes: data.durationMinutes,
    unitPrice,
    quantity: data.quantity,
    currency: BOOKING_CURRENCY,
    totalAmount,
    customer: {
      name: data.customer.name,
      email: data.customer.email,
      whatsapp: data.customer.whatsapp || undefined,
      country: data.customer.country,
      locale: data.customer.locale,
    },
    status: 'pending',
    holdExpiresAt: holdExpiresAt.toISOString(),
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    paidAt: null,
    notes: null,
  };

  let rental: { id: number; reference?: string };
  try {
    const created = await payload.create({
      collection: 'rentals',
      overrideAccess: true,
      // MANDATORY: the B1 anonymous-create gate nulls holdExpiresAt / forces
      // status unless this trusted-server flag is present. It is NEVER exposed to
      // public request bodies.
      context: { trustedRentalCreate: true },
      data: rentalData,
    });
    rental = created as { id: number; reference?: string };
  } catch (err) {
    console.error('[rental-checkout] failed to create rental row', err);
    return jsonNoStore({ error: 'rental-create-failed' }, 500);
  }

  // 6. Create the Stripe Checkout Session.
  const siteUrl = getSiteUrl(request);
  const lineItems = buildRentalLineItems({
    currency: BOOKING_CURRENCY,
    unitPrice,
    quantity: data.quantity,
    totalAmount,
    reference,
    durationMinutes: data.durationMinutes,
  });

  let session: { id: string; url: string | null };
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: data.customer.email,
        line_items: lineItems,
        metadata: {
          kind: 'rental',
          rentalId: String(rental.id),
          rentalReference: reference,
        },
        locale: data.customer.locale === 'es' ? 'es-419' : 'en',
        expires_at: Math.floor(stripeSessionExpiresAt.getTime() / 1000),
        success_url: `${siteUrl}/${data.customer.locale}/rent/success?ref=${reference}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/${data.customer.locale}/rent/cancel?ref=${reference}`,
      },
      { idempotencyKey: `rental-${reference}` }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[rental-checkout] Stripe session create failed', err);
    await payload
      .update({
        collection: 'rentals',
        id: rental.id,
        overrideAccess: true,
        data: {
          status: 'cancelled',
          notes: `Stripe session creation failed: ${message}`,
        },
      })
      .catch((dbErr) => {
        console.error('[rental-checkout] failed to cancel rental after Stripe failure', dbErr);
      });
    return jsonNoStore({ error: 'stripe-session-failed' }, 502);
  }

  // 7. Persist the session id back onto the rental.
  await payload
    .update({
      collection: 'rentals',
      id: rental.id,
      overrideAccess: true,
      data: { stripeCheckoutSessionId: session.id },
    })
    .catch((err) => {
      console.error('[rental-checkout] failed to persist stripeCheckoutSessionId', err);
    });

  // 8. Return the Checkout URL.
  if (!session.url) {
    return jsonNoStore({ error: 'stripe-session-no-url' }, 502);
  }
  return jsonNoStore({ checkoutUrl: session.url, reference }, 200);
}

function jsonNoStore(body: unknown, status: number): Response {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
