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
  },
  STRIPE_API_VERSION: '2026-05-27.dahlia',
}));

vi.mock('../../../../src/lib/stripe/env', () => ({
  getWebhookSecret: vi.fn(() => 'whsec_test_dummy'),
}));

vi.mock('../../../../src/lib/payload', () => ({
  getPayload: vi.fn(async () => mockPayload),
}));

const mockPayload: {
  find: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} = {
  find: vi.fn(),
  update: vi.fn(async () => ({ doc: { id: 1 } })),
};

const { stripe } = await import('../../../../src/lib/stripe/client');
const { POST } = await import('./route');

const mockConstructEvent = vi.mocked(stripe.webhooks.constructEvent);

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
  });

  it('checkout.session.completed → status not pending and not paid → 200 warning, no write', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_late',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_late',
          payment_intent: 'pi_test_late',
          metadata: { bookingId: '99' },
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ id: 99, status: 'expired' }],
    });

    const res = await POST(makeReq('{}'));
    expect(res.status).toBe(200);
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
