import type { RequiredDataFromCollectionSlug } from 'payload';
import { NextResponse } from 'next/server';

import {
  type BookableDateTour,
  HOLD_TTL_MINUTES,
  STRIPE_SESSION_TTL_MINUTES,
  getTimeSlotsForTour,
  isDateBeforeTodayInTourTZ,
  isDateBookableForTour,
  isSameDayCutoffPassed,
} from '../../../../src/lib/booking/availability';
import { countSeatsTaken } from '../../../../src/lib/booking/capacity';
import { evaluateBikeSlot } from '../../../../src/lib/booking/fleet';
import { checkoutPayloadSchema } from '../../../../src/lib/booking/checkoutPayload';
import { generateBookingReference } from '../../../../src/lib/booking/reference';
import {
  type ResolvableExtra,
  buildStripeLineItems,
  resolveSelectedExtras,
} from '../../../../src/lib/booking/stripeLineItems';
import { computeBookingTotals } from '../../../../src/lib/booking/totals';
import { getPayload } from '../../../../src/lib/payload';
import { stripe } from '../../../../src/lib/stripe/client';
import { getSiteUrl } from '../../../../src/lib/stripe/env';

/**
 * POST /api/booking/checkout (Sub-etapa C).
 *
 * The wizard's final step calls this. It:
 *   1. Validates the payload (Zod).
 *   2. Loads the tour, refusing drafts.
 *   3. Re-validates availability server-side (NEVER trust the client).
 *   4. Snapshots pricing.
 *   5. Creates the Bookings row in `pending`.
 *   6. Creates a Stripe Checkout Session with `idempotencyKey: booking-<ref>`
 *      so a client retry can't double-create.
 *   7. Persists the Stripe session id back onto the booking row.
 *   8. Returns the Checkout URL so the client can `window.location.assign`.
 *
 * No retry on Stripe failure: we mark the booking `cancelled` with a note
 * and surface 502 so the wizard can prompt the user to try again. Next
 * attempt creates a fresh booking row + idempotency key — clean.
 *
 * Pricing snapshot: `pricePerPerson = tour.price` is charged to every head,
 * adult or teen. `pricing.calculatePrice` (wizard preview) mirrors this — a
 * `pricing.test.ts` parity test asserts both functions return the same total
 * for identical inputs so the wizard preview can never drift from what
 * Stripe actually charges.
 */
