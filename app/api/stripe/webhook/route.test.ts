import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Stripe webhook route tests.
 *
 * Strategy: mock the Stripe SDK and Payload at module level so the route
 * handler runs in isolation. We exercise:
 *   - signature verification failures (must be 400, never 200 — Stripe
 *     would otherwise stop retrying a legit-but-misdelivered event).
 *   - `checkout.session.completed` happy path (pending → paid).
 *   - idempotent redelivery (already paid → 200 no-op, no second write).
 *   - `checkout.session.expired` (pending → expired).
 *   - `payment_intent.payment_failed` (pending → cancelled).
 *   - unknown event types (200 no-op so Stripe stops retrying).
 *
 * The idempotency tests are the most important: a double-confirm is the
 * most expensive class of bug here (double-charged customers).
 */

vi.mock('../../../../src/lib/stripe/client', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    refunds: {
      create: vi.fn(async () => ({ id: 're_test_dummy' })),
    },
  },
  STRIPE_API_VERSION: '2026-05-27.dahlia',
}));

vi.mock('../../../../src/lib/stripe/env', () => ({
  getWebhookSecret: vi.fn(() => 'whsec_test_dummy'),
}));

vi.mock('../../../../src/lib/payload', () => ({
  getPayload: vi.fn(async () => mockPayload),
}));

vi.mock('../../../../src/lib/email/send', () => ({
  sendBookingEmails: vi.fn(async () => undefined),
}));

const mockPayload: {
  find: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} = {
  find: vi.fn(),
  update: vi.fn(async () => ({ doc: { id: 1 } })),
};

const { stripe } = await import('../../../../src/lib/stripe/client');
const { sendBookingEmails } = await import('../../../../src/lib/email/send');
const { POST } = await import('./route');

const mockConstructEvent = vi.mocked(stripe.webhooks.constructEvent);
const mockCreateRefund = vi.mocked(stripe.refunds.create);
const mockSendEmails = vi.mocked(sendBookingEmails);

function makeReq(body: string, sig: string | null = 't=1,v1=fake'): Request {
  const headers = new Headers();
  if (sig !== null) headers.set('stripe-signature', sig);
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPayload.find.mockReset();
  mockPayload.update.mockReset();
  mockPayload.update.mockResolvedValue({ doc: { id: 1 } });
  mockCreateRefund.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreateRefund.mockResolvedValue({ id: 're_test_dummy' } as any);
  mockSendEmails.mockReset();
  mockSendEmails.mockResolvedValue(undefined);
});

