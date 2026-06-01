import { NextResponse } from 'next/server';

import {
  HOLD_TTL_MINUTES,
  getTimeSlotsForTour,
  isDateBeforeTodayInTourTZ,
  isSameDayCutoffPassed,
  isWeekdayAvailable,
} from '../../../../src/lib/booking/availability';
import { countSeatsTaken } from '../../../../src/lib/booking/capacity';
import { checkoutPayloadSchema } from '../../../../src/lib/booking/checkoutPayload';
import { PRIVATIZE_FLAT } from '../../../../src/lib/booking/pricing';
import { generateBookingReference } from '../../../../src/lib/booking/reference';
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
  const tour = await payload
    .findByID({ collection: 'tours', id: data.tourId, depth: 0, overrideAccess: true })
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

  const availableDays = (tour as { availableDays?: ReadonlyArray<string | number> | null })
    .availableDays;
  if (!isWeekdayAvailable(dateAnchor, availableDays ?? [])) {
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

  // 4. Snapshot pricing
  const tourPrice = (tour as { price?: number }).price ?? 0;
  const pricePerPerson = tourPrice;
  const privatizeFee = PRIVATIZE_FLAT;
  const currency = 'USD';
  const { totalPersons, totalAmount } = computeBookingTotals({
    adults: data.adults,
    teens: data.teens,
    pricePerPerson,
    privatize: data.privatize,
    privatizeFee,
  });

  // 5. Create the booking row in pending state
  const holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60_000);
  const reference = generateBookingReference();

  let booking: { id: number; reference?: string };
  try {
    const created = await payload.create({
      collection: 'bookings',
      overrideAccess: true,
      data: {
        reference,
        tour: data.tourId,
        date: dateAnchor.toISOString(),
        time: data.time,
        adults: data.adults,
        teens: data.teens,
        totalPersons,
        privatize: data.privatize,
        pricePerPerson,
        privatizeFee,
        currency,
        totalAmount,
        customer: {
          name: data.customer.name,
          email: data.customer.email,
          whatsapp: data.customer.whatsapp || undefined,
          locale: data.customer.locale,
        },
        status: 'pending',
        holdExpiresAt: holdExpiresAt.toISOString(),
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        paidAt: null,
        notes: null,
      },
    });
    booking = created as { id: number; reference?: string };
  } catch (err) {
    console.error('[checkout] failed to create booking row', err);
    return jsonNoStore({ error: 'booking-create-failed' }, 500);
  }

  // 6. Create the Stripe Checkout Session
  const siteUrl = getSiteUrl(request);
  const productName = `${(tour as { title?: string }).title ?? 'Tour'} — ${data.date} ${data.time}`;
  const productDescription = `${totalPersons} person(s)${data.privatize ? ' · Private departure' : ''}`;
  const tourSlug = (tour as { slug?: string }).slug ?? '';

  let session: { id: string; url: string | null };
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: data.customer.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: Math.round(totalAmount * 100),
              product_data: {
                name: productName,
                description: productDescription,
                metadata: {
                  tourSlug,
                  bookingReference: reference,
                },
              },
            },
          },
        ],
        metadata: {
          bookingId: String(booking.id),
          bookingReference: reference,
          tourId: String(data.tourId),
          tourSlug,
        },
        locale: data.customer.locale === 'es' ? 'es-419' : 'en',
        expires_at: Math.floor(holdExpiresAt.getTime() / 1000),
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
