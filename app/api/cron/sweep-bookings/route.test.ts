import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/lib/payload', () => ({
  getPayload: vi.fn(async () => mockPayload),
}));

vi.mock('../../../../src/lib/booking/sweep', () => ({
  sweepExpiredHolds: vi.fn(async () => ({ swept: 3 })),
}));

const mockPayload = {};

const { sweepExpiredHolds } = await import('../../../../src/lib/booking/sweep');
const { GET } = await import('./route');

function makeReq(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/cron/sweep-bookings', { headers });
}

beforeEach(() => {
  vi.mocked(sweepExpiredHolds).mockClear();
  process.env.CRON_SECRET = 'super-secret-value';
});

describe('GET /api/cron/sweep-bookings', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(sweepExpiredHolds).not.toHaveBeenCalled();
  });

  it('returns 401 when bearer token is wrong', async () => {
    const res = await GET(makeReq('Bearer wrong-token'));
    expect(res.status).toBe(401);
    expect(sweepExpiredHolds).not.toHaveBeenCalled();
  });

  it('returns 200 with {swept} when bearer token matches', async () => {
    const res = await GET(makeReq('Bearer super-secret-value'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { swept: number };
    expect(body.swept).toBe(3);
    expect(sweepExpiredHolds).toHaveBeenCalledTimes(1);
  });

  it('returns 500 if CRON_SECRET env var is not configured', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeReq('Bearer anything'));
    expect(res.status).toBe(500);
    expect(sweepExpiredHolds).not.toHaveBeenCalled();
  });
});
