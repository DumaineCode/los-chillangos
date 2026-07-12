import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isBikeTicketCutoffPassed } from '../../../../src/lib/booking/availability';
import { getRentalDayState } from '../../../../src/lib/booking/rentalDayState';
import { computeMaxRentalQuantity } from '../../../../src/lib/booking/rentalEvaluator';
import { getPayload } from '../../../../src/lib/payload';

/**
 * GET /api/rental/availability?date=<YYYY-MM-DD>
 *
 * Advisory picker matrix for standalone bike rentals on a single CDMX calendar
 * day. Builds the grid `(startBlock × tier)` where blocks run
 * `openTime`→`closeTime` stepped by `rentalGranularityMinutes`, and maps each
 * cell through `computeMaxRentalQuantity` — the SAME event-sweep the checkout
 * POST uses, so the advisory grid can never drift from the authoritative gate.
 *
 * Rentals change fast → `Cache-Control: no-store`. Non-rentable days (the §5
 * day-before-noon cutoff has not passed) return `{ rentable:false, combos:[] }`.
 */

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type Combo = {
  startTime: string;
  durationMinutes: number;
  unitPrice: number;
  maxQuantity: number;
};

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    date: url.searchParams.get('date') ?? undefined,
  });
  if (!parsed.success) {
    return jsonNoStore({ error: 'invalid_query', issues: parsed.error.issues }, 400);
  }
  const { date } = parsed.data;

  // Noon-UTC anchor lands on the requested calendar day in CDMX regardless of
  // server TZ; the day-state reader normalizes to the CDMX day window.
  const anchor = new Date(`${date}T12:00:00Z`);
  const now = new Date();

  // Day-level §5 gate FIRST: if the day-before-noon cutoff has not passed, the
  // day is not rentable at all — short-circuit an empty matrix (AC10) BEFORE any
  // DB work, so a non-rentable day skips the 1 findGlobal + 3 finds entirely.
  if (!isBikeTicketCutoffPassed(anchor, now)) {
    return jsonNoStore({ date, rentable: false, combos: [] });
  }

  const payload = await getPayload();
  const { day, cfg, tiers, granularityMinutes } = await getRentalDayState({
    payload,
    date: anchor,
    now,
  });

  const openMin = minutesOfDay(cfg.openTime);
  const closeMin = minutesOfDay(cfg.closeTime);
  const step = granularityMinutes > 0 ? granularityMinutes : 30;

  const combos: Combo[] = [];
  for (let block = openMin; block <= closeMin; block += step) {
    const startTime = hhmm(block);
    for (const tier of tiers) {
      const maxQuantity = computeMaxRentalQuantity(
        { date: anchor, startTime, durationMinutes: tier.durationMinutes },
        day,
        cfg,
        now
      );
      if (maxQuantity >= 1) {
        combos.push({
          startTime,
          durationMinutes: tier.durationMinutes,
          unitPrice: tier.price,
          maxQuantity,
        });
      }
    }
  }

  return jsonNoStore({ date, rentable: true, combos });
}

/** Minutes-since-midnight for a 24h `HH:MM` string. */
function minutesOfDay(hhmmStr: string): number {
  const [hhRaw, mmRaw] = hhmmStr.split(':');
  const hh = Number.parseInt(hhRaw ?? '0', 10) || 0;
  const mm = Number.parseInt(mmRaw ?? '0', 10) || 0;
  return hh * 60 + mm;
}

/** Format minutes-since-midnight back to a 24h `HH:MM` string. */
function hhmm(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function jsonNoStore(body: unknown, status = 200): Response {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
