# Apply Progress — unify-tour-gallery

Scope of this run: **PR #1 only** (code + non-destructive backfill). PR #2 (the
irreversible `DROP COLUMN`) was intentionally NOT implemented. Strict TDD
(RED → GREEN → TRIANGULATE → REFACTOR). Artifact store: openspec. No commit made.

## Post-review fixes (4R remediation run)

A completed 4R review flagged issues on the uncommitted PR #1 work; the following
targeted fixes were applied on top of the original implementation (no commit made):

- **FIX 1 (CRITICAL) — destructive `down()` in the backfill migration.** The old `down`
  removed `gallery[0]` for ANY tour whose `gallery[0].image === hero_image_id`, including
  editor-authored tours `up` never touched → silent data loss on rollback. Replaced with a
  SAFE non-destructive no-op that logs a clear warning
  (`down() is intentionally a no-op: backfill is not safely reversible; hero_image_id is
  retained for code rollback`) and returns without mutating data. Rationale encoded in the
  docstring: the backfill is not cleanly reversible without per-row tracking; PR #1 retains
  `hero_image_id`, so a code rollback recovers the cover via the old field, and the only
  residual effect is the former hero appearing first in `gallery` (benign).
- **FIX 2 (IMPORTANT) — single bad tour killed the whole backfill with poor diagnostics.**
  Each per-tour `payload.update` in `up` is now wrapped in try/catch; failures (id + message)
  are collected while the loop continues attempting the rest. After the loop, if any failures
  were collected, a single aggregated error listing ALL failed tour ids + messages is thrown.
  Atomicity is preserved — the throw still rolls back the Payload-managed transaction so the
  release fails loudly — but diagnostics are now complete. `req`-threading and the transaction
  are unchanged. Docstring updated.
- **FIX 3 (readability):**
  - (a) `src/collections/Tours.ts` gallery description Spanish copy `arrastrá` → tuteo
    `arrastra` (matches this file's local convention: `Agrega`, `Déjalo`, `Marca`, `Usa`).
    English unchanged.
  - (b) `app/[locale]/tours/[slug]/page.tsx` GalleryTile comment reworded from
    "the tile (hero AND every gallery image)" → "the tile (the cover — gallery[0] — AND
    every gallery image)".
  - (c) Extracted a local `toImageRows(gallery)` helper in the migration file, used by both
    directions (removed the duplicated gallery-normalization block). NOTE: after FIX 1 made
    `down` a no-op, only `up` still consumes it, but the helper stays as the single
    normalization point.
  - (d) `src/components/admin/FocalPreviewField.tsx` frame comment `gallery hero tile` →
    `gallery cover tile`.
- **FIX 4 (AC3 draft-save coverage gap — tracked, NOT faked):** added `H5` to tasks.md as an
  explicit DEFERRED-VERIFICATION item for a Playwright integration/e2e test proving
  (1) a standard tour DRAFT with empty gallery SAVES and (2) publishing a standard tour with
  empty gallery is REJECTED. See the Known coverage gaps section below.

### Known coverage gaps (deferred verification)

- **AC3 publish/draft scoping is not covered end to end.** The draft-frictionless behavior
  (a standard draft with an empty gallery must still save) relies ENTIRELY on Payload's
  `versions.drafts` config skipping field validation during draft saves — there is no
  automated test that exercises the real Payload save pipeline. The pure `validateStandardGallery`
  unit tests only prove the validator's return values, not that Payload actually skips it on
  draft. This CANNOT be honestly unit-tested (the skip lives in Payload's save pipeline, not
  in the validator). Tracked as tasks.md `H5` (Playwright integration/e2e). Until H5 lands,
  treat AC3's draft-save path as verified-by-config-only.

### Post-fix test/typecheck/lint results

- `pnpm test`: **69 files / 585 tests passed, 0 failed** (unchanged — fixes were migration
  logic + comments + copy, no test-observable behavior change; the migration has no live-DB
  unit test by design).
- `pnpm typecheck` (`tsc --noEmit`): **clean** (0 errors) — the new `toImageRows` helper and
  the narrowed `down({ payload })` signature typecheck.
- `pnpm lint` (`eslint .`): **0 errors**, 6 pre-existing `<img>` warnings (all in untouched
  test/admin files: `page.focal.test.tsx`, `page.test.tsx`, `tours/[slug]/page.focal.test.tsx`,
  `Footer.test.tsx`, `AdminIcon.tsx`, `AdminLogo.tsx`). None in files touched by this fix run.

### Guards held (fix run)

- `globals/Landing.ts`, `app/[locale]/page.tsx`, `app/[locale]/page.focal.test.tsx`: NOT in
  diff (`git status` clean for all three).
