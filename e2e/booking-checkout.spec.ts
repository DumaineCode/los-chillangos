import { expect, test } from '@playwright/test';

/**
 * Smoke tests for the Stripe Checkout wiring (Sub-etapa C).
 *
 * What we DO test here:
 *   - POST /api/booking/checkout rejects an invalid payload with 400.
 *   - POST /api/booking/checkout returns 404 for an unknown tour.
 *   - The /[locale]/book/cancelled page renders the "your seats were
 *     released" copy in both English and Spanish.
 *
 * What we explicitly DO NOT test:
 *   - The Stripe Checkout UI itself (brittle, third-party DOM).
 *   - A full pay → webhook → success roundtrip. That needs `stripe-cli`
 *     and a live `STRIPE_SECRET_KEY` — see manual run instructions below.
 *
 * Manual full-flow check (do this once locally before shipping a Stripe
 * change):
 *
 *   # Terminal 1
 *   pnpm dev
 *
 *   # Terminal 2 — forwards Stripe events to the local webhook
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *   # Copy the whsec_... it prints into .env.local as STRIPE_WEBHOOK_SECRET
 *
 *   # Terminal 3 — drive the booking flow manually in a browser, pay with
 *   # 4242 4242 4242 4242 (any future expiry, any CVC), then watch
 *   # `stripe listen` for `checkout.session.completed` and verify the
 *   # booking flips to `paid` in /admin → Bookings.
 */

const HAPPY_PAYLOAD = {
  tourId: 1,
  date: '2030-06-15',
  time: '09:00',
  adults: 2,
  teens: 0,
  privatize: false,
  customer: {
    name: 'Hana K',
    email: 'hana@example.com',
    whatsapp: '',
    locale: 'en' as const,
  },
};

test('POST /api/booking/checkout rejects invalid payload with 400', async ({ request }) => {
  const res = await request.post('/api/booking/checkout', {
    data: { bad: 'shape' },
  });
  expect(res.status()).toBe(400);
  const body = (await res.json()) as { error: string };
  expect(body.error).toBe('invalid-payload');
});

test('POST /api/booking/checkout returns 404 for unknown tour', async ({ request }) => {
  const res = await request.post('/api/booking/checkout', {
    data: { ...HAPPY_PAYLOAD, tourId: 999999 },
  });
  expect(res.status()).toBe(404);
  const body = (await res.json()) as { error: string };
  expect(body.error).toBe('tour-not-found');
});

test('GET /en/book/cancelled renders the cancelled state', async ({ page }) => {
  await page.goto('/en/book/cancelled');
  await expect(page.getByRole('heading', { name: /booking cancelled/i })).toBeVisible();
  await expect(page.getByText(/seats were released/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /try again/i })).toBeVisible();
});

test('GET /es/book/cancelled renders the cancelled state in Spanish', async ({ page }) => {
  await page.goto('/es/book/cancelled');
  await expect(page.getByRole('heading', { name: /reserva cancelada/i })).toBeVisible();
  await expect(page.getByText(/lugares fueron liberados/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /reintentar/i })).toBeVisible();
});
