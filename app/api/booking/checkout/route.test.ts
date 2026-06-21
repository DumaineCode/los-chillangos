import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Tests for POST /api/booking/checkout.
 *
 * Mocks:
 *   - Payload local API (findByID + create + update)
 *   - Stripe Checkout SDK (`stripe.checkout.sessions.create`)
 *
 * Coverage:
 *   - 400 on payload validation failure
 *   - 404 on tour not found
 *   - 409 on draft tour
 *   - 422 on each availability failure mode
 *   - 502 on Stripe SDK failure (with booking cancellation note)
 *   - 200 happy path returns checkoutUrl + reference
 */

vi.mock('../../../../src/lib/stripe/client', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock('../../../../src/lib/payload', () => ({
  getPayload: vi.fn(async () => mockPayload),
}));

vi.mock('../../../../src/lib/booking/sweep', () => ({
  sweepExpiredHolds: vi.fn(async () => ({ swept: 0 })),
}));

const mockPayload: {
  findByID: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} = {
  findByID: vi.fn(),
  find: vi.fn(async () => ({ docs: [] })),
  create: vi.fn(),
  update: vi.fn(async () => ({ doc: { id: 1 } })),
};

const { stripe } = await import('../../../../src/lib/stripe/client');
const { POST } = await import('./route');
const { HOLD_TTL_MINUTES, STRIPE_SESSION_TTL_MINUTES } = await import(
  '../../../../src/lib/booking/availability'
);

const mockCreateSession = vi.mocked(stripe.checkout.sessions.create);

/**
 * Build a Date "now" that's safely in the future relative to the test data
 * so cutoff checks pass naturally. The date we use is 2030-06-12 (Wednesday CDMX),
 * a tour that runs on Wed (`'3'`), and 09:00 is many hours away.
 */
const FAR_FUTURE_NOW = new Date('2030-06-12T13:00:00Z'); // 07:00 CDMX Wed

function makeTour(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'ebike-classic',
    title: 'E-bike Classic',
    price: 89,
    availableDays: ['1', '2', '3', '4', '5'], // Mon-Fri
    timeSlots: [{ time: '09:00', capacity: 8 }],
    _status: 'published',
    ...overrides,
  };
}

function makeBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tourId: 1,
    date: '2030-06-12',
    time: '09:00',
    adults: 2,
    teens: 0,
    privatize: false,
    customer: {
      name: 'Hana K',
      email: 'hana@example.com',
      whatsapp: '',
      country: 'MX',
      locale: 'en',
    },
    ...overrides,
  });
}

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/booking/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000', ...headers },
    body,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FAR_FUTURE_NOW);
  mockPayload.findByID.mockReset();
  mockPayload.find.mockReset();
  mockPayload.find.mockResolvedValue({ docs: [] });
  mockPayload.create.mockReset();
  mockPayload.update.mockReset();
  mockPayload.update.mockResolvedValue({ doc: { id: 1 } });
  mockCreateSession.mockReset();
});

