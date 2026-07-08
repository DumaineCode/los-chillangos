import { expect, test } from '@playwright/test';

/**
 * Rentals price list (home block). The business rents ONE bike in ONE size, so
 * the home block is a simple, CMS-editable PRICE LIST (durations + optional
 * helmet + contact CTA), not a catalog. Copy/prices come from the Landing
 * global's `rentals` tab; the block is identified by stable test ids so the
 * assertions do not depend on editable copy.
 *
 * NOTE: seed is intentionally NOT run automatically — `pnpm seed` rewrites ALL
 * globals/collections and would clobber any admin edits. Instead, the first test
 * checks that the rentals tab actually rendered priced durations and fails with
 * a clear, actionable message if the database is unseeded (preventing the
 * opaque `toBeVisible` timeout that masks the real cause).
 *
 * Run locally:
 *   pnpm seed   # one-time, only if the rentals tab is empty
 *   pnpm e2e e2e/rentals-home.spec.ts
 */

test('home page shows the rentals price list and a contact CTA', async ({ page }) => {
  await page.goto('/en');

  const block = page.getByTestId('rentals-home-block');
  await expect(block).toBeVisible();

  // Fail with a clear cause when the Landing rentals tab has no priced
  // durations, instead of an opaque locator-timeout further down.
  const priceList = block.getByTestId('rental-price-list');
  const seeded = await priceList.isVisible().catch(() => false);
  if (!seeded) {
    throw new Error(
      'e2e/rentals-home.spec.ts: the Landing `rentals` tab rendered no priced durations on /en. ' +
        'Run `pnpm seed` (or add durations in /admin) before running this spec.'
    );
  }
  await expect(priceList).toBeVisible();

  // The CTA defaults to the on-page contact section (no navigation off-page).
  const cta = block.getByTestId('rentals-home-cta');
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', '#contact');
});

test('home rentals block renders on /es too', async ({ page }) => {
  await page.goto('/es');

  const block = page.getByTestId('rentals-home-block');
  await expect(block).toBeVisible();
  await expect(block.getByTestId('rental-price-list')).toBeVisible();
});
