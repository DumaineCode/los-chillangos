import { expect, test } from '@playwright/test';

/**
 * Featured rentals home block (R6) — the landing page shows a rentals block
 * whose CTA navigates to /rentals.
 *
 * Requires a running dev server. The block renders from the Landing global's
 * `rentals` named tab; the CTA always points at the localized /rentals catalog
 * route regardless of how many rentals are seeded. The block is identified by
 * its stable test id so the assertion does not depend on editable copy.
 *
 * Run locally:
 *   pnpm e2e e2e/rentals-home.spec.ts
 */
test('home page shows the rentals block and its CTA links to /en/rentals', async ({ page }) => {
  await page.goto('/en');

  const block = page.getByTestId('rentals-home-block');
  await expect(block).toBeVisible();

  const cta = block.getByTestId('rentals-home-cta');
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', /\/en\/rentals(?:$|\/|\?)/);

  // Clicking the CTA lands on the catalog.
  await cta.click();
  await expect(page).toHaveURL(/\/en\/rentals(?:$|\/|\?)/);
  await expect(page.locator('#rentals')).toBeVisible();
});

test('home rentals block CTA is locale-aware on /es', async ({ page }) => {
  await page.goto('/es');

  const cta = page.getByTestId('rentals-home-block').getByTestId('rentals-home-cta');
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', /\/es\/rentals(?:$|\/|\?)/);
});
