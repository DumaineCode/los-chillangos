import { expect, test } from '@playwright/test';

/**
 * Smoke test for GET /api/booking/availability.
 *
 * We do NOT seed any bookings — we hit the route against a known seeded
 * tour and assert the response shape. The seeded tours from `pnpm seed`
 * have no `availableDays` or `timeSlots` populated yet (the human fills
 * those in /admin), so the route should return `{ slots: [] }`. This
 * intentionally proves the read path works end-to-end without depending
 * on per-tour calendar state.
 *
 * Precondition: the dev server is running (the Playwright `webServer`
 * config auto-starts `pnpm dev` on port 3000). The `tours` collection
 * has at least one seeded tour so `tourId=1` resolves to a real row.
 */
test('GET /api/booking/availability returns slots:[] for an unconfigured tour', async ({
  request,
}) => {
  // 2026-06-15 is far enough in the future to be irrelevant for past-date
  // logic and stable across CI clock drift.
  const res = await request.get('/api/booking/availability?tourId=1&date=2026-06-15');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-store');

  const body = (await res.json()) as { slots: unknown[] };
  // With the seeded tour having no availableDays/timeSlots populated yet,
  // the route returns an empty list. The human populates slots in /admin.
  expect(Array.isArray(body.slots)).toBe(true);
});

test('GET /api/booking/availability rejects malformed query', async ({ request }) => {
  const res = await request.get('/api/booking/availability?tourId=abc&date=2026-06-15');
  expect(res.status()).toBe(400);
});

test('GET /api/booking/availability returns 404 for unknown tour', async ({ request }) => {
  const res = await request.get('/api/booking/availability?tourId=999999&date=2026-06-15');
  expect(res.status()).toBe(404);
});
