import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for POST /api/rental/checkout (Batch 3b, PR3).
 *
 * Mirrors the tour-checkout tests: mock Stripe + Payload, pin the clock so the
 * §5 cutoff is deterministic. The route runs `getRentalDayState` against the
 * mocked payload (findGlobal + 3 finds) then the authoritative `evaluateRental`.
 *
 * Coverage:
 *   - 400 on payload validation failure
 *   - 422 on unknown tier (durationMinutes with no matching rentalTier)
 *   - 422 rental-unavailable when the fleet is consumed (AC26 — NO pending row created)
 *   - happy path: pending rental created with holdExpiresAt = now + 15 min (AC5),
 *     trustedRentalCreate context, MXN currency, server-resolved unitPrice; Stripe
 *     session created with kind=rental metadata + idempotency key; 200 returns
 *     checkoutUrl + reference
 *   - 502 + rental cancelled on Stripe failure
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

const SETTINGS = {
  totalBikes: 8,
  bufferMinutes: 120,
  openTime: '09:00',
  closeTime: '19:00',
  rentalGranularityMinutes: 30,
  rentalTiers: [
    { durationMinutes: 60, price: 200 },
    { durationMinutes: 120, price: 300 },
    { durationMinutes: 240, price: 450 },
    { durationMinutes: 360, price: 600 },
  ],
};

const mockPayload: {
  find: ReturnType<typeof vi.fn>;
  findGlobal: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} = {
  find: vi.fn(async () => ({ docs: [] })),
  findGlobal: vi.fn(async () => SETTINGS),
  create: vi.fn(),
  update: vi.fn(async () => ({ doc: { id: 1 } })),
};

const { stripe } = await import('../../../../src/lib/stripe/client');
const { POST } = await import('./route');
const { HOLD_TTL_MINUTES } = await import('../../../../src/lib/booking/availability');

const mockCreateSession = vi.mocked(stripe.checkout.sessions.create);

// Today 07:00 CDMX → today is rentable and 09:00+ blocks are in the future.
const NOW = new Date('2026-06-15T13:00:00Z');

function makeBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    date: '2026-06-15',
    startTime: '09:00',
    durationMinutes: 60,
    quantity: 1,
    customer: {
      name: 'Ana P',
      email: 'ana@example.com',
      whatsapp: '',
      country: 'MX',
      locale: 'en',
    },
    ...overrides,
  });
}

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/rental/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000', ...headers },
    body,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockPayload.find.mockReset();
  mockPayload.find.mockResolvedValue({ docs: [] });
  mockPayload.findGlobal.mockReset();
  mockPayload.findGlobal.mockResolvedValue(SETTINGS);
  mockPayload.create.mockReset();
  mockPayload.update.mockReset();
  mockPayload.update.mockResolvedValue({ doc: { id: 1 } });
  mockCreateSession.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/rental/checkout', () => {
  it('returns 400 on an invalid payload', async () => {
    const res = await POST(makeRequest('{"bad":"shape"}'));
    expect(res.status).toBe(400);
  });

  it('returns 422 when durationMinutes matches no configured tier', async () => {
    const res = await POST(makeRequest(makeBody({ durationMinutes: 45 })));
    expect(res.status).toBe(422);
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it('returns 422 rental-unavailable and creates NO pending rental when the fleet is consumed (AC26)', async () => {
    // A live rental of 8 bikes overlapping 09:00 fills the fleet → 1 + 8 > 8.
    mockPayload.find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'rentals') {
        return { docs: [{ startTime: '09:00', durationMinutes: 60, quantity: 8, status: 'paid' }] };
      }
      return { docs: [] }; // tours, bookings
    });

    const res = await POST(makeRequest(makeBody({ startTime: '09:00', durationMinutes: 60, quantity: 1 })));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.reason).toBe('fleet');
    // Authoritative gate fires BEFORE any row is created.
    expect(mockPayload.create).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('happy path: creates a pending rental with holdExpiresAt now+15 (AC5), trusted context, MXN, server price', async () => {
    mockPayload.find.mockResolvedValue({ docs: [] }); // empty day
    mockPayload.create.mockResolvedValueOnce({ id: 55, reference: 'LC-RENT0001' });
    mockCreateSession.mockResolvedValueOnce({
      id: 'cs_test_rental',
      url: 'https://checkout.stripe.com/c/pay/cs_test_rental',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(makeRequest(makeBody({ durationMinutes: 60, quantity: 1 })));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { checkoutUrl: string; reference: string };
    expect(body.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_rental');
    expect(body.reference).toMatch(/^LC-[A-F0-9]{8}$/);

    expect(mockPayload.create).toHaveBeenCalledTimes(1);
    const createCall = mockPayload.create.mock.calls[0]?.[0] as {
      collection: string;
      data: Record<string, unknown>;
      context?: Record<string, unknown>;
    };
    expect(createCall.collection).toBe('rentals');
    expect(createCall.data.status).toBe('pending');
    expect(createCall.data.currency).toBe('MXN');
    // unitPrice is the server-resolved tier price (60min → 200), never client-sent.
    expect(createCall.data.unitPrice).toBe(200);
    expect(createCall.data.quantity).toBe(1);
    expect(createCall.data.totalAmount).toBe(200);
    // AC5: hold expires exactly HOLD_TTL_MINUTES after now.
    const expectedHold = new Date(NOW.getTime() + HOLD_TTL_MINUTES * 60_000).toISOString();
    expect(createCall.data.holdExpiresAt).toBe(expectedHold);
    // MANDATORY: honor the B1 anonymous-create gate contract.
    expect(createCall.context?.trustedRentalCreate).toBe(true);

    // Stripe session: kind=rental metadata + idempotency key rental-<ref>.
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    const stripeArgs = mockCreateSession.mock.calls[0];
    const sessionParams = stripeArgs?.[0] as {
      metadata: Record<string, string>;
      line_items: Array<{ price_data: { currency: string } }>;
    };
    const stripeOptions = stripeArgs?.[1] as { idempotencyKey: string };
    expect(sessionParams.metadata.kind).toBe('rental');
    expect(sessionParams.metadata.rentalId).toBe('55');
    expect(sessionParams.line_items[0]?.price_data.currency).toBe('mxn');
    expect(stripeOptions.idempotencyKey).toMatch(/^rental-LC-/);

    // Session id persisted back onto the rental row.
    const updateCall = mockPayload.update.mock.calls[0]?.[0] as {
      collection: string;
      data: { stripeCheckoutSessionId: string };
    };
    expect(updateCall.collection).toBe('rentals');
    expect(updateCall.data.stripeCheckoutSessionId).toBe('cs_test_rental');
  });

  it('returns 502 and cancels the rental when Stripe throws', async () => {
    mockPayload.find.mockResolvedValue({ docs: [] });
    mockPayload.create.mockResolvedValueOnce({ id: 77, reference: 'LC-RENTFAIL' });
    mockCreateSession.mockRejectedValueOnce(new Error('Stripe API down'));

    const res = await POST(makeRequest(makeBody({ durationMinutes: 60, quantity: 1 })));
    expect(res.status).toBe(502);
    const cancelCall = mockPayload.update.mock.calls[0]?.[0] as {
      collection: string;
      data: { status: string; notes: string };
    };
    expect(cancelCall.collection).toBe('rentals');
    expect(cancelCall.data.status).toBe('cancelled');
    expect(cancelCall.data.notes).toMatch(/Stripe API down/);
  });
});
