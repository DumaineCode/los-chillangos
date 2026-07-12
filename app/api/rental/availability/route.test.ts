import { describe, expect, it, vi } from 'vitest';

/**
 * Rental availability GET route tests (Batch 2, PR2). We mock the Payload
 * accessor so no real DB is touched, and pin the clock so the §5 cutoff gate is
 * deterministic.
 *
 *   - AC10: a non-rentable day (now + 2 days) → { rentable:false, combos:[] }.
 *   - AC24: every emitted maxQuantity is valid and maxQuantity+1 invalid under
 *     the same evaluator (the grid can never drift from the engine).
 */

vi.mock('../../../../src/lib/payload', () => {
  return { getPayload: vi.fn(async () => mockPayload) };
});

const mockPayload: {
  find: ReturnType<typeof vi.fn>;
  findGlobal: ReturnType<typeof vi.fn>;
} = {
  find: vi.fn(async () => ({ docs: [] })),
  findGlobal: vi.fn(async () => ({
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
  })),
};

const { GET } = await import('./route');
const { evaluateRental } = await import('../../../../src/lib/booking/rentalEvaluator');

function makeRequest(url: string): Request {
  return new Request(url);
}

/** YYYY-MM-DD for a Date's UTC calendar day. */
function ymdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe('GET /api/rental/availability', () => {
  it('returns 400 when date is malformed', async () => {
    const res = await GET(makeRequest('http://localhost/api/rental/availability?date=2026-6-1'));
    expect(res.status).toBe(400);
  });

  it('returns rentable:false with empty combos for a non-rentable day (AC10)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T18:00:00Z')); // today 12:00 CDMX
    try {
      const dayAfter = new Date('2026-06-17T12:00:00Z');
      const res = await GET(
        makeRequest(`http://localhost/api/rental/availability?date=${ymdUTC(dayAfter)}`)
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { rentable: boolean; combos: unknown[] };
      expect(body.rentable).toBe(false);
      expect(body.combos).toEqual([]);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    } finally {
      vi.useRealTimers();
    }
  });

  it('emits a grid whose maxQuantity matches the evaluator, no drift (AC24)', async () => {
    vi.useFakeTimers();
    // Pin now to today 07:00 CDMX so today is rentable and 09:00+ blocks are future.
    const now = new Date('2026-06-15T13:00:00Z');
    vi.setSystemTime(now);
    try {
      mockPayload.find.mockResolvedValue({ docs: [] }); // no tours/bookings/rentals
      const iso = '2026-06-15';
      const res = await GET(makeRequest(`http://localhost/api/rental/availability?date=${iso}`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        date: string;
        rentable: boolean;
        combos: Array<{ startTime: string; durationMinutes: number; unitPrice: number; maxQuantity: number }>;
      };
      expect(body.rentable).toBe(true);
      expect(body.combos.length).toBeGreaterThan(0);

      // Block-stepping guard: the distinct emitted start times must be exactly the
      // openTime→closeTime grid stepped by rentalGranularityMinutes, trimmed to the
      // blocks that can still host the shortest tier before closeTime. This pins
      // the granularity and the open bound (a wrong step or shifted first block
      // would break it).
      const openMin = 9 * 60; // 09:00
      const closeMin = 19 * 60; // 19:00
      const step = 30; // rentalGranularityMinutes
      const shortestTierMin = 60; // smallest configured tier duration
      const expectedStarts: string[] = [];
      for (let b = openMin; b <= closeMin; b += step) {
        if (b + shortestTierMin <= closeMin) {
          expectedStarts.push(
            `${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}`
          );
        }
      }
      const distinctStarts = [...new Set(body.combos.map((c) => c.startTime))];
      expect(distinctStarts).toEqual(expectedStarts);

      const anchor = new Date(`${iso}T12:00:00Z`);
      const cfg = {
        totalBikes: 8,
        bufferMinutes: 120,
        openTime: '09:00',
        closeTime: '19:00',
      };
      for (const combo of body.combos) {
        // Every emitted combo must be offered (>= 1) and satisfy the evaluator.
        expect(combo.maxQuantity).toBeGreaterThanOrEqual(1);
        const at = evaluateRental(
          { date: anchor, startTime: combo.startTime, durationMinutes: combo.durationMinutes, quantity: combo.maxQuantity },
          { tours: [], rentals: [] },
          cfg,
          now
        );
        expect(at).toEqual({ valid: true });
        const over = evaluateRental(
          { date: anchor, startTime: combo.startTime, durationMinutes: combo.durationMinutes, quantity: combo.maxQuantity + 1 },
          { tours: [], rentals: [] },
          cfg,
          now
        );
        expect(over.valid).toBe(false);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('forwards real day occupancy into the grid and keeps evaluator parity under load', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-06-15T13:00:00Z'); // today 07:00 CDMX
    vi.setSystemTime(now);
    try {
      // A NON-EMPTY day: one bike tour at 12:00 with 5 persons sold (cupo 8).
      mockPayload.find.mockImplementation(async (args: { collection: string }) => {
        if (args.collection === 'tours') {
          return {
            docs: [
              { id: 1, usesBikes: true, durationMinutes: 120, timeSlots: [{ time: '12:00', capacity: 8 }] },
            ],
          };
        }
        if (args.collection === 'bookings') {
          return { docs: [{ tour: 1, time: '12:00', totalPersons: 5, status: 'paid' }] };
        }
        return { docs: [] }; // rentals
      });

      const iso = '2026-06-15';
      const res = await GET(makeRequest(`http://localhost/api/rental/availability?date=${iso}`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        rentable: boolean;
        combos: Array<{ startTime: string; durationMinutes: number; unitPrice: number; maxQuantity: number }>;
      };
      expect(body.rentable).toBe(true);

      // The 09:00 × 360-min (6h) window overlaps the 12:00 tour → 8 − 5 = 3 bikes.
      // If the route had forwarded an EMPTY day this would read 8 (occupancy-drift bug).
      const sixHourAtOpen = body.combos.find(
        (c) => c.startTime === '09:00' && c.durationMinutes === 360
      );
      expect(sixHourAtOpen?.maxQuantity).toBe(3);

      // Grid↔evaluator parity against the SAME non-empty day the route saw.
      const anchor = new Date(`${iso}T12:00:00Z`);
      const cfg = { totalBikes: 8, bufferMinutes: 120, openTime: '09:00', closeTime: '19:00' };
      const loadedDay = {
        tours: [{ startTime: '12:00', durationMinutes: 120, personsSold: 5 }],
        rentals: [],
      };
      // Pick a combo actually constrained by the tour (maxQuantity < totalBikes),
      // so maxQuantity+1 must trip the FLEET gate — proof of real occupancy forwarding.
      const constrained = body.combos.find((c) => c.maxQuantity < cfg.totalBikes);
      expect(constrained).toBeDefined();
      if (constrained) {
        const at = evaluateRental(
          { date: anchor, startTime: constrained.startTime, durationMinutes: constrained.durationMinutes, quantity: constrained.maxQuantity },
          loadedDay,
          cfg,
          now
        );
        expect(at).toEqual({ valid: true });
        const over = evaluateRental(
          { date: anchor, startTime: constrained.startTime, durationMinutes: constrained.durationMinutes, quantity: constrained.maxQuantity + 1 },
          loadedDay,
          cfg,
          now
        );
        expect(over).toEqual({ valid: false, reason: 'fleet' });
      }
    } finally {
      mockPayload.find.mockReset();
      mockPayload.find.mockResolvedValue({ docs: [] });
      vi.useRealTimers();
    }
  });
});
