import { NextResponse } from 'next/server';

import { sweepExpiredHolds } from '../../../../src/lib/booking/sweep';
import { getPayload } from '../../../../src/lib/payload';

/**
 * GET /api/cron/sweep-bookings — Vercel cron endpoint (Sub-etapa C).
 *
 * Owns the periodic flip of `pending` → `expired` for bookings whose
 * `holdExpiresAt` is in the past. Configured to run every minute via
 * `vercel.json`. Before this, capacity reads ran the sweep lazily on
 * every request (B), which paid a write cost on every read.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`. Vercel cron sends
 * this header automatically when `CRON_SECRET` is configured in the project
 * environment. The endpoint refuses to run without it — drive-by hits from
 * the open internet should not be able to spam writes.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    // Misconfigured deployment — fail loud rather than silently letting
    // anyone hit this endpoint.
    return NextResponse.json(
      { error: 'cron-secret-not-configured' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (provided !== expected) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const payload = await getPayload();
  const { swept } = await sweepExpiredHolds(payload, new Date());
  return NextResponse.json(
    { swept },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
