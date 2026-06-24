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
  findGlobal: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} = {
  findByID: vi.fn(),
  find: vi.fn(async () => ({ docs: [] })),
  findGlobal: vi.fn(async () => ({ totalBikes: 8, bufferMinutes: 120 })),
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

  it('flags a bike-tour slot as blocked when the fleet is full (advisory)', async () => {
    // Candidate bike tour 2 (cupo 8) at 09:00 on Mon 2026-06-15. An existing
    // full-fleet bike booking (tour 1, cupo 8) overlaps → the slot stays in the
    // payload but is flagged so the client can grey it out.
    mockPayload.findByID.mockResolvedValueOnce({
      id: 2,
      slug: 'ebike',
      availableDays: ['1'],
      usesBikes: true,
      durationMinutes: 120,
      timeSlots: [{ time: '09:00', capacity: 8 }],
    });
    mockPayload.find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'tours') {
        return {
          docs: [
            { id: 1, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '09:00', capacity: 8 }] },
            { id: 2, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '09:00', capacity: 8 }] },
          ],
        };
      }
      // bookings: capacity read (tour 2, no same-tour seats) returns []; fleet
      // read sees the tour-1 full-fleet neighbour at 09:00.
      return { docs: [{ tour: 1, time: '09:00', date: '2026-06-15T15:00:00.000Z' }] };
    });

    const res = await GET(
      makeRequest('http://localhost/api/booking/availability?tourId=2&date=2026-06-15')
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slots: Array<{ time: string; bikeBlocked: boolean; bikeReason: string | null }>;
    };
    expect(body.slots).toHaveLength(1);
    expect(body.slots[0]?.time).toBe('09:00');
    expect(body.slots[0]?.bikeBlocked).toBe(true);
    expect(body.slots[0]?.bikeReason).toBe('fleet');
  });

  it('does not flag slots for a non-bike tour (bikeBlocked false, no reason)', async () => {
    mockPayload.findByID.mockResolvedValueOnce({
      id: 3,
      slug: 'walking',
      availableDays: ['1'],
      usesBikes: false,
      timeSlots: [{ time: '09:00', capacity: 8 }],
    });
    mockPayload.find.mockResolvedValueOnce({ docs: [] }); // no seats taken

    const res = await GET(
      makeRequest('http://localhost/api/booking/availability?tourId=3&date=2026-06-15')
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slots: Array<{ bikeBlocked: boolean; bikeReason: string | null }>;
    };
    expect(body.slots[0]?.bikeBlocked).toBe(false);
    expect(body.slots[0]?.bikeReason).toBeNull();
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
