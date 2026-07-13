# Verify Report — unify-tour-gallery (PR #1)

## Overall: PASS_WITH_WARNINGS

PR #1 (code + non-destructive backfill) meets every acceptance criterion that can
be verified without a live Postgres DB. The warnings are **not defects** — they are
three already-tracked, environment-bound deferrals (E1, E5, H5) plus the prod
backfill run. PR #2 (`DROP COLUMN`) is intentionally out of scope and its absence is
NOT counted as a failure, per the delivery plan.

Artifact store: openspec. Strict TDD: not enforced by config (`strict_tdd: false`),
but the work was executed test-first (RED→GREEN→TRIANGULATE→REFACTOR evidence
present in apply-progress.md and cross-checked below).

---

## Reproduced verification commands

All three commands were re-run in this environment; the reported numbers match reality.

| Command | Reported | Reproduced | Result |
|---------|----------|------------|--------|
| `pnpm test` | 69 files / 585 passed, 0 failed | **69 files / 585 passed, 0 failed** (8.38s) | ✅ MATCH |
| `pnpm typecheck` (`tsc --noEmit`) | clean, 0 errors | **exit 0, 0 errors** | ✅ MATCH |
| `pnpm lint` (`eslint .`) | 0 errors, 6 pre-existing `<img>` warnings | **exit 0, 0 errors, 6 warnings** | ✅ MATCH |

The 6 lint warnings are all pre-existing `@next/next/no-img-element` in untouched
test/admin files (`page.focal.test.tsx`, `page.test.tsx`, `tours/[slug]/page.focal.test.tsx`,
`Footer.test.tsx`, `AdminIcon.tsx`, `AdminLogo.tsx`). None in files touched by this change.

---

## Per-acceptance-criterion findings

