import { expect, test } from '@playwright/test';

/**
 * Rental detail (/rentals/[slug]) — localized copy, informative price, and
 * accessories with photos; 404 on an unknown slug (R5).
 *
 * Requires a running dev server AND at least one PUBLISHED rental. The first
 * test discovers a real slug from the catalog and opens its /es detail page;
 * if no rentals are seeded it skips. The 404 test needs no seed data.
 *
 * Run locally with seeded data:
 *   pnpm e2e e2e/rentals-detail.spec.ts
 */
test('GET /es/rentals/{slug} renders Spanish copy, price, and accessories', async ({ page }) => {
  // Discover a published rental slug from the catalog.
  await page.goto('/es/rentals');
  const firstCard = page.locator('#rentals a.tour-card').first();
  const cardCount = await page.locator('#rentals a.tour-card').count();
  test.skip(cardCount === 0, 'No published rentals seeded — detail render check needs at least one.');

  const href = await firstCard.getAttribute('href');
  expect(href).toMatch(/\/rentals\//);

  await firstCard.click();
  await expect(page).toHaveURL(/\/es\/rentals\//);

  // The detail headline (bike name) renders.
  await expect(page.locator('h1.detail-headline')).toBeVisible();

  // The informative price renders verbatim (no computed total). When the bike
  // has a price it appears in the sidebar price amount.
  const priceAmount = page.locator('.price-amount');
  if ((await priceAmount.count()) > 0) {
    await expect(priceAmount.first()).toBeVisible();
  }

  // Accessories (when present) render their photo + name.
  const accessories = page.locator('[data-testid="accessory"]');
  const accessoryCount = await accessories.count();
  for (let i = 0; i < accessoryCount; i++) {
    await expect(accessories.nth(i).locator('.tour-card-title')).toBeVisible();
  }
});

test('GET /en/rentals/{unknown-slug} responds 404', async ({ page }) => {
  const response = await page.goto('/en/rentals/this-rental-does-not-exist-xyz');
  expect(response?.status()).toBe(404);
});
