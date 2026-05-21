# E2E tests (Playwright)

Three specs cover the SDD acceptance scenarios end-to-end:

- `locale-switcher.spec.ts` — `/en` → click ES toggle → `/es`, hero copy in Spanish
- `booking-flow.spec.ts` — happy path through the 4 booking steps; assert
  the confirm CTA `href` is a `https://wa.me/` or `mailto:` URL
- `admin-edit-revalidation.spec.ts` — log into `/admin`, edit `Hero.eyebrow`,
  reload `/en`, assert the new text appears

## One-time setup

```bash
pnpm exec playwright install chromium
```

That downloads the Chromium binary (~150 MB) into Playwright's cache. It
lives outside the repo and isn't committed.

## Run

```bash
pnpm e2e            # headless
pnpm e2e:ui         # interactive UI mode (recommended while iterating)
pnpm e2e:report     # open the last HTML report after a failed run
```

The Playwright config starts `pnpm dev` automatically via `webServer` and
reuses an already-running server on port 3000 if you launched one in another
terminal.

## Preconditions

1. **Database seeded.** `pnpm seed:admin && pnpm seed` must have run against
   the configured `DATABASE_URL`.
2. **At least one published tour.** The seed creates 6 tour DRAFTS — the
   booking and locale specs need ONE published tour with a hero image. To
   prepare:
   - Log into `/admin` (use `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`)
   - Open Tours → `ebike-classic`
   - Upload a hero image (any photo works)
   - Click **Publish**
     This is a manual step because Payload media uploads require a real file —
     we don't ship one in the repo.
3. **`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`.** The
   admin-edit spec reads them via `dotenv/config` (loaded in
   `playwright.config.ts`) and SKIPS itself with a clear console message if
   either is missing.

## CI notes

`playwright.config.ts` detects CI via `process.env.CI`:

- `retries: 2` (was `0` locally)
- `workers: 1` (deterministic)
- `reuseExistingServer: false` (always spin a fresh server)
- `reporter: [['html'], ['github']]` (PR annotations + artifact)

No GitHub Actions workflow ships in PR 6. Adding one is a future SDD.
