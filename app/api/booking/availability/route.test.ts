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

/**
 * A Monday comfortably in the future relative to the REAL clock, so the
 * day-before-noon bike ticket cutoff (§5 BUSINESS_RULES) never fires and the
 * fleet-advisory assertions stay time-stable. Returns the `YYYY-MM-DD` query
 * value plus a matching booking-fixture instant (15:00Z = 09:00 CDMX, same day).
 */
function futureBikeMonday(): { iso: string; fixtureDate: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); // next Monday
  const iso = d.toISOString().slice(0, 10);
  return { iso, fixtureDate: `${iso}T15:00:00.000Z` };
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
    // Candidate bike tour 2 (cupo 8) at 09:00 on a future Monday. An existing
    // full-fleet bike booking (tour 1, cupo 8) overlaps → the slot stays in the
    // payload but is flagged so the client can grey it out. The date is future
    // so the day-before-noon ticket cutoff (§5) does not close the whole day.
    const { iso, fixtureDate } = futureBikeMonday();
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
      return { docs: [{ tour: 1, time: '09:00', date: fixtureDate }] };
    });

    const res = await GET(
      makeRequest(`http://localhost/api/booking/availability?tourId=2&date=${iso}`)
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

  it('flags ALL slots ticket-cutoff and skips the fleet reads once the day-before-noon cutoff passed', async () => {
    // Controlled clock (this endpoint otherwise runs on the real clock): pin now
    // to the bike tour's OWN day, well past the day-before-noon cutoff (§5). The
    // whole day must be advisory-closed with reason 'ticket-cutoff', and the two
    // fleet-state reads must be short-circuited (findGlobal never called).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-16T14:00:00Z')); // Sun 08:00 CDMX, tour day
    try {
      mockPayload.findGlobal.mockClear(); // isolate from prior tests' fleet reads
      mockPayload.findByID.mockResolvedValueOnce({
        id: 2,
        slug: 'ebike',
        availableDays: ['0'], // Sunday
        usesBikes: true,
        durationMinutes: 120,
        timeSlots: [{ time: '14:00', capacity: 8 }],
      });
      mockPayload.find.mockResolvedValue({ docs: [] }); // capacity read: no seats

      const res = await GET(
        makeRequest('http://localhost/api/booking/availability?tourId=2&date=2030-06-16')
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        slots: Array<{ time: string; bikeBlocked: boolean; bikeReason: string | null }>;
      };
      expect(body.slots).toHaveLength(1);
      expect(body.slots[0]?.bikeBlocked).toBe(true);
      expect(body.slots[0]?.bikeReason).toBe('ticket-cutoff');
      // Fleet state (booking-settings global) is read ONLY by getBikeFleetState;
      // asserting it was not called proves the short-circuit skipped both reads.
      expect(mockPayload.findGlobal).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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
