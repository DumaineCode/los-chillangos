import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Visual refresh — hero CTA sizing (.btn-xl, scoped) + mobile 2x2 grid +
 * quote styling.
 *
 * Spec requirements covered:
 * - "CTA sizing (scoped)": hero CTAs use the new xl size (17px font) while
 *   `.btn-lg` OUTSIDE the hero keeps its computed size (no global ripple).
 * - "Mobile hero layout": at <=480px the 4 CTAs form a 2x2 grid with no
 *   horizontal overflow and all 4 remain tappable.
 * - "Hero quote": the quote is visible with clamp() sizing (22px cap on
 *   desktop, 16px floor on small viewports) and a small mono attribution.
 *
 * Requires a running dev server against a seeded database (`pnpm seed` —
 * the Landing hero row must have the 4 CTA labels and the quote populated).
 *
 * Run locally:
 *   pnpm e2e e2e/hero-responsive.spec.ts
 */

const MOBILE_WIDTHS = [480, 390] as const;

const heroCtas = (page: Page) => page.locator('.hero-cine-ctas a');

/** Groups pixel positions that sit within `tolerance` of each other. */
function distinctPositions(values: number[], tolerance = 4): number[] {
  const groups: number[] = [];
  for (const value of [...values].sort((a, b) => a - b)) {
    if (groups.length === 0 || value - groups[groups.length - 1] > tolerance) {
      groups.push(value);
    }
  }
  return groups;
}

async function boundingBoxes(locator: Locator, count: number) {
  const boxes = [];
  for (let i = 0; i < count; i += 1) {
    const box = await locator.nth(i).boundingBox();
    expect(box, `CTA ${i} should have a bounding box`).not.toBeNull();
    boxes.push(box!);
  }
  return boxes;
}

test.describe('hero CTA sizing (scoped .btn-xl)', () => {
  test('hero CTAs render at the xl size on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en');

    const ctas = heroCtas(page);
    await expect(ctas).toHaveCount(4);

    for (let i = 0; i < 4; i += 1) {
      await expect(ctas.nth(i)).toBeVisible();
      const fontSize = await ctas
        .nth(i)
        .evaluate((el) => getComputedStyle(el).fontSize);
      expect(fontSize, `hero CTA ${i} font size`).toBe('17px');
    }
  });

  test('.btn-lg outside the hero keeps its computed size (no ripple)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en');

    // Any .btn-lg that is NOT inside the hero CTA row — e.g. the tours
    // section CTA. Guards the "No global ripple" scenario.
    const outside = page.locator('.btn-lg:not(.hero-cine-ctas *)').first();
    await expect(outside).toBeVisible();

    const styles = await outside.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { fontSize: computed.fontSize, padding: computed.padding };
    });
    expect(styles.fontSize).toBe('15px');
    expect(styles.padding).toBe('18px 28px');
  });
});

for (const width of MOBILE_WIDTHS) {
  test.describe(`mobile hero layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 850 } });

    test('the 4 CTAs form a 2x2 grid, all tappable, no overflow', async ({
      page,
    }) => {
      await page.goto('/en');

      const ctas = heroCtas(page);
      await expect(ctas).toHaveCount(4);
      const boxes = await boundingBoxes(ctas, 4);

      // Geometry: exactly 2 rows and 2 columns.
      const rows = distinctPositions(boxes.map((b) => b.y));
      const columns = distinctPositions(boxes.map((b) => b.x));
      expect(rows, 'CTA rows').toHaveLength(2);
      expect(columns, 'CTA columns').toHaveLength(2);

      // Tappable: visible with a real hit area inside the viewport.
      for (const [i, box] of boxes.entries()) {
        await expect(ctas.nth(i)).toBeVisible();
        expect(box.height, `CTA ${i} tap height`).toBeGreaterThanOrEqual(40);
        expect(box.x, `CTA ${i} left edge`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `CTA ${i} right edge`).toBeLessThanOrEqual(
          width,
        );
      }

      // No horizontal overflow from the hero bottom block (quote + CTAs).
      // Scoped to the hero per spec ("CTAs display 2x2 without overflow") —
      // a pre-existing decorative seasonal stamp overflows the page body
      // outside the hero and is out of scope for this change.
      const bot = await page.locator('.hero-cine-bot').boundingBox();
      expect(bot).not.toBeNull();
      expect(bot!.x).toBeGreaterThanOrEqual(0);
      expect(bot!.x + bot!.width).toBeLessThanOrEqual(width);
    });

    test('the hero quote stays visible at the clamp() floor', async ({
      page,
    }) => {
      await page.goto('/en');

      const quote = page.locator('.hero-cine-quote blockquote');
      await expect(quote).toBeVisible();
      // clamp(16px, 2vw, 22px) floors at 16px on small viewports.
      const fontSize = await quote.evaluate(
        (el) => getComputedStyle(el).fontSize,
      );
      expect(fontSize).toBe('16px');
    });
  });
}

test.describe('hero quote styling', () => {
  test('quote uses clamp() cap and mono attribution on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en');

    const quote = page.locator('.hero-cine-quote blockquote');
    await expect(quote).toBeVisible();
    // clamp(16px, 2vw, 22px) caps at 22px once 2vw exceeds it (>=1100px).
    const quoteSize = await quote.evaluate(
      (el) => getComputedStyle(el).fontSize,
    );
    expect(quoteSize).toBe('22px');

    const caption = page.locator('.hero-cine-quote figcaption');
    await expect(caption).toBeVisible();
    const captionSize = await caption.evaluate(
      (el) => getComputedStyle(el).fontSize,
    );
    expect(captionSize).toBe('11px');
  });
});
