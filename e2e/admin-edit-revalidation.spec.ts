import { expect, test } from '@playwright/test';

/**
 * Admin edit + revalidation — log into /admin, edit the Landing hero quote
 * (`hero.quote` on the consolidated `landing` global), save, reload /en, and
 * assert the new quote renders as the homepage <h1>. Cleans up by restoring
 * the original value.
 *
 * The hero tab is the FIRST (default-open) tab of the Landing global, so the
 * spec never needs to click through the tab bar.
 *
 * Precondition: `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` must be present
 * in `.env` (loaded by `playwright.config.ts` via `dotenv/config`). If
 * either is missing the test SKIPS itself with a clear console message —
 * it's meant to work locally with your `.env`, not in CI without
 * credentials.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

test('admin edit to Landing hero quote appears on /en after revalidation', async ({ page }) => {
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

  // 4. Go to Globals → Landing (the consolidated homepage editor). The quote
  //    lives on the default-open hero tab as a textarea named `hero.quote`.
  await page.goto('/admin/globals/landing');
  const quoteInput = page.locator('textarea[name="hero.quote"]');
  await expect(quoteInput).toBeVisible({ timeout: 15_000 });

  // 5. Capture original value so we can restore it later. The assertion
  //    targets only the appended MARKER (not the full edited string): the
  //    stored quote may contain *asterisk* accent markup that the renderer
  //    strips, so raw-input vs rendered-text would mismatch — the marker
  //    itself is asterisk-free and renders verbatim.
  const original = (await quoteInput.inputValue()).trim();
  const marker = `(e2e ${Date.now()})`;
  const edited = `${original} ${marker}`;

  try {
    // 6. Edit + save.
    await quoteInput.fill(edited);
    // Payload's Save button — text is locale-dependent but data-action is stable in v3.
    const saveBtn = page
      .locator('button[type="submit"]')
      .filter({ hasText: /save|guardar/i })
      .first();
    await saveBtn.click();
    // Wait for Payload's success toast (event-based, not a fixed sleep). The
    // admin UI language may be es or en, so match both toast wordings.
    await expect(
      page.getByText(/successfully|con éxito|actualizado/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // 7. Reload the public home and assert the marker renders inside the <h1>.
    await page.goto('/en');
    const heroHeading = page.locator('h1.hero-cine-quote-h1');
    await expect(heroHeading).toContainText(marker, { timeout: 15_000 });
  } finally {
    // 8. Restore the original quote (always — even if assertions failed — so
    //    the next test run starts from a clean state).
    await page.goto('/admin/globals/landing');
    await expect(page.locator('textarea[name="hero.quote"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('textarea[name="hero.quote"]').fill(original);
    const saveBtn = page
      .locator('button[type="submit"]')
      .filter({ hasText: /save|guardar/i })
      .first();
    await saveBtn.click();
    await expect(
      page.getByText(/successfully|con éxito|actualizado/i).first()
    ).toBeVisible({ timeout: 15_000 });
  }
});