- No `DROP COLUMN` anywhere in `src/migrations/`; `hero_image_id` still read in `up` and
  retained as the safety net (the no-op `down` no longer references it).
- `seasonal.seasonalHero` behavior untouched — this fix run edited only `Tours.ts` (copy),
  `page.tsx` (comment), `FocalPreviewField.tsx` (comment), the migration, and the SDD docs.

## Status

- **PR #1: complete** (24/26 sub-tasks done; **E1 and E5 are PENDING-MANUAL** —
  they require a live Postgres/staging DB not available in this environment).
- **Ready for verify** (with the two PENDING-MANUAL migration items flagged for
  the human before the prod release step).
- **PR #2: not started** (out of scope for this run, by design).

## TDD Cycle Evidence

| Phase | What | Evidence |
|-------|------|----------|
| RED | Wrote/updated failing tests (batch A) then ran `pnpm test` | 4 test files failed for the right reasons: `validateStandardGallery`/`isStandardGalleryRequired` "is not a function"; `./prependHeroToGallery` "Failed to resolve import"; `cardThumbnail.focal` + `TourCard` asserted `gallery[0]` cover not yet read. **15 failed / 565 passed.** |
| GREEN | Implemented validators, pure helper, schema, consumers | `pnpm test` → **584 passed / 0 failed**. |
| TRIANGULATE | Added edge assertions: standard-publish-empty rejected, seasonal-publish-empty allowed, arbitrarily-large gallery (20) → no max-count (AC4), detail-page 5-tile cap (AC5) | `pnpm test` → **585 passed**. |
| REFACTOR | Tidied docstrings (cardThumbnail priority list, TourCard header, fieldVisibility module), removed dead `heroImage` refs, kept Payload type annotations on the `gallery` field/validator | `pnpm typecheck` clean; `pnpm test` → **585 passed**; eslint on changed files → 0 problems. |

## Test / command results

- `pnpm test` (RED): 15 failed / 565 passed (expected failures).
- `pnpm test` (final GREEN): **69 files / 585 tests passed, 0 failed.**
- `pnpm typecheck` (`tsc --noEmit`): **clean** (no errors).
- `pnpm exec eslint` on all changed source files: **exit 0**.
- `pnpm generate:types`: regenerated `src/payload-types.ts` (`Tour.heroImage` removed;
  `Tour.gallery` retained; `Landing.heroImage` preserved — verified line 1145 is inside
  `interface Landing`).

## Tasks completed vs pending

**Completed (checkboxes flipped to `- [x]` in tasks.md):**
- A1–A8 (RED tests; A7 = no shared fixture exists, each test file owns its factory — N/A confirmed).
- B1 (`fieldVisibility.ts`: `isStandardGalleryRequired` + `validateStandardGallery`, removed `isHeroImageRequired`/`validateHeroImage`), B2 (`prependHeroToGallery.ts` pure helper).
- C1 (deleted standard `heroImage` field), C2 (adapted `gallery` as single ordered source: localized labels + description, `validateStandardGallery`, no `maxRows`, `image` row `required`), C3 (copy cleanup: tab description, `photoDescription` "cover photo", header comment).
- D1 (`cardThumbnail.ts` reads `gallery[0].image`), D2 (`page.tsx` iterates single gallery, 5-tile cap, focal preserved).
- E2 (migration file created), E3 (`up`: raw SQL read of `hero_image_id` + Local API `payload.update`, order-preserving via `prependHeroToGallery`, idempotent skip, `req` threaded, per-tour logging), E4 (`down`: best-effort remove `gallery[0]` when it equals `hero_image_id`).
- F1 (`seed.ts` comments only), F2 (types regenerated).
- G1 (GREEN gate), G2 (TRIANGULATE), G3 (REFACTOR).
- H1 (Landing-untouched), H2 (Seasonal-untouched), H3 (Reversibility), H4 (budget).

**Pending — marked `- [~]` (require live DB, cannot run here):**
- **E1 (introspect DB with `\d tours` / `\d tours_gallery`)** — no live Postgres in this
  environment. The migration was written against the schema documented in design §4.2
  and deliberately writes gallery rows through the **Local API** (not raw SQL) precisely
  so it does not depend on the exact `tours_gallery.id`/`_order` internals. The raw SQL
  is read-only and touches only `tours.id` / `tours.hero_image_id` (stable columns).
  **ACTION FOR HUMAN:** confirm columns via `\d` before applying to any real DB.
- **E5 (apply + spot-check + idempotency re-run against staging)** — no live DB. The
  risky transform is fully unit-tested via A2/B2 (`prependHeroToGallery.test.ts`).
  **ACTION FOR HUMAN:** run `pnpm payload migrate` + `pnpm payload migrate:status` on
  staging, spot-check `[H, G1, G2]` ordering + focal preservation, then re-run to confirm
  the idempotent skip.