describe('POST /api/stripe/webhook', () => {
  it('returns 400 when the signature is missing', async () => {
    const res = await POST(makeReq('{}', null));
    expect(res.status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when constructEvent throws (bad signature)', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('Webhook signature verification failed');
    });
    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(400);
  });

  it('checkout.session.completed → flips pending booking to paid', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_intent: 'pi_test_1',
          metadata: { bookingId: '42', bookingReference: 'LC-ABCDEFGH' },
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 42, status: 'pending' }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const call = mockPayload.update.mock.calls[0]?.[0] as {
      collection: string;
      id: number;
      data: Record<string, unknown>;
    };
    expect(call.collection).toBe('bookings');
    expect(call.id).toBe(42);
    expect(call.data.status).toBe('paid');
    expect(call.data.stripePaymentIntentId).toBe('pi_test_1');
    expect(call.data.holdExpiresAt).toBeNull();
    // paidAt is serialized as ISO string (Payload's date field expects strings)
    expect(call.data.paidAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Confirmation + owner emails fire exactly on the pending → paid transition.
    expect(mockSendEmails).toHaveBeenCalledTimes(1);
    expect(mockSendEmails).toHaveBeenCalledWith(42);
  });

  it('checkout.session.completed → idempotent: already paid → no second write', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_dup',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_intent: 'pi_test_1',
          metadata: { bookingId: '42' },
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 42, status: 'paid' }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockPayload.update).not.toHaveBeenCalled();
    // No re-send on idempotent redelivery of an already-paid booking.
    expect(mockSendEmails).not.toHaveBeenCalled();
  });

  it('checkout.session.completed → booking expired (hold lapsed) → auto-refunds and marks refunded', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_late_expired',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_late',
          payment_intent: 'pi_test_late',
          metadata: { bookingId: '99', bookingReference: 'LC-LATE0001' },
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [
        {
          id: 99,
          status: 'expired',
          reference: 'LC-LATE0001',
          notes: null,
        },
      ],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);

    // Refund issued with idempotency key derived from the booking reference
    expect(mockCreateRefund).toHaveBeenCalledTimes(1);
    const refundArgs = mockCreateRefund.mock.calls[0];
    const refundParams = refundArgs?.[0] as {
      payment_intent: string;
      reason: string;
      metadata: Record<string, string>;
    };
    const refundOptions = refundArgs?.[1] as { idempotencyKey: string };
    expect(refundParams.payment_intent).toBe('pi_test_late');
    expect(refundParams.reason).toBe('requested_by_customer');
    expect(refundParams.metadata.bookingReference).toBe('LC-LATE0001');
    expect(refundParams.metadata.autoRefundReason).toBe('hold-expired-before-payment');
    // Idempotency key is collection-namespaced so a booking and a rental that
    // share a reference can never collide (L1).
    expect(refundOptions.idempotencyKey).toBe('refund-bookings-LC-LATE0001');

    // Booking flipped to refunded with the PI captured for traceability
    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const updateCall = mockPayload.update.mock.calls[0]?.[0] as {
      collection: string;
      id: number;
      data: Record<string, unknown>;
    };
    expect(updateCall.collection).toBe('bookings');
    expect(updateCall.id).toBe(99);
    expect(updateCall.data.status).toBe('refunded');
    expect(updateCall.data.stripePaymentIntentId).toBe('pi_test_late');
    expect(String(updateCall.data.notes)).toMatch(/Auto-refunded/);
    // Auto-refunded late payment must NOT trigger a confirmation email.
    expect(mockSendEmails).not.toHaveBeenCalled();
  });

  it('checkout.session.completed → booking cancelled (Stripe-create failure path) → auto-refunds', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_late_cancelled',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_late_c',
          payment_intent: 'pi_test_late_c',
          metadata: { bookingId: '101', bookingReference: 'LC-LATE0002' },
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [
        {
          id: 101,
          status: 'cancelled',
          reference: 'LC-LATE0002',
          notes: 'Earlier admin note',
        },
      ],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);

    expect(mockCreateRefund).toHaveBeenCalledTimes(1);
    const refundArgs = mockCreateRefund.mock.calls[0];
    const refundOptions = refundArgs?.[1] as { idempotencyKey: string };
    expect(refundOptions.idempotencyKey).toBe('refund-bookings-LC-LATE0002');

    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const updateCall = mockPayload.update.mock.calls[0]?.[0] as {
      data: { status: string; notes: string };
    };
    expect(updateCall.data.status).toBe('refunded');
    // Earlier note is preserved (appendNote) — we don't blow away history.
    expect(updateCall.data.notes).toMatch(/Earlier admin note/);
    expect(updateCall.data.notes).toMatch(/Auto-refunded/);
  });

  it('checkout.session.completed → booking already refunded → idempotent no-op, no second refund', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_dup_refund',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_dup_r',
          payment_intent: 'pi_test_dup_r',
          metadata: { bookingId: '202', bookingReference: 'LC-LATE0003' },
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 202, status: 'refunded', reference: 'LC-LATE0003' }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockCreateRefund).not.toHaveBeenCalled();
    expect(mockPayload.update).not.toHaveBeenCalled();
  });

  it('checkout.session.completed → missing bookingId metadata → 200 no-op', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_meta_missing',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_nometa', metadata: {} } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockPayload.find).not.toHaveBeenCalled();
    expect(mockPayload.update).not.toHaveBeenCalled();
  });

  it('checkout.session.expired → flips pending booking to expired', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_exp',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_exp', metadata: { bookingId: '7' } } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 7, status: 'pending' }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const call = mockPayload.update.mock.calls[0]?.[0] as { data: { status: string } };
    expect(call.data.status).toBe('expired');
  });

  it('checkout.session.expired → already expired → no write', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_exp2',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_exp2', metadata: { bookingId: '7' } } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 7, status: 'expired' }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockPayload.update).not.toHaveBeenCalled();
  });

  it('payment_intent.payment_failed → flips pending booking to cancelled with note', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_fail',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_fail',
          metadata: { bookingId: '11' },
          last_payment_error: { message: 'Card declined' },
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 11, status: 'pending' }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const call = mockPayload.update.mock.calls[0]?.[0] as {
      data: { status: string; notes: string };
    };
    expect(call.data.status).toBe('cancelled');
    expect(call.data.notes).toMatch(/Card declined/);
  });

  it('checkout.session.async_payment_failed → flips pending to cancelled', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_async_fail',
      type: 'checkout.session.async_payment_failed',
      data: {
        object: {
          id: 'cs_async_fail',
          metadata: { bookingId: '13' },
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 13, status: 'pending' }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    const call = mockPayload.update.mock.calls[0]?.[0] as { data: { status: string } };
    expect(call.data.status).toBe('cancelled');
  });

  it('BOOKING checkout.session.completed → still-pending but hold LAPSED → shared auto-refund keying (free fix; NOT a commit)', async () => {
    // TRIANGULATION: the shared refund trigger is keyed on holdExpiresAt <= paidInstant,
    // so a tour booking still labeled `pending` (sweep not run) whose hold instant has
    // passed also refunds. This is the promised free fix that benefits tours, scoped to
    // the refund-trigger condition only.
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_booking_late_pending',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_booking_late',
          payment_intent: 'pi_booking_late',
          metadata: { bookingId: '77', bookingReference: 'LC-LATEPEND' },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 77, status: 'pending', reference: 'LC-LATEPEND', holdExpiresAt: '2000-01-01T00:00:00.000Z', notes: null }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockCreateRefund).toHaveBeenCalledTimes(1);
    const updateCall = mockPayload.update.mock.calls[0]?.[0] as { collection: string; data: { status: string } };
    expect(updateCall.collection).toBe('bookings');
    expect(updateCall.data.status).toBe('refunded');
    // No confirmation email on an auto-refunded late payment.
    expect(mockSendEmails).not.toHaveBeenCalled();
  });

  it('BOOKING checkout.session.completed → pending with FUTURE hold → commits to paid (keying is scoped, no over-refund)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_booking_inhold',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_booking_inhold',
          payment_intent: 'pi_booking_inhold',
          metadata: { bookingId: '78', bookingReference: 'LC-INHOLD01' },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 78, status: 'pending', reference: 'LC-INHOLD01', holdExpiresAt: '2999-01-01T00:00:00.000Z', notes: null }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockCreateRefund).not.toHaveBeenCalled();
    const call = mockPayload.update.mock.calls[0]?.[0] as { data: { status: string } };
    expect(call.data.status).toBe('paid');
    expect(mockSendEmails).toHaveBeenCalledTimes(1);
  });

  it('RENTAL checkout.session.completed → in-hold pending rental → pending → paid, no email (AC30 normal path)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_rental_paid',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_rental_ok',
          payment_intent: 'pi_rental_ok',
          metadata: { kind: 'rental', rentalId: '5', rentalReference: 'LC-RENT0005' },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // Hold is still live (far future) → commit, do NOT refund.
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 5, status: 'pending', reference: 'LC-RENT0005', holdExpiresAt: '2999-01-01T00:00:00.000Z', notes: null }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockCreateRefund).not.toHaveBeenCalled();
    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const call = mockPayload.update.mock.calls[0]?.[0] as {
      collection: string;
      id: number;
      data: Record<string, unknown>;
    };
    expect(call.collection).toBe('rentals');
    expect(call.id).toBe(5);
    expect(call.data.status).toBe('paid');
    expect(call.data.stripePaymentIntentId).toBe('pi_rental_ok');
    expect(call.data.holdExpiresAt).toBeNull();
    // Rentals have no email step.
    expect(mockSendEmails).not.toHaveBeenCalled();
  });

  it('RENTAL checkout.session.completed → LAPSED hold (holdExpiresAt <= paidInstant) → auto-refund, NOT a plain commit (AC30)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_rental_late',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_rental_late',
          payment_intent: 'pi_rental_late',
          metadata: { kind: 'rental', rentalId: '9', rentalReference: 'LC-RENT0009' },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // Row is STILL labeled pending (sweep has not run) but the hold instant has
    // long passed → must take the auto-refund path keyed on holdExpiresAt, NOT
    // the swept status label.
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 9, status: 'pending', reference: 'LC-RENT0009', holdExpiresAt: '2000-01-01T00:00:00.000Z', notes: null }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);

    expect(mockCreateRefund).toHaveBeenCalledTimes(1);
    const refundArgs = mockCreateRefund.mock.calls[0];
    const refundParams = refundArgs?.[0] as { payment_intent: string };
    const refundOptions = refundArgs?.[1] as { idempotencyKey: string };
    expect(refundParams.payment_intent).toBe('pi_rental_late');
    expect(refundOptions.idempotencyKey).toBe('refund-rentals-LC-RENT0009');

    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const updateCall = mockPayload.update.mock.calls[0]?.[0] as {
      collection: string;
      id: number;
      data: Record<string, unknown>;
    };
    expect(updateCall.collection).toBe('rentals');
    expect(updateCall.id).toBe(9);
    expect(updateCall.data.status).toBe('refunded');
    // NOT a plain pending→paid commit.
    expect(updateCall.data.status).not.toBe('paid');
    expect(mockSendEmails).not.toHaveBeenCalled();
  });

  it('RENTAL checkout.session.expired → flips pending rental to expired', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_rental_exp',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_rental_exp', metadata: { kind: 'rental', rentalId: '12' } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({ docs: [{ id: 12, status: 'pending' }] });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    const call = mockPayload.update.mock.calls[0]?.[0] as { collection: string; data: { status: string } };
    expect(call.collection).toBe('rentals');
    expect(call.data.status).toBe('expired');
  });

  // ---------------------------------------------------------------------------
  // C1 regression fix — the auto-refund trigger must key on the STRIPE PAYMENT
  // instant (event.created), NOT our handler's `new Date()` processing time. A
  // delayed delivery or a retry-after-500 can push processing past holdExpiresAt
  // for a customer who paid ON TIME; that must still commit pending → paid.
  // ---------------------------------------------------------------------------

  it('BOOKING completed → paid IN-HOLD but handler runs AFTER holdExpiresAt → commits to paid via the Stripe event timestamp, NOT new Date() (C1)', async () => {
    const nowMs = Date.now();
    const paymentCompletedSec = Math.floor((nowMs - 10 * 60 * 1000) / 1000); // paid 10 min ago
    // Hold lapsed 5s ago in wall-clock (our slow processing), but the payment
    // instant is well BEFORE it → the customer paid on time.
    const holdExpiresAt = new Date(nowMs - 5 * 1000).toISOString();
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_booking_timely_late_proc',
      type: 'checkout.session.completed',
      created: paymentCompletedSec,
      data: {
        object: {
          id: 'cs_b_timely',
          payment_intent: 'pi_b_timely',
          metadata: { bookingId: '55', bookingReference: 'LC-TIMELY01' },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 55, status: 'pending', reference: 'LC-TIMELY01', holdExpiresAt, notes: null }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockCreateRefund).not.toHaveBeenCalled();
    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const call = mockPayload.update.mock.calls[0]?.[0] as { data: { status: string } };
    expect(call.data.status).toBe('paid');
    expect(mockSendEmails).toHaveBeenCalledTimes(1);
  });

  it('RENTAL completed → paid IN-HOLD but handler runs AFTER holdExpiresAt → commits to paid via the event timestamp (C1)', async () => {
    const nowMs = Date.now();
    const paymentCompletedSec = Math.floor((nowMs - 8 * 60 * 1000) / 1000);
    const holdExpiresAt = new Date(nowMs - 3 * 1000).toISOString();
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_rental_timely_late',
      type: 'checkout.session.completed',
      created: paymentCompletedSec,
      data: {
        object: {
          id: 'cs_r_timely',
          payment_intent: 'pi_r_timely',
          metadata: { kind: 'rental', rentalId: '61', rentalReference: 'LC-RTIMELY1' },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 61, status: 'pending', reference: 'LC-RTIMELY1', holdExpiresAt, notes: null }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockCreateRefund).not.toHaveBeenCalled();
    const call = mockPayload.update.mock.calls[0]?.[0] as { collection: string; data: { status: string } };
    expect(call.collection).toBe('rentals');
    expect(call.data.status).toBe('paid');
    expect(mockSendEmails).not.toHaveBeenCalled();
  });

  it('completed → in-hold payment, first update THROWS (500), redelivery after holdExpiresAt still commits to paid via the event timestamp (C1 retry-after-failure)', async () => {
    const nowMs = Date.now();
    const paymentCompletedSec = Math.floor((nowMs - 12 * 60 * 1000) / 1000);
    const holdExpiresAt = new Date(nowMs - 4 * 1000).toISOString();
    const event = {
      id: 'evt_retry',
      type: 'checkout.session.completed',
      created: paymentCompletedSec,
      data: {
        object: {
          id: 'cs_retry',
          payment_intent: 'pi_retry',
          metadata: { bookingId: '63', bookingReference: 'LC-RETRY001' },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const row = {
      docs: [{ id: 63, status: 'pending', reference: 'LC-RETRY001', holdExpiresAt, notes: null }],
    };

    // First delivery: the write fails transiently → 500 (Stripe will retry).
    mockConstructEvent.mockReturnValueOnce(event);
    mockPayload.find.mockResolvedValueOnce(row);
    mockPayload.update.mockRejectedValueOnce(new Error('transient db error'));
    const first = await POST(makeReq('{}'));
    expect(first.status).toBe(500);
    expect(mockCreateRefund).not.toHaveBeenCalled();

    // Redelivery (retry): same event.created, processed even later → still paid.
    mockConstructEvent.mockReturnValueOnce(event);
    mockPayload.find.mockResolvedValueOnce(row);
    const second = await POST(makeReq('{}'));
    expect(second.status).toBe(200);
    expect(mockCreateRefund).not.toHaveBeenCalled();
    const call = mockPayload.update.mock.calls.at(-1)?.[0] as { data: { status: string } };
    expect(call.data.status).toBe('paid');
  });

  it('completed → payment completed AFTER holdExpiresAt (genuinely late) → still auto-refunds, keyed on the event timestamp (C1 keeps the late-refund path)', async () => {
    const nowMs = Date.now();
    const holdExpiresAt = new Date(nowMs - 20 * 60 * 1000).toISOString(); // hold ended 20 min ago
    const paymentCompletedSec = Math.floor((nowMs - 5 * 60 * 1000) / 1000); // paid 5 min ago → AFTER hold
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_genuine_late',
      type: 'checkout.session.completed',
      created: paymentCompletedSec,
      data: {
        object: {
          id: 'cs_glate',
          payment_intent: 'pi_glate',
          metadata: { bookingId: '71', bookingReference: 'LC-GLATE001' },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 71, status: 'pending', reference: 'LC-GLATE001', holdExpiresAt, notes: null }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockCreateRefund).toHaveBeenCalledTimes(1);
    const call = mockPayload.update.mock.calls[0]?.[0] as { data: { status: string } };
    expect(call.data.status).toBe('refunded');
  });

  it('unknown event type → 200 no-op (so Stripe stops retrying)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_unknown',
      type: 'invoice.created',
      data: { object: {} },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
    expect(mockPayload.update).not.toHaveBeenCalled();
  });
});
