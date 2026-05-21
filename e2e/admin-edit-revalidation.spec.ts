import { expect, test } from '@playwright/test';

/**
 * Admin edit + revalidation — log into /admin, edit `Hero.eyebrow`, save,
 * reload /en, assert the new eyebrow text appears. Cleans up by restoring
 * the original value.
 *
 * Precondition: `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` must be present
 * in `.env` (loaded by `playwright.config.ts` via `dotenv/config`). If
 * either is missing the test SKIPS itself with a clear console message —
 * it's meant to work locally with your `.env`, not in CI without
 * credentials.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

test('admin edit to Hero.eyebrow appears on /en after revalidation', async ({ page }) => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'SEED_ADMIN_EMAIL/PASSWORD missing — skipping admin spec (set them in .env to run).'
  );

  // 1. Hit /admin → redirects to /admin/login when unauthenticated.
  await page.goto('/admin');
  await page.waitForURL(/\/admin\/login/, { timeout: 15_000 });

  // 2. Log in. Payload renders standard <input name="email"> and
  //    <input name="password"> — selecting by name is stable across Payload
  //    minor versions.
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').click();

  // 3. Wait for admin landing (any /admin/* page that isn't /login).
  await page.waitForURL((url) => /\/admin/.test(url.pathname) && !/login/.test(url.pathname), {
    timeout: 30_000,
  });

  // 4. Go to Globals → Hero.
  await page.goto('/admin/globals/hero');
  await expect(page.locator('input[name="eyebrow"]')).toBeVisible({ timeout: 15_000 });

  // 5. Capture original value so we can restore it later.
  const eyebrowInput = page.locator('input[name="eyebrow"]');
  const original = (await eyebrowInput.inputValue()).trim();
  const edited = `${original} (e2e ${Date.now()})`;

  try {
    // 6. Edit + save.
    await eyebrowInput.fill(edited);
    // Payload's Save button — text is locale-dependent but data-action is stable in v3.
    const saveBtn = page
      .locator('button[type="submit"]')
      .filter({ hasText: /save|guardar/i })
      .first();
    await saveBtn.click();
    // Wait for the success toast or for the input value to settle.
    await page.waitForTimeout(2000);

    // 7. Reload the public home and assert the new text appears.
    await page.goto('/en');
    const eyebrow = page.getByTestId('hero-eyebrow');
    await expect(eyebrow).toHaveText(edited, { timeout: 15_000 });
  } finally {
    // 8. Restore the original eyebrow value (always — even if assertions
    //    failed — so the next test run starts from a clean state).
    await page.goto('/admin/globals/hero');
    await expect(page.locator('input[name="eyebrow"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('input[name="eyebrow"]').fill(original);
    const saveBtn = page
      .locator('button[type="submit"]')
      .filter({ hasText: /save|guardar/i })
      .first();
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }
});