## Files changed

Modified:
- `src/lib/seasonal/fieldVisibility.ts` — swapped hero validators → gallery validators.
- `src/lib/seasonal/fieldVisibility.test.ts` — RED→GREEN suites + AC4 triangulation.
- `src/collections/Tours.ts` — removed `heroImage` field; adapted `gallery` (labels, localized description, `validateStandardGallery`, no `maxRows`); copy cleanup; import + header comment.
- `src/lib/seasonal/cardThumbnail.ts` — cover from `gallery[0].image`; docstring priority list.
- `src/lib/seasonal/cardThumbnail.focal.test.ts` — fixtures `heroImage` → `gallery[0].image`.
- `app/[locale]/tours/[slug]/page.tsx` — single-gallery iteration, dropped `heroMedia` spread.
- `app/[locale]/tours/[slug]/page.focal.test.tsx` — fixtures on `gallery[0]`; added 5-tile-cap test.
- `src/components/TourCard.tsx` — docstring (gallery[0]); `TourCard.test.tsx` — fixtures.
- `src/lib/booking/capacity.test.ts` — removed unrelated `heroImage: 1` fixture line.
- `src/payload-types.ts` — regenerated (never hand-edited).
- `scripts/seed.ts` — comments only.

New:
- `src/lib/tours/prependHeroToGallery.ts` — pure, order-preserving, idempotent transform.
- `src/lib/tours/prependHeroToGallery.test.ts` — 4 unit tests (AC2 risky logic).
- `src/migrations/20260713_000000_backfill_tour_hero_into_gallery.ts` — Step-1 backfill (non-destructive).
- `src/migrations/index.ts` — Payload migration barrel.

## Deviations from design

- **Migration scaffolding done by hand** instead of `pnpm payload migrate:create` (that
  command needs a live DB connection unavailable here). The file + `index.ts` barrel follow
  Payload's db-postgres conventions (`MigrateUpArgs`/`MigrateDownArgs`/`sql`, named barrel
  entry). Timestamp chosen: `20260713_000000`. **Re-run `migrate:create` or verify the
  timestamp ordering against existing prod migrations before release** if the prod DB already
  has migrations registered.
- No other deviations. `heroImage` column is intentionally retained (safety net for PR #2).

## Guard verification (H1–H3)

- **H1 Landing untouched:** `git status` shows `globals/Landing.ts`, `app/[locale]/page.tsx`,
  and `app/[locale]/page.focal.test.tsx` are NOT modified. Migration is table-scoped to
  `tours` / `tours_gallery`; `landing` table never referenced.
- **H2 Seasonal untouched:** no seasonal file modified; `seasonal.seasonalHero` (video +
  poster) unchanged; `validateStandardGallery` short-circuits (`return true`) for seasonal.
- **H3 Reversibility:** `grep DROP COLUMN src/migrations` → none. `hero_image_id` still exists
  (orphaned, intact) as the safety net. PR #2 owns the drop.

## Workload / PR boundary

- **PR #1 boundary:** everything in this run. Diff ≈ +162/−123 tracked + ~150 new-file lines
  ≈ **~285 net changed**, well under the 600-line budget (H4 ✓).
- **PR #2 (deferred):** `DROP COLUMN hero_image_id` — start only after PR #1's backfill is
  verified in prod and a `pg_dump` backup is taken.

## Structured status produced

- `applyState`: implemented (PR #1), 2 items PENDING-MANUAL (E1, E5 — live DB).
- `next_recommended`: `verify` (then human runs the staging migration for E1/E5 before the
  prod release step; no commit made — orchestrator handles commit after review).
- `actionContext`: no warnings; all edits within the authoritative workspace.

---

## Post-delivery note — migrations discarded (2026-07-14)

Context changed after implementation: there is no production database, dev uses
Payload/Drizzle `push` (not `migrate`), and existing dev tour data was disposable
test data. Running `pnpm dev` + accepting the schema push dropped `hero_image_id`
directly, WITHOUT the backfill (push and migrate are different mechanisms).

Decision (user-approved): the two migrations no longer fit this project's reality
and the backfill would FAIL if `payload migrate` ever ran (it references a column
`push` already dropped). Therefore removed:
- `src/migrations/20260713_000000_backfill_tour_hero_into_gallery.ts`
- `src/migrations/index.ts`
- `src/lib/tours/prependHeroToGallery.ts` (+ test) — only the backfill used it

The CODE change (unified gallery, gallery[0] = cover, min-1 publish validation,
consumer updates) stays and is live in dev. PR #2 (deferred drop) is abandoned —
the drop already happened via dev push. If a real prod is defined later, design a
fresh DB strategy then (push-from-scratch or freshly generated migrations).
