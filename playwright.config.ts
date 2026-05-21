import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

/**
 * Playwright E2E configuration.
 *
 * Reads `BASE_URL`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` from `.env`
 * via `dotenv/config` so specs can rely on `process.env.*` without a custom
 * loader.
 *
 * One-time setup (NOT run automatically):
 *   pnpm exec playwright install chromium
 *
 * That downloads the Chromium binary into the Playwright cache (~150 MB),
 * which lives outside the repo and is not committed.
 *
 * Chromium is the only enabled project for v1. Firefox + WebKit are kept as
 * commented examples for an easy uncomment-and-install later.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // To enable Firefox / WebKit, uncomment the lines below and run:
    //   pnpm exec playwright install firefox webkit
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
