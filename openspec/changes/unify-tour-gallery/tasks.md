# Tasks — unify-tour-gallery

Merge the standard-tour `heroImage` upload into the `gallery` array as a single
ordered source (`gallery[0]` = cover). Scope is **standard (non-seasonal) tours
only**. Seasonal (`seasonal.seasonalHero`) and the Landing global `heroImage` are
untouched.

Delivery: **TWO PRs** (user-confirmed). PR #1 = code + non-destructive backfill
(reversible — `hero_image_id` column stays). PR #2 = deferred, irreversible
`DROP COLUMN`, run only after PR #1's backfill is verified in prod.

Strict TDD is active. Test runner: `pnpm test`. Sequence tasks
RED → GREEN → TRIANGULATE → REFACTOR. Types are regenerated via dev
`autoGenerate` / `pnpm generate:types` — **never hand-edit `payload-types.ts`**.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR #1 ≈ 320–420; PR #2 ≈ 20–40 (total ≈ 340–460) |
| 400-line budget risk | Medium (per-PR budget is 600; PR #1 fits) |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 (code + backfill) → PR #2 (drop column) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

Notes: the split is a **safety requirement** (defer the irreversible drop until the
backfill is verified in prod), not a line-budget split. Both PRs sit under the
600-line-per-PR budget. PR #1 must NOT drop `hero_image_id`; it stays as an orphaned
safety net until PR #2.

Acceptance criteria referenced below are AC1–AC8 from
`specs/tours/spec.md` § Acceptance Criteria.

---

## PR #1 — Code + backfill (reversible)

Dependency order: RED tests first → schema/validation/consumers (GREEN) →
helper + backfill migration → seed/copy → regen types → full green + guards.

### A. RED — write failing tests first

- [x] A1. `src/lib/seasonal/fieldVisibility.test.ts` — remove
  `isHeroImageRequired`/`validateHeroImage` suites; add RED suites for
  `isStandardGalleryRequired` (seasonal → `false`, standard/legacy → `true`) and
  `validateStandardGallery` (seasonal → `true` for any value; standard `[]`/`undefined`/`null`
  → error string; standard `[{image:1}]` → `true`). Keep `isStandardFieldVisible` suite. **(AC3, AC6)**
- [x] A2. `src/lib/tours/prependHeroToGallery.test.ts` (NEW) — RED unit tests for the
  pure backfill transform: prepends hero at index 0; preserves existing order; idempotent
  when `gallery[0].image === heroId`; empty gallery → single-element result. **(AC2)**
- [x] A3. `src/lib/seasonal/cardThumbnail.focal.test.ts` — rewrite fixtures
  `heroImage: media(...)` → `gallery: [{ image: media(...) }]`; assert cover =
  `gallery[0].image`, focal/`objectPosition` preserved, empty gallery falls through to
  seasonal fallback / `null`, standard-empty → `null`. Keep seasonal-fallback + focal-default
  cases (now with empty gallery). **(AC5, AC6)**
- [x] A4. `app/[locale]/tours/[slug]/page.focal.test.tsx` — update `makeTour` fixtures:
  drop `heroImage`, express cover as `gallery[0]`; assert `gallery[0]` is the top tile,
  5-tile cap holds, per-tile `object-position` preserved. **(AC5)**
- [x] A5. `src/components/TourCard.test.tsx` — fixtures `heroImage` → `gallery[0].image`;
  adjust the focal case and the no-image (empty gallery) case. **(AC5)**
- [x] A6. `src/lib/booking/capacity.test.ts` (:34) — remove `heroImage: 1` from the tour
  fixture (or replace with `gallery: [{ image: 1 }]` if the builder requires imagery);
  unrelated to capacity logic. **(AC8)**
- [x] A7. If a shared tour fixture/factory centralizes `heroImage`, update it once at the
  source so all consumers inherit the single-gallery shape. **(AC8)**
- [x] A8. Run `pnpm test` — confirm the new/updated specs FAIL for the right reason
  (RED gate). Do NOT proceed to GREEN until failures are the expected ones.

> Guard: do **NOT** modify `app/[locale]/page.focal.test.tsx` — its `heroImage` is the
> **Landing home hero**, out of scope. **(AC7)**

### B. GREEN — validation + pure helper

- [x] B1. `src/lib/seasonal/fieldVisibility.ts` — remove `isHeroImageRequired` and
  `validateHeroImage`; add `isStandardGalleryRequired(data)` and
  `validateStandardGallery(value, args)` per design §2 (seasonal short-circuit → `true`;
  standard empty → error string; else `true`). Keep `isStandardFieldVisible` and the
  `SeasonalFlag` type exactly. Update the module docstring: `heroImage` → `gallery` as the
  single ordered source. → makes A1 GREEN. **(AC3, AC6)**
- [x] B2. `src/lib/tours/prependHeroToGallery.ts` (NEW) — pure, order-preserving,
  idempotent `prependHeroToGallery(heroId, gallery)` per design §4.3. Annotate exported
  types explicitly. → makes A2 GREEN. **(AC2)**

### C. GREEN — schema

- [x] C1. `src/collections/Tours.ts` (~:334) — delete the entire standard `heroImage`
  upload field block (the one gated by `isStandardFieldVisible`, currently
  `validate: validateHeroImage`). Do NOT touch `seasonal.seasonalHero`. **(AC1)**
- [x] C2. `src/collections/Tours.ts` (~:350) — adapt the `gallery` array as the single
  ordered source: keep `condition: isStandardFieldVisible`; add localized (en/es)
  `labels` + `admin.description` teaching "the first photo is the cover — drag to reorder";
  attach `validate: validateStandardGallery`; keep the `image` upload row `required: true`;
  **no** `maxRows` (no upload cap). Position 0 = cover by convention, no structural cover
  flag. Annotate extracted field constants with the matching Payload type. **(AC1, AC4)**
- [x] C3. `src/collections/Tours.ts` copy cleanup (design §1.3): "Page content" tab
  description drop the hero mention; `photoDescription` "hero photo" → "cover photo" /
  "foto de portada"; header comment (~:28) "heroImage is a required field" → "the gallery
  must have at least one image to publish". **(AC1)**

### D. GREEN — consumers

- [x] D1. `src/lib/seasonal/cardThumbnail.ts` — `selectCardThumbnail` reads
  `resolveMediaImage(tour.gallery?.[0]?.image)` first; preserve seasonal fallbacks and
  null-safety; update the priority-list docstring (`1. gallery[0].image` replaces
  `1. heroImage`). → makes A3 GREEN. **(AC5, AC6)**
- [x] D2. `app/[locale]/tours/[slug]/page.tsx` (~:86–91) — drop the `heroMedia`
  composition and the `[heroMedia, ...galleryMedia]` spread; build `galleryTiles` by mapping
  the single `tour.gallery`, filtering to real URLs, `.slice(0, 5)` (keep the 5-tile cap).
  `gallery[0]` is the top tile. Leave `resolveMedia`/`GalleryTile` at file bottom unchanged
  (focal / `objectPosition` preserved). Update the inline comment "Hero leads, then gallery
  photos" → "First gallery photo leads (the cover), then the rest". → makes A4 GREEN. **(AC5)**

### E. GREEN — backfill migration (non-destructive, Tours-only)

- [~] E1. Introspect the DB before writing SQL: confirm `tours.hero_image_id`,
  `tours_gallery` (`_order` 1-indexed, `_parent_id`, `id`, `image_id`) via `\d tours` /
  `\d tours_gallery` (design §4.2). Landing lives on the separate `landing` table — never
  referenced. **(AC7)**
- [x] E2. Create the migration: `pnpm payload migrate:create backfill_tour_hero_into_gallery`
  → scaffolds `src/migrations/<ts>_backfill_tour_hero_into_gallery.ts` + `index.ts` barrel.
  Commit `src/migrations/` so prod applies exactly what was reviewed. **(AC2)**
- [x] E3. Implement `up` per design §4.3 (primary path): raw SQL
  `SELECT id, hero_image_id FROM tours WHERE hero_image_id IS NOT NULL`; per row read the
  current gallery via Local API (`payload.findByID`, `depth: 0`, thread `req`), compute
  `prependHeroToGallery`, skip on idempotent no-op, write via `payload.update`
  (`depth: 0`, thread `req` for transaction atomicity). Log per-tour progress. **Tours-only;
  never Landing.** **(AC2, AC7)**
- [x] E4. Implement `down` (best-effort reverse): remove `gallery[0]` for tours whose
  `gallery[0].image === hero_image_id`. Valid because `hero_image_id` still exists in PR #1. **(AC2)**
- [~] E5. Verify the migration manually against a staging DB (`pnpm payload migrate` +
  `pnpm payload migrate:status`); spot-check `[H, G1, G2]` ordering and focal preservation;
  re-run to confirm idempotency. Migration DB behavior is NOT unit-tested (no live DB in
  Vitest) — the risky logic is covered by A2/B2. **(AC2)**

### F. Supporting updates + regen

- [x] F1. `scripts/seed.ts` — comments only (design §3.3): `:9` and `:250` reword the
  "heroImage required" notes to "a non-empty gallery is required for publish, not drafts;
  client uploads photos in /admin". Keep seed tours as **drafts**; do NOT add gallery data
  (drafts skip min-1 validate). **(AC3)**
- [x] F2. Regenerate types: let dev `autoGenerate` produce them, or run
  `pnpm generate:types`. Confirm `Tour` loses `heroImage` and keeps `gallery`. **Never
  hand-edit `payload-types.ts`.** **(AC8)**

### G. GREEN gate + TRIANGULATE + REFACTOR

- [x] G1. Run `pnpm test` — all suites GREEN against the single-gallery model. **(AC8)**
- [x] G2. TRIANGULATE edge cases: standard draft with empty gallery saves; standard publish
  with empty gallery is rejected; seasonal publish with empty standard gallery is NOT
  blocked; arbitrarily large gallery (e.g. 20 images) has no max-count error. Add assertions
  where missing. **(AC3, AC4, AC6)**
- [x] G3. REFACTOR: tidy naming/docstrings, ensure Payload type annotations on extracted
  constants, remove dead `heroImage` references; keep tests green.

### H. Explicit verification guards (PR #1)

- [x] H1. **Landing-untouched guard.** Confirm `globals/Landing.ts`,
  `app/[locale]/page.tsx`, and `app/[locale]/page.focal.test.tsx` are NOT in the diff;
  the backfill migration touches only `tours` / `tours_gallery`. **(AC7)**
- [x] H2. **Seasonal-untouched guard.** Confirm `seasonal.seasonalHero` (video + poster)
  and seasonal fallback behavior are unchanged; `validateStandardGallery` short-circuits on
  seasonal. **(AC6)**
- [x] H3. **Reversibility guard.** Confirm PR #1 does NOT drop `hero_image_id` — the column
  still exists (orphaned, intact) after this PR as the safety net.
- [x] H4. Review budget check: PR #1 diff ≤ 600 lines.
- [ ] H5. **DEFERRED-VERIFICATION (integration/e2e — not a Vitest unit test).** Add a
  Playwright test that (1) saves a STANDARD tour DRAFT with an empty gallery and asserts
  it SAVES, and (2) attempts to PUBLISH a standard tour with an empty gallery and asserts
  it is REJECTED. This directly verifies AC3's publish/draft scoping, which currently
  rests ONLY on Payload's `versions.drafts` config (draft skips field validation) plus
  `validateStandardGallery` — there is no automated test proving the draft-save path end
  to end. Do NOT fake this as a unit test (the draft-skip lives in Payload's save
  pipeline, not in the pure validator). Tracked as a known coverage gap in
  apply-progress.md. **(AC3)**

**Deploy PR #1:** deploy code, then immediately run `pnpm payload migrate` (Step 1) as
part of the release so there is no window where the code reads `gallery[0]` before the
backfill populates it. `hero_image_id` remains unused/harmless under `migrate` mode.

---

## PR #2 — Drop column (irreversible, deferred)

Run ONLY after PR #1's backfill is verified in production. Depends on PR #1 being merged,
deployed, and its Step-1 migration applied + spot-checked in prod.

- [ ] P2-1. **Pre-drop backup.** Take a snapshot / `pg_dump` of the `tours` table (or full
  DB) immediately before running the drop — the FK data is irreversible once dropped.
- [ ] P2-2. Create the migration: `pnpm payload migrate:create drop_tour_hero_image` →
  `src/migrations/<ts>_drop_tour_hero_image.ts`. Commit it. **(AC2)**
- [ ] P2-3. Implement `up`: `ALTER TABLE tours DROP COLUMN IF EXISTS hero_image_id` —
  **explicitly table-scoped to `tours`**; Landing's `landing.hero_image_id` is a different
  table and MUST NOT be referenced. Implement `down`:
  `ALTER TABLE tours ADD COLUMN IF NOT EXISTS hero_image_id integer` (nullable; data NOT
  restored — backfill already moved it). **(AC2, AC7)**
- [ ] P2-4. Deploy + `pnpm payload migrate` → drops `hero_image_id`. Confirm with
  `pnpm payload migrate:status`. **(AC2)**
- [ ] P2-5. **Landing-untouched guard (drop).** Verify `landing.hero_image_id` is intact in
  value and shape after the drop. **(AC7)**
- [ ] P2-6. Post-drop verification: `Tour` schema/types no longer expose `heroImage`; every
  standard tour still has a non-empty gallery with the former hero at `gallery[0]`. **(AC2)**

---

## Acceptance criteria coverage map

| AC | Covered by |
|----|-----------|
| AC1 — one gallery, no hero (admin) | C1, C2, C3 |
| AC2 — migration prepends former hero; column dropped | A2, B2, E2–E5, P2-2..P2-6 |
| AC3 — publish requires ≥1, draft does not | A1, B1, F1, G2 |
| AC4 — no upload cap | C2, G2 |
| AC5 — cover consumption unchanged (card + detail, focal, 5-cap) | A3, A4, A5, D1, D2 |
| AC6 — seasonal untouched | A1, A3, B1, D1, H2, G2 |
| AC7 — Landing global untouched | E1, E3, H1, P2-3, P2-5 |
| AC8 — types regenerated, tests pass | A6, A7, F2, G1 |