export async function POST(request: Request): Promise<Response> {
  // 1. Parse + validate payload
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonNoStore({ error: 'invalid-payload', issues: [] }, 400);
  }
  const parsed = checkoutPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return jsonNoStore({ error: 'invalid-payload', issues: parsed.error.issues }, 400);
  }
  const data = parsed.data;

  // 2. Load tour
  const payload = await getPayload();
  // depth:1 resolves the `extras` relationship so the server can re-resolve
  // each selected extra's authoritative price/name (never trusting the client).
  const tour = await payload
    .findByID({ collection: 'tours', id: data.tourId, depth: 1, overrideAccess: true })
    .catch(() => null);
  if (!tour) return jsonNoStore({ error: 'tour-not-found' }, 404);

  if ((tour as { _status?: string })._status !== 'published') {
    return jsonNoStore({ error: 'tour-not-published' }, 409);
  }

  // 3. Server-side availability re-validation. The wizard already
  // enforces most of this, but the client is not authoritative.
  const now = new Date();
  // We use noon-UTC on the requested calendar day as the anchor — same
  // convention as the availability route: it always lands on the matching
  // CDMX calendar day for any reasonable TZ.
  const dateAnchor = new Date(`${data.date}T12:00:00Z`);

  if (isDateBeforeTodayInTourTZ(dateAnchor, now)) {
    return jsonNoStore({ error: 'past-date' }, 422);
  }

  // Seasonal tours gate by `seasonal.seasonWindow`; standard tours by
  // `availableDays`. `isDateBookableForTour` unifies both. The full tour doc
  // (depth:0 findByID) already carries isSeasonal + seasonal, so no extra read.
  if (!isDateBookableForTour(dateAnchor, tour as BookableDateTour)) {
    return jsonNoStore({ error: 'day-closed' }, 422);
  }

  const slots = getTimeSlotsForTour(tour as Parameters<typeof getTimeSlotsForTour>[0]);
  const slot = slots.find((s) => s.time === data.time);
  if (!slot) return jsonNoStore({ error: 'unknown-slot' }, 422);

  if (isSameDayCutoffPassed(dateAnchor, data.time, now)) {
    return jsonNoStore({ error: 'cutoff-passed' }, 422);
  }

  const requested = data.adults + data.teens;
  if (requested > slot.capacity) {
    return jsonNoStore({ error: 'over-slot-capacity' }, 422);
  }

  const taken = await countSeatsTaken({
    payload,
    tourId: data.tourId,
    date: dateAnchor,
    time: data.time,
    now,
  });
  if (taken + requested > slot.capacity) {
    return jsonNoStore(
      { error: 'no-seats-left', remaining: Math.max(0, slot.capacity - taken) },
      422
    );
  }

  // 3b. Authoritative bike-fleet gate. Non-bike tours are exempt (the shared
  // evaluator returns ok without a DB read). For bike tours it enforces the
  // finite-fleet and recharge-cooldown rules using the SAME evaluator the
  // availability GET route calls, so the advisory the client saw can never
  // drift from what we enforce here. A bike tour missing a positive duration
  // fails safe as `unevaluatable` — never silently allowed.
  const bikeVerdict = await evaluateBikeSlot({
    payload,
    tour: tour as Parameters<typeof evaluateBikeSlot>[0]['tour'],
    date: dateAnchor,
    time: data.time,
    now,
  });
  if (!bikeVerdict.ok) {
    return jsonNoStore({ error: 'bike-unavailable', reason: bikeVerdict.reason }, 422);
  }

  // 4. Snapshot pricing.
  //
  // Re-resolve the selected extras from what the tour ACTUALLY offers — the
  // client only sends extraIds, never prices. `resolveSelectedExtras` looks
  // each id up in the tour's resolved `extras`, drops unknown/inactive ones,
  // and computes each amount against the real pax. Totals are derived from the
  // resolved snapshot so the wizard preview, the persisted row and Stripe all
  // agree (parity guard in pricing.test.ts).
  const tourPrice = (tour as { price?: number }).price ?? 0;
  const pricePerPerson = tourPrice;
  const currency = 'USD';

  const offeredExtras: ResolvableExtra[] = (
    (tour as { extras?: unknown[] }).extras ?? []
  ).filter((e): e is ResolvableExtra => typeof e === 'object' && e !== null && 'id' in e);

  const selectedExtras = resolveSelectedExtras(
    data.selectedExtras,
    offeredExtras,
    data.adults + data.teens
  );

  const { totalPersons, totalAmount } = computeBookingTotals({
    adults: data.adults,
    teens: data.teens,
    pricePerPerson,
    // Map the resolved snapshot (unitPrice) onto the shared pricing contract
    // ({ price, priceType }) so the total uses the SAME math as the wizard.
    selectedExtras: selectedExtras.map((e) => ({ price: e.unitPrice, priceType: e.priceType })),
  });

  // 5. Create the booking row in pending state.
  //
  // Two independent timers (don't conflate them again):
  //   - holdExpiresAt: our business rule. How long we reserve seats for THIS
  //     customer before another customer can grab them. 15 min.
  //   - stripeSessionExpiresAt: Stripe Checkout's own session lifetime. Stripe
  //     enforces a 30-minute MINIMUM (it rejects anything shorter). 30 min.
  //
  // Consequence: a customer can complete Stripe Checkout AFTER our 15-min hold
  // has expired but BEFORE Stripe's 30-min cap. That's a paid booking with no
  // reserved seat. The webhook detects this and auto-refunds — see
  // `onCheckoutCompleted` in app/api/stripe/webhook/route.ts.
  const holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60_000);
  const stripeSessionExpiresAt = new Date(
    now.getTime() + STRIPE_SESSION_TTL_MINUTES * 60_000
  );
  const reference = generateBookingReference();

  // Typed explicitly so Payload's create overload resolves to the non-draft
  // branch (the new `selectedExtras` array otherwise makes inference ambiguous).
  const bookingData: RequiredDataFromCollectionSlug<'bookings'> = {
    reference,
    tour: data.tourId,
    date: dateAnchor.toISOString(),
    time: data.time,
    adults: data.adults,
    teens: data.teens,
    totalPersons,
    pricePerPerson,
    selectedExtras,
    currency,
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

  let booking: { id: number; reference?: string };
  try {
    const created = await payload.create({
      collection: 'bookings',
      overrideAccess: true,
      data: bookingData,
    });
    booking = created as { id: number; reference?: string };
  } catch (err) {
    console.error('[checkout] failed to create booking row', err);
    return jsonNoStore({ error: 'booking-create-failed' }, 500);
  }

  // 6. Create the Stripe Checkout Session
  const siteUrl = getSiteUrl(request);
  const productName = `${(tour as { title?: string }).title ?? 'Tour'} — ${data.date} ${data.time}`;
  const productDescription = `${totalPersons} person(s)`;
  const tourSlug = (tour as { slug?: string }).slug ?? '';

  // One Stripe line per resolved extra + a derived base line. The builder
  // guarantees Σ(line cents) === round(totalAmount × 100) — no 1-cent drift,
  // no privatize line ever emitted.
  const lineItems = buildStripeLineItems({
    baseProductName: productName,
    baseDescription: productDescription,
    currency,
    totalAmount,
    selectedExtras,
    metadata: { tourSlug, bookingReference: reference },
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
          bookingId: String(booking.id),
          bookingReference: reference,
          tourId: String(data.tourId),
          tourSlug,
        },
        locale: data.customer.locale === 'es' ? 'es-419' : 'en',
        // Stripe's expires_at is INDEPENDENT from our seat hold. Stripe rejects
        // anything shorter than 30 minutes, so we use stripeSessionExpiresAt
        // (= now + STRIPE_SESSION_TTL_MINUTES). Late payments (hold expired
        // but Stripe session still alive) are auto-refunded by the webhook —
        // see onCheckoutCompleted in app/api/stripe/webhook/route.ts.
        expires_at: Math.floor(stripeSessionExpiresAt.getTime() / 1000),
        success_url: `${siteUrl}/${data.customer.locale}/book/success?ref=${reference}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/${data.customer.locale}/book/cancelled?ref=${reference}`,
      },
      { idempotencyKey: `booking-${reference}` }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[checkout] Stripe session create failed', err);
    await payload
      .update({
        collection: 'bookings',
        id: booking.id,
        overrideAccess: true,
        data: {
          status: 'cancelled',
          notes: `Stripe session creation failed: ${message}`,
        },
      })
      .catch((dbErr) => {
        console.error('[checkout] failed to cancel booking after Stripe failure', dbErr);
      });
    return jsonNoStore({ error: 'stripe-session-failed' }, 502);
  }

  // 7. Persist the session id back onto the booking
  await payload
    .update({
      collection: 'bookings',
      id: booking.id,
      overrideAccess: true,
      data: { stripeCheckoutSessionId: session.id },
    })
    .catch((err) => {
      console.error('[checkout] failed to persist stripeCheckoutSessionId', err);
    });

  // 8. Return the Checkout URL
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
