import { expect, test } from '@playwright/test';

/**
 * Rentals catalog (/rentals) — public listing of PUBLISHED bike models (R4).
 *
 * Requires a running dev server (playwright.config webServer) AND at least one
 * PUBLISHED rental in the database. With no seeded rentals the page renders the
 * localized empty state instead of cards; this spec asserts the catalog surface
 * itself (heading + either cards or the empty state) and locale/slug parity.
 *
 * Run locally with seeded data:
 *   pnpm dev            # terminal 1 (or rely on the configured webServer)
 *   pnpm e2e e2e/rentals-catalog.spec.ts
 */
test('GET /en/rentals renders the catalog surface', async ({ page }) => {
  await page.goto('/en/rentals');
  await expect(page).toHaveURL(/\/en\/rentals(?:$|\/|\?)/);

  // The catalog section is always present (heading), regardless of how many
  // rentals are seeded.
  await expect(page.locator('#rentals')).toBeVisible();
  await expect(page.locator('#rentals h1')).toBeVisible();

  // Either published rental cards render, or the empty state does — never both.
  const cards = page.locator('#rentals a.tour-card');
  const cardCount = await cards.count();
  if (cardCount > 0) {
    // Every card links into the rentals detail space (never /tours).
    for (let i = 0; i < cardCount; i++) {
      const href = await cards.nth(i).getAttribute('href');
      expect(href).toMatch(/\/rentals\//);
    }
  } else {
    await expect(page.locator('#rentals .catalog-notfound')).toBeVisible();
  }
});

test('catalog keeps the same slugs across /en and /es (slug non-localized)', async ({ page }) => {
  await page.goto('/en/rentals');
  const enCards = page.locator('#rentals a.tour-card');
  const enCount = await enCards.count();
  test.skip(enCount === 0, 'No published rentals seeded — slug-parity check needs at least one.');

  const enSlugs = (
    await Promise.all(
      Array.from({ length: enCount }, (_, i) => enCards.nth(i).getAttribute('href'))
    )
  )
    .map((href) => href?.replace(/^\/(en|es)\/rentals\//, '').replace(/^\/rentals\//, ''))
    .sort();

  await page.goto('/es/rentals');
  const esCards = page.locator('#rentals a.tour-card');
  const esCount = await esCards.count();
  const esSlugs = (
    await Promise.all(
      Array.from({ length: esCount }, (_, i) => esCards.nth(i).getAttribute('href'))
    )
  )
    .map((href) => href?.replace(/^\/(en|es)\/rentals\//, '').replace(/^\/rentals\//, ''))
    .sort();

  // Same rows serve both locales: identical slug set, only copy differs.
  expect(esSlugs).toEqual(enSlugs);
});
