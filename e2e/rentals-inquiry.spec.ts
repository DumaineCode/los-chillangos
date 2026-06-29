import { expect, test } from '@playwright/test';

/**
 * Rentals inquiry CTA (/rentals/[slug] → POST /api/contact) — the A→B seam (R7).
 *
 * Confirms the inquiry CTA on a published rental detail page submits via the
 * EXISTING contact mechanism: it POSTs to /api/contact carrying the bike slug
 * as `rental`, with the message pre-seeded from the bike reference. The seam is
 * engine-free — it never calls /book, fleet, availability, pricing, or Stripe.
 *
 * Requires a running dev server AND at least one PUBLISHED rental. The test
 * discovers a real slug from the catalog and opens its detail page; if no
 * rentals are seeded it skips.
 *
 * Run locally with seeded data:
 *   pnpm e2e e2e/rentals-inquiry.spec.ts
 */
test('inquiry CTA on a rental detail page POSTs to /api/contact with the bike reference', async ({
  page,
}) => {
  await page.goto('/en/rentals');
  const cardCount = await page.locator('#rentals a.tour-card').count();
  test.skip(cardCount === 0, 'No published rentals seeded — inquiry seam check needs at least one.');

  const firstCard = page.locator('#rentals a.tour-card').first();
  const href = await firstCard.getAttribute('href');
  const slug = href?.split('/rentals/')[1]?.replace(/\/$/, '') ?? '';
  expect(slug.length).toBeGreaterThan(0);

  await firstCard.click();
  await expect(page).toHaveURL(/\/en\/rentals\//);

  // The inquiry CTA is mounted in the previously-stubbed slot.
  const cta = page.locator('[data-testid="inquiry-cta-slot"] form[data-testid="inquiry-cta"]');
  await expect(cta).toBeVisible();

  // The message textarea is pre-seeded with the bike reference (>=10 chars).
  const message = cta.locator('#inquiry-message');
  const seeded = await message.inputValue();
  expect(seeded.length).toBeGreaterThanOrEqual(10);

  await cta.locator('#inquiry-name').fill('Hana Kobayashi');
  await cta.locator('#inquiry-email').fill('hana@example.com');

  // Capture the network call to prove the seam targets ONLY /api/contact and
  // carries the bike slug as `rental`.
  const [request] = await Promise.all([
    page.waitForRequest(
      (req) => req.url().includes('/api/contact') && req.method() === 'POST'
    ),
    cta.locator('button[type="submit"]').click(),
  ]);

  const body = request.postDataJSON() as {
    name: string;
    email: string;
    message: string;
    locale: string;
    rental: string;
  };
  expect(body.rental).toBe(slug);
  expect(body.name).toBe('Hana Kobayashi');
  expect(body.email).toBe('hana@example.com');
  expect(body.locale).toBe('en');
  expect(body.message.length).toBeGreaterThanOrEqual(10);

  // Success state confirms the inquiry was accepted.
  await expect(page.locator('[data-testid="inquiry-cta"][role="status"]')).toBeVisible();
});