describe('POST /api/booking/checkout', () => {
  it('returns 400 on invalid payload', async () => {
    const res = await POST(makeRequest('{"bad":"shape"}'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-payload');
  });

  it('returns 404 when tour does not exist', async () => {
    mockPayload.findByID.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(makeBody()));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('tour-not-found');
  });

  it('returns 409 when tour is not published', async () => {
    mockPayload.findByID.mockResolvedValueOnce(makeTour({ _status: 'draft' }));
    const res = await POST(makeRequest(makeBody()));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('tour-not-published');
  });

  it('returns 422 past-date for a date strictly before today CDMX', async () => {
    mockPayload.findByID.mockResolvedValueOnce(makeTour());
    const res = await POST(makeRequest(makeBody({ date: '2020-01-01' })));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('past-date');
  });

  it('returns 422 day-closed when the weekday is not in availableDays', async () => {
    // 2030-06-15 is a Saturday CDMX. Tour only runs Mon-Fri.
    mockPayload.findByID.mockResolvedValueOnce(
      makeTour({ availableDays: ['1', '2', '3', '4', '5'] })
    );
    const res = await POST(makeRequest(makeBody({ date: '2030-06-15' })));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('day-closed');
  });

  it('returns 422 day-closed for a seasonal tour when the date is OUTSIDE the season window', async () => {
    // Seasonal single-date event Aug 14 2026. 2030-06-12 is far outside the
    // window even though the seeded availableDays (['5']) would admit Fridays.
    mockPayload.findByID.mockResolvedValueOnce(
      makeTour({
        isSeasonal: true,
        availableDays: ['1', '2', '3', '4', '5'],
        seasonal: {
          seasonWindow: { start: '2026-08-14T06:00:00.000Z', end: '2026-08-14T06:00:00.000Z' },
        },
      })
    );
    const res = await POST(makeRequest(makeBody({ date: '2030-06-12', time: '09:00' })));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('day-closed');
  });

  it('passes the date check for a seasonal tour when the date is INSIDE the season window', async () => {
    // Set "now" before the event so past-date never fires; book the Aug-14
    // event day at 18:00 (the seeded seasonal slot), many hours from now.
    vi.setSystemTime(new Date('2026-08-01T13:00:00Z'));
    mockPayload.findByID.mockResolvedValueOnce(
      makeTour({
        isSeasonal: true,
        availableDays: ['1', '2', '3', '4', '5'],
        timeSlots: [{ time: '18:00', capacity: 14 }],
        seasonal: {
          seasonWindow: { start: '2026-08-14T06:00:00.000Z', end: '2026-08-14T06:00:00.000Z' },
        },
      })
    );
    mockPayload.find.mockResolvedValueOnce({ docs: [] }); // no seats taken
    mockPayload.create.mockResolvedValueOnce({ id: 55, reference: 'LC-SEASON01' });
    mockCreateSession.mockResolvedValueOnce({
      id: 'cs_test_seasonal',
      url: 'https://checkout.stripe.com/c/pay/cs_test_seasonal',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(makeRequest(makeBody({ date: '2026-08-14', time: '18:00' })));
    // The date passed the day-closed gate; the flow reached Stripe and returned 200.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checkoutUrl: string };
    expect(body.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_seasonal');
  });

  it('returns 422 unknown-slot when the time is not in tour timeSlots', async () => {
    mockPayload.findByID.mockResolvedValueOnce(makeTour());
    const res = await POST(makeRequest(makeBody({ time: '23:00' })));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('unknown-slot');
  });

  it('returns 422 cutoff-passed when within same-day cutoff window', async () => {
    // Set "now" to today 08:00 CDMX (14:00Z) and book 09:00 same day (< 2h away)
    vi.setSystemTime(new Date('2030-06-12T14:00:00Z'));
    mockPayload.findByID.mockResolvedValueOnce(makeTour());
    const res = await POST(makeRequest(makeBody({ date: '2030-06-12', time: '09:00' })));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('cutoff-passed');
  });

  it('returns 422 over-slot-capacity when adults+teens > slot.capacity', async () => {
    mockPayload.findByID.mockResolvedValueOnce(makeTour());
    const res = await POST(makeRequest(makeBody({ adults: 10, teens: 0 })));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('over-slot-capacity');
  });

  it('returns 422 no-seats-left when seats already taken pushes us over capacity', async () => {
    mockPayload.findByID.mockResolvedValueOnce(makeTour());
    // 7 seats taken, capacity 8, requesting 2 more → no room
    mockPayload.find.mockResolvedValueOnce({ docs: [{ totalPersons: 7 }] });
    const res = await POST(makeRequest(makeBody({ adults: 2 })));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; remaining: number };
    expect(body.error).toBe('no-seats-left');
    expect(body.remaining).toBe(1);
  });

  it('happy path: creates booking, creates Stripe session, returns checkoutUrl + reference', async () => {
    mockPayload.findByID.mockResolvedValueOnce(makeTour());
    mockPayload.find.mockResolvedValueOnce({ docs: [] }); // no seats taken
    mockPayload.create.mockResolvedValueOnce({
      id: 99,
      reference: 'LC-DEADBEEF',
    });
    mockCreateSession.mockResolvedValueOnce({
      id: 'cs_test_session_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_session_1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(makeRequest(makeBody()));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const body = (await res.json()) as { checkoutUrl: string; reference: string };
    expect(body.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_session_1');
    expect(body.reference).toMatch(/^LC-[A-F0-9]{8}$/);

    // Booking was created in pending state
    expect(mockPayload.create).toHaveBeenCalledTimes(1);
    const createCall = mockPayload.create.mock.calls[0]?.[0] as {
      collection: string;
      data: Record<string, unknown>;
    };
    expect(createCall.collection).toBe('bookings');
    expect(createCall.data.status).toBe('pending');
    expect(createCall.data.tour).toBe(1);
    expect(createCall.data.adults).toBe(2);
    expect(createCall.data.pricePerPerson).toBe(89);
    expect(createCall.data.currency).toBe('USD');

    // Stripe session created with idempotency key + correct line item
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    const stripeArgs = mockCreateSession.mock.calls[0];
    const sessionParams = stripeArgs?.[0] as {
      mode: string;
      customer_email: string;
      metadata: Record<string, string>;
      line_items: Array<{ price_data: { unit_amount: number; currency: string } }>;
      expires_at: number;
    };
    const stripeOptions = stripeArgs?.[1] as { idempotencyKey: string };
    expect(sessionParams.mode).toBe('payment');
    expect(sessionParams.customer_email).toBe('hana@example.com');
    expect(sessionParams.line_items[0]?.price_data.unit_amount).toBe(2 * 89 * 100);
    expect(sessionParams.line_items[0]?.price_data.currency).toBe('usd');
    expect(stripeOptions?.idempotencyKey).toMatch(/^booking-LC-/);

    // expires_at is set to STRIPE_SESSION_TTL_MINUTES from "now", NOT
    // HOLD_TTL_MINUTES — Stripe rejects < 30 minutes. The two timers are
    // decoupled on purpose (see route.ts comment + webhook auto-refund).
    const expectedExpiresAt = Math.floor(
      (FAR_FUTURE_NOW.getTime() + STRIPE_SESSION_TTL_MINUTES * 60_000) / 1000
    );
    expect(sessionParams.expires_at).toBe(expectedExpiresAt);

    // Booking was updated with the session id
    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const updateCall = mockPayload.update.mock.calls[0]?.[0] as {
      data: { stripeCheckoutSessionId: string };
    };
    expect(updateCall.data.stripeCheckoutSessionId).toBe('cs_test_session_1');
  });

  it('persists holdExpiresAt at now + HOLD_TTL_MINUTES (decoupled from Stripe session expiry)', async () => {
    mockPayload.findByID.mockResolvedValueOnce(makeTour());
    mockPayload.find.mockResolvedValueOnce({ docs: [] });
    mockPayload.create.mockResolvedValueOnce({ id: 77, reference: 'LC-HOLDTEST' });
    mockCreateSession.mockResolvedValueOnce({
      id: 'cs_test_hold',
      url: 'https://checkout.stripe.com/c/pay/cs_test_hold',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(makeRequest(makeBody()));
    expect(res.status).toBe(200);

    const createCall = mockPayload.create.mock.calls[0]?.[0] as {
      data: { holdExpiresAt: string };
    };
    const expectedHold = new Date(
      FAR_FUTURE_NOW.getTime() + HOLD_TTL_MINUTES * 60_000
    ).toISOString();
    expect(createCall.data.holdExpiresAt).toBe(expectedHold);

    // Sanity: Stripe expiry > hold expiry (otherwise the fix is broken).
    const stripeArgs = mockCreateSession.mock.calls[0];
    const sessionParams = stripeArgs?.[0] as { expires_at: number };
    const holdSeconds = Math.floor(new Date(expectedHold).getTime() / 1000);
    expect(sessionParams.expires_at).toBeGreaterThan(holdSeconds);
  });

  it('returns 502 + cancels the booking when Stripe SDK throws', async () => {
    mockPayload.findByID.mockResolvedValueOnce(makeTour());
    mockPayload.find.mockResolvedValueOnce({ docs: [] });
    mockPayload.create.mockResolvedValueOnce({ id: 100, reference: 'LC-FAILFAIL' });
    mockCreateSession.mockRejectedValueOnce(new Error('Stripe API down'));

    const res = await POST(makeRequest(makeBody()));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('stripe-session-failed');

    // We marked the booking cancelled with a note
    expect(mockPayload.update).toHaveBeenCalledTimes(1);
    const updateCall = mockPayload.update.mock.calls[0]?.[0] as {
      data: { status: string; notes: string };
    };
    expect(updateCall.data.status).toBe('cancelled');
    expect(updateCall.data.notes).toMatch(/Stripe API down/);
  });
});
