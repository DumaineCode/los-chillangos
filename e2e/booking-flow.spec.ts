import { expect, test } from '@playwright/test';

/**
 * Booking happy path — 4 steps → assert the confirm CTA `href` is either a
 * `https://wa.me/` deep link (when ContactInfo.whatsapp is set) or a
 * `mailto:` URL (when only ContactInfo.email is set). Either is correct per
 * the SDD spec — both are valid intent channels.
 *
 * Precondition: at least one published tour (`ebike-classic`). The seed
 * leaves all 6 tours as drafts; a human must publish ONE via /admin before
 * this spec runs. The booking page itself falls back to the first published
 * tour if `?tour=` doesn't resolve, so the slug is best-effort.
 *
 * Date selection picks a future Tuesday inside the current month view —
 * Tuesdays are guaranteed open (Mondays are closed by design). If the
 * current view has no future Tuesday, we click the "next month" button.
 */
test('booking flow advances through 4 steps and resolves a deep link', async ({ page }) => {
  await page.goto('/en/book?tour=ebike-classic');

  // Step 1 is rendered.
  await expect(page.getByTestId('booking-step-1')).toBeVisible();

  // Pick a future, non-Monday day. Available cells render with
  // `class="cal-day available"` (see MiniCalendar.tsx).
  let availableCells = page.locator('button.cal-day.available:not(.disabled)');
  let count = await availableCells.count();
  if (count === 0) {
    // Jump to next month and try again.
    await page.getByRole('button', { name: /next/i }).click();
    availableCells = page.locator('button.cal-day.available:not(.disabled)');
    count = await availableCells.count();
  }
  expect(count).toBeGreaterThan(0);

  // Pick the FIRST available cell that's not a Monday. The button's
  // aria-label is `date.toDateString()` (e.g. "Tue May 26 2026").
  let picked = false;
  for (let i = 0; i < count; i++) {
    const cell = availableCells.nth(i);
    const aria = (await cell.getAttribute('aria-label')) ?? '';
    if (!aria.startsWith('Mon')) {
      await cell.click();
      picked = true;
      break;
    }
  }
  expect(picked).toBe(true);

  // Click the first time slot.
  await page.locator('button.timeslot').first().click();

  // Advance to step 2.
  await page.getByTestId('booking-next').click();
  await expect(page.getByTestId('booking-step-2')).toBeVisible();

  // Bump adults from 2 → 2 (default already 2; ensure +1 works without exceeding).
  // Default is 2 adults, 0 teens (per BookingFlow.tsx). Keep as-is.
  // Just click Next.
  await page.getByTestId('booking-next').click();
  await expect(page.getByTestId('booking-step-3')).toBeVisible();

  // Step 3 — fill name + email, leave WhatsApp empty.
  await page.getByLabel(/full name/i).fill('Hana Kobayashi');
  await page.getByLabel(/^email$/i).fill('hana@example.com');
  await page.getByTestId('booking-next').click();
  await expect(page.getByTestId('booking-step-4')).toBeVisible();

  // Step 4 — confirm link is an <a> with a wa.me OR mailto: href.
  const confirm = page.getByTestId('booking-confirm');
  await expect(confirm).toBeVisible();
  const href = (await confirm.getAttribute('href')) ?? '';
  expect(href).toMatch(/^(https:\/\/wa\.me\/|mailto:)/);

  // Do NOT click the link — opening WhatsApp on the test runner is a
  // dead-end. Asserting the href is enough proof of intent generation.
});