| AC | Status | Evidence |
|----|--------|----------|
| AC1 — one gallery, no hero (admin) | **MET** | `src/collections/Tours.ts:322-360`: standard `heroImage` upload block deleted; single `gallery` array retained with localized `admin.description` en/es "The first photo is the cover … drag to reorder" / "La primera foto es la portada … arrastra para reordenar"; `validate: validateStandardGallery` attached; row `image` `required: true`. `src/payload-types.ts`: `Tour.heroImage` removed (regenerated, not hand-edited). |
| AC2 — migration prepends former hero; no tour loses cover (PR #1 does NOT drop column) | **MET (PR #1 scope) / column-drop DEFERRED to PR #2 by design** | Pure transform `src/lib/tours/prependHeroToGallery.ts:14-17` order-preserving + idempotent, unit-tested `prependHeroToGallery.test.ts` (4 cases: prepend/preserve, empty→single, idempotent same-ref, hero-later). Migration `src/migrations/20260713_000000_backfill_tour_hero_into_gallery.ts`: `up` reads `hero_image_id` via read-only raw SQL, writes gallery via Local API with `req` threaded (atomic), idempotent skip, per-tour try/catch with aggregated throw. **Non-destructive `down()` is an intentional no-op** (lines ~110-124) — does NOT delete editor data on rollback. `hero_image_id` **retained** (`grep DROP COLUMN` → none). Column drop correctly deferred to PR #2 (P2-3), NOT flagged as failure. |
| AC3 — publish requires ≥1, draft saves with 0 | **PUBLISH-REJECT half MET; DRAFT-SAVE half DEFERRED (H5, tracked)** | Publish-reject IS covered: `validateStandardGallery` (`fieldVisibility.ts:53-61`) returns error string for standard `[]`/`null`/`undefined`; tests in `fieldVisibility.test.ts` assert exact `'Add at least one gallery image before publishing.'` for standard empty/null/undefined and legacy-null. Draft-save half rests on Payload `versions.drafts` (validation skipped on draft) — **not unit-testable in the pure validator**, tracked as `H5` Playwright e2e. Reported as DEFERRED, not a failure. |
| AC4 — no upload cap | **MET** | `Tours.ts:335` comment + config: **no `maxRows`** on the gallery array (`grep maxRows` → only the explanatory comment). Triangulation test `fieldVisibility.test.ts`: "passes for an arbitrarily large standard gallery (20 images) (AC4)". |
| AC5 — cover consumption unchanged (card + detail, focal, 5-cap) | **MET** | Card: `cardThumbnail.ts:20-23` resolves `tour.gallery?.[0]?.image` (null-safe), seasonal fallbacks preserved. Detail: `app/[locale]/tours/[slug]/page.tsx:86-92` drops the `[heroMedia, ...gallery]` spread, maps single `tour.gallery`, `.filter(url)`, `.slice(0,5)` (5-cap kept); `GalleryTile`/`resolveMediaImage` unchanged (focal preserved). Tests: `page.focal.test.tsx:117` per-tile focal incl. `gallery[0]`, `:137` caps at 5 tiles, `:150` null-focal → 50% 50%. |
| AC6 — seasonal untouched | **MET** | No seasonal file in diff; `seasonal.seasonalHero` untouched. `validateStandardGallery`/`isStandardGalleryRequired` short-circuit `return true`/`false` for `isSeasonal: true`; tests assert seasonal passes with `[]` and `undefined`. `cardThumbnail.ts` seasonal fallback branch unchanged. |
| AC7 — Landing global untouched | **MET** | `git status`/`git diff`: `src/globals/Landing.ts` and `app/[locale]/page.tsx` (home hero) NOT in the diff. `src/payload-types.ts:1145` `heroImage` remaining is inside `interface Landing` (correct — Landing keeps its own field). Migration is table-scoped to `tours`/`tours_gallery`; `landing` table never referenced (docstring lines 22-24). |
| AC8 — types regenerated, tests pass | **MET** | `payload-types.ts` regenerated (diff shows `Tour.heroImage` + `ToursSelect.heroImage` removed, `gallery` retained; Landing untouched) — mechanical, not hand-edited. All 585 tests pass against the single-gallery model. |

---

## Task checkbox status

**Unchecked implementation tasks in `tasks.md`:**
- `H5` (line 174) — DEFERRED-VERIFICATION Playwright e2e for AC3 draft/publish. **Known-acceptable deferral, tracked.** Not a PR #1 completeness blocker.
- `P2-1..P2-6` (lines 195-208) — all belong to **PR #2 (drop column)**, intentionally out of scope for PR #1.

**Partial (`- [~]`) tasks:**
- `E1` (line 123) — DB introspection (`\d tours`). PENDING-MANUAL (needs live Postgres).
- `E5` (line 138) — staging migrate + idempotency spot-check. PENDING-MANUAL (needs live DB).

No unchecked task within PR #1's committed-code scope remains. The only unchecked
PR #1 item (H5) is an explicitly deferred integration test, not a code gap.

---

## Strict TDD / assertion-quality audit

Strict TDD is not config-enforced, but a TDD cycle table is present and cross-checks out:
- RED evidence (15 failed / 565 passed for the right reasons) is consistent with the
  new symbols (`validateStandardGallery`, `prependHeroToGallery`) and gallery[0] reads.
- Assertion quality is **sound**: validator tests assert concrete return values
  (`true` / exact error string), the pure-transform test asserts structural equality
  AND reference identity for the idempotent no-op (`.toBe(gallery)`), detail-page tests
  assert real `object-position` styles and tile counts. No tautologies, ghost loops,
  type-only, or smoke-only tests found in the changed suites.
- The one honest gap (AC3 draft-save via Payload pipeline) was **not faked** as a unit
  test — correctly pushed to H5. Good discipline.

## Review workload / PR boundary

Matches the forecast: chained PRs, `feature-branch-chain`, PR #1 = code + backfill only.
Diff ≈ +166/−126 tracked + ~2 new files (~285 net) — well under the 600-line budget.
No scope creep: no `DROP COLUMN`, `hero_image_id` retained as the safety net (H3 held).

---

## Blockers

**None blocking verify.** No CRITICAL or WARNING code defects found.

## Human must-do before prod (carry-over, not verify failures)

1. **E1** — run `\d tours` / `\d tours_gallery` against a real DB to confirm
   `hero_image_id`, `tours_gallery` shape before applying the migration.
2. **E5** — apply the migration on staging (`pnpm payload migrate` + `migrate:status`),
   spot-check `[H, G1, G2]` ordering + focal preservation, re-run for idempotency.
3. **Migration timestamp** — the migration file was hand-scaffolded (`20260713_000000`);
   verify timestamp ordering against existing prod migrations (or re-run `migrate:create`).
4. **Prod backfill** — on PR #1 release, run `pnpm payload migrate` immediately after
   deploy so no window exists where code reads `gallery[0]` before backfill populates it.
5. **H5** — land the Playwright e2e proving standard draft-with-empty-gallery SAVES and
   standard publish-with-empty-gallery is REJECTED (closes AC3's config-only draft path).
6. **PR #2** — only after PR #1's backfill is verified in prod: `pg_dump` backup, then
   `DROP COLUMN hero_image_id`.
