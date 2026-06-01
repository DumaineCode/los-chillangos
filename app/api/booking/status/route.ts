import { NextResponse } from 'next/server';

import { getPayload } from '../../../../src/lib/payload';

/**
 * GET /api/booking/status?ref=LC-...
 *
 * Tiny read-only endpoint used by the success page's polling client to
 * detect when the Stripe webhook has promoted a booking to `paid`. We
 * expose ONLY the status — not the customer details. Knowing the
 * reference is treated as sufficient authorization for this slice (it's
 * already exposed in the post-checkout return URL); other endpoints
 * remain gated.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref')?.trim();
  if (!ref) {
    return NextResponse.json(
      { error: 'missing-ref' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const payload = await getPayload();
  const result = await payload.find({
    collection: 'bookings',
    where: { reference: { equals: ref } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const docs = (result as { docs?: Array<{ status?: string }> }).docs ?? [];
  const doc = docs[0];
  if (!doc) {
    return NextResponse.json(
      { error: 'not-found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { status: doc.status ?? 'unknown' },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
