import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDayAvailability } from '../../../../src/lib/booking/capacity';
import { getPayload } from '../../../../src/lib/payload';
import type { Tour } from '../../../../src/payload-types';

/**
 * GET /api/booking/availability?tourId=<int>&date=<YYYY-MM-DD>
 *
 * Returns the per-slot availability for a single tour on a single calendar
 * day (interpreted in CDMX). Bookings change too fast to cache — this
 * endpoint sets `Cache-Control: no-store`. The booking page calls it
 * client-side every time the user picks a date.
 *
 * Validation:
 *   - tourId: positive integer
 *   - date: ISO-ish "YYYY-MM-DD" (loose; we parse the local-calendar value)
 *
 * Auth: none (public booking availability is public). We use
 * `overrideAccess: true` inside the helper so the count is consistent
 * regardless of caller.
 */

const querySchema = z.object({
  tourId: z.coerce.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    tourId: url.searchParams.get('tourId') ?? undefined,
    date: url.searchParams.get('date') ?? undefined,
  });
  if (!parsed.success) {
    return jsonNoStore({ error: 'invalid_query', issues: parsed.error.issues }, 400);
  }
  const { tourId, date } = parsed.data;

  const payload = await getPayload();
  const tour = (await payload
    .findByID({ collection: 'tours', id: tourId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Tour | null;

  if (!tour) {
    return jsonNoStore({ error: 'tour_not_found' }, 404);
  }

  // Build a Date that represents midnight on the requested calendar day. We
  // pass it through `getCDMXDayRange` inside the helper to normalize to the
  // CDMX day window — so the local-calendar reading of `YYYY-MM-DD` here is
  // intentional: we want a JS Date whose CDMX projection lands on the same
  // YMD the client asked for. A noon-UTC anchor is safe in any TZ from
  // UTC-12 to UTC+12 (it always lands on the same calendar day in CDMX).
  const anchor = new Date(`${date}T12:00:00Z`);

  const slots = await getDayAvailability({ payload, tour, date: anchor });
  return jsonNoStore({ slots });
}

function jsonNoStore(body: unknown, status = 200): Response {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
