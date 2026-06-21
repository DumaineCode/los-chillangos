import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/route
 *
 * Server-side proxy to OpenRouteService (ORS) directions. The public route map
 * sends an ordered list of waypoints and gets back the real road geometry (a
 * GeoJSON LineString) plus total distance/duration.
 *
 * Why a proxy: the ORS API key must NOT ship to the browser. This handler keeps
 * `ORS_API_KEY` server-side and also sidesteps CORS. If the key is missing or
 * ORS fails, it responds 502/400 and the client falls back to straight lines.
 *
 * Profile: `cycling-regular` (urban e-bike tours). ORS expects coordinates as
 * [lng, lat] and returns geometry coordinates in the same [lng, lat] order.
 */

const ORS_PROFILE = 'cycling-regular';
const ORS_URL = `https://api.openrouteservice.org/v2/directions/${ORS_PROFILE}/geojson`;

const bodySchema = z.object({
  // At least two [lng, lat] pairs. ORS caps the number of waypoints; 50 is plenty.
  coordinates: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2)
    .max(50),
});

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return json({ error: 'routing_not_configured' }, 503);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }

  try {
    const res = await fetch(ORS_URL, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
      },
      body: JSON.stringify({ coordinates: parsed.data.coordinates }),
      // ORS can be slow on cold paths; give it room but don't hang forever.
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return json({ error: 'ors_failed', status: res.status }, 502);
    }

    const data: {
      features?: {
        geometry?: { coordinates?: [number, number][] };
        properties?: { summary?: { distance?: number; duration?: number } };
      }[];
    } = await res.json();

    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return json({ error: 'ors_empty' }, 502);
    }

    return json(
      {
        coordinates,
        distance: feature?.properties?.summary?.distance ?? null, // meters
        duration: feature?.properties?.summary?.duration ?? null, // seconds
      },
      200,
      // Routes are stable; let the CDN cache them for a day.
      'public, s-maxage=86400, stale-while-revalidate=604800',
    );
  } catch {
    return json({ error: 'ors_unreachable' }, 502);
  }
}

function json(body: unknown, status = 200, cacheControl = 'no-store'): Response {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': cacheControl },
  });
}
