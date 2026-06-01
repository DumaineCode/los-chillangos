import { describe, expect, it, vi } from 'vitest';

/**
 * Route handler unit tests — exercise the named GET export as a plain
 * function with a fake `NextRequest`-like URL holder. We mock the Payload
 * dependency at the module level so no real DB is touched.
 */

vi.mock('../../../../src/lib/payload', () => {
  return {
    getPayload: vi.fn(async () => mockPayload),
  };
});

const mockPayload: {
  findByID: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} = {
  findByID: vi.fn(),
  find: vi.fn(async () => ({ docs: [] })),
  update: vi.fn(async () => ({ docs: [] })),
};

// Import AFTER the mock is registered.
const { GET } = await import('./route');

function makeRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/booking/availability', () => {
  it('returns 400 when tourId is missing', async () => {
    const res = await GET(makeRequest('http://localhost/api/booking/availability?date=2026-06-15'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when date is malformed', async () => {
    const res = await GET(
      makeRequest('http://localhost/api/booking/availability?tourId=1&date=2026-6-1')
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when the tour does not exist', async () => {
    mockPayload.findByID.mockResolvedValueOnce(null);
    const res = await GET(
      makeRequest('http://localhost/api/booking/availability?tourId=999&date=2026-06-15')
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 with slots:[] when the tour has no time slots configured', async () => {
    mockPayload.findByID.mockResolvedValueOnce({
      id: 1,
      slug: 'test',
      timeSlots: [],
      availableDays: ['1'],
    });
    const res = await GET(
      makeRequest('http://localhost/api/booking/availability?tourId=1&date=2026-06-15')
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slots: unknown[] };
    expect(body.slots).toEqual([]);
  });

  it('returns 200 with slots when the tour has slots on an open day', async () => {
    mockPayload.findByID.mockResolvedValueOnce({
      id: 1,
      slug: 'test',
      // Monday open (1). 2026-06-15 is Monday CDMX.
      availableDays: ['1'],
      timeSlots: [{ time: '09:00', capacity: 8 }],
    });
    mockPayload.find.mockResolvedValueOnce({ docs: [] }); // no seats taken
    const res = await GET(
      makeRequest('http://localhost/api/booking/availability?tourId=1&date=2026-06-15')
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slots: Array<{ time: string; remaining: number }> };
    expect(body.slots.length).toBe(1);
    expect(body.slots[0]?.time).toBe('09:00');
    expect(body.slots[0]?.remaining).toBe(8);
  });

  it('sets Cache-Control: no-store', async () => {
    mockPayload.findByID.mockResolvedValueOnce({
      id: 1,
      slug: 'test',
      availableDays: [],
      timeSlots: [],
    });
    const res = await GET(
      makeRequest('http://localhost/api/booking/availability?tourId=1&date=2026-06-15')
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
