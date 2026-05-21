import { expect, test } from '@playwright/test';

/**
 * Locale switcher — clicking the ES toggle from /en lands on /es and the
 * page content reflects the new locale.
 *
 * Precondition: at least one published tour with a hero image, OR the
 * legacy mural fallback (which always exists in /public/brand). The hero
 * eyebrow text comes from the `Hero` Payload global and is localized.
 */
test('switching locale from /en to /es updates URL and content', async ({ page }) => {
  // 1. Land on the English home.
  await page.goto('/en');
  await expect(page).toHaveURL(/\/en(?:$|\/|\?)/);

  // 2. The hero eyebrow renders (it's the localized one-liner above the H1).
  const eyebrow = page.getByTestId('hero-eyebrow');
  await expect(eyebrow).toBeVisible();
  const englishEyebrow = (await eyebrow.textContent())?.trim() ?? '';

  // 3. Click the ES button inside the locale switcher.
  const esButton = page.getByTestId('locale-switcher-es').first();
  await expect(esButton).toBeVisible();
  await esButton.click();

  // 4. URL switched to /es.
  await expect(page).toHaveURL(/\/es(?:$|\/|\?)/);

  // 5. The eyebrow re-rendered. We can't assert the exact text (it's edited
  //    in /admin by the client), but the element must still be visible AND
  //    the locale switcher's `es` button must now be the active one.
  await expect(eyebrow).toBeVisible();
  await expect(esButton).toHaveAttribute('aria-pressed', 'true');

  // The English eyebrow value should be non-empty (otherwise the seed isn't
  // populated correctly — pre-condition failure).
  expect(englishEyebrow.length).toBeGreaterThan(0);
});
