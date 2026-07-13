# Proposal — unify-tour-gallery

## Problem statement

In the CMS, a **standard (non-seasonal) tour** currently exposes **two separate
concepts** for its imagery:

- a dedicated `heroImage` upload field, and
- a `gallery` array of images.

The client reasonably expects **one gallery where the first photo is the cover**.
Managing a "hero" separately from a "gallery" is a mental model mismatch: it forces
the editor to reason about two fields when they only ever think about "the tour's
photos, cover first".

Critically, the public tour detail page **already renders these as a single ordered
strip** — `[heroMedia, ...galleryMedia]`, with the hero as position 1. So the data
model is out of step with an existing UI convention. This change **formalizes that
existing convention into the data model** rather than inventing new behavior.

## Goals

1. Give standard tours **one ordered gallery** as the single source of truth for
   tour imagery, where **position 1 = cover/main image**.
2. Preserve every existing tour's current cover during the transition — **no tour
   loses its cover image**.
3. Make the "first photo is the cover" convention **obvious to the editor** in the
   admin panel.
4. Keep publish-time quality guarantees: a standard tour cannot be **published**
   without at least one image, while drafts stay frictionless.

## Non-goals

- **Seasonal tours.** `seasonal.hero` supports video + poster (cinematic) and is a
  deliberately different model. It stays as-is and is untouched.
- **The Landing / home global `heroImage`.** That is the site landing hero, **not a
  tour**. It shares the field name `heroImage` but is a completely separate concept.
  Do not touch it.
- **Redesigning the >5-photo display.** The detail-page grid currently caps at 5
  visible tiles. This change keeps that display behavior exactly as-is. How to show
  more than 5 gallery photos is deferred as an **open question for a future change**.

## In-scope changes

Scope is **standard (non-seasonal) tours only**. The full affected surface is mapped
in `explore.md`; the changes are:

1. **Schema (`src/collections/Tours.ts`).** Remove the standard `heroImage` field.
   The `gallery` array becomes the single ordered source; position 1 is the cover.
   Both remain gated by `isStandardFieldVisible`.
2. **Data migration (Postgres).** Automatically copy each existing standard tour's
   `heroImage` into `gallery` position 0, then drop the `heroImage` column. See the
   two-step migration approach below.
3. **Publish rule (`src/lib/seasonal/fieldVisibility.ts`).** Replace
   `validateHeroImage` / `isHeroImageRequired` with a **min-1 gallery validator**
   scoped to **standard tours at publish time**. Drafts keep skip-validation so a
   draft with zero images still saves. `isStandardFieldVisible` stays.
4. **Card thumbnail (`src/lib/seasonal/cardThumbnail.ts`).** `selectCardThumbnail`
   reads `gallery[0].image` instead of `tour.heroImage`; existing seasonal fallbacks
   are preserved.
5. **Detail page (`app/[locale]/tours/[slug]/page.tsx`).** Simplify to iterate a
   single `gallery` instead of composing `[hero, ...gallery]`. Display behavior
   (5-tile cap) is unchanged.
6. **Admin UX.** Add a clear label/description on the gallery field, e.g. *"The first
   photo is the cover — drag to reorder"*, so the position-1-is-cover convention is
   self-evident.
7. **No upload cap.** The editor can add as many photos as they want.
8. **Supporting updates.** Refresh `scripts/seed.ts` comments that reference
   "heroImage required", and regenerate `payload-types.ts` (never hand-edit — let dev
   `autoGenerate` or `payload build` produce it). Update the affected fixtures/tests
   listed in the explore map to use a single ordered gallery.

## Migration approach (two-step safety)

The migration is **destructive** (it ends by dropping a column), so it is deliberately
split into a **non-destructive-first** sequence and run through `payload migrate` in
production — **never** via dev-mode schema push.

- **Step 1 — Backfill (non-destructive).** For every standard tour, copy its
  `heroImage` value into `gallery[0]`, preserving the image reference and its per-image
  focal point. After this step both `heroImage` and the new `gallery[0]` coexist, so
  the change is fully reversible and no data is lost.
- **Step 2 — Drop column (destructive).** Once the backfill is verified, drop the
  `heroImage` column.

After migration, the client **reorders each tour's gallery by hand** via the admin
drag & drop to set the final cover/order. The migration only guarantees that the
former hero lands at position 1 so nothing is lost; it does not attempt to guess the
editor's preferred ordering.

## Business rules

- **Position 1 = cover.** For standard tours, `gallery[0]` is the cover/main image
  everywhere it is consumed (card thumbnail, detail page).
- **Publish requires ≥1 image.** A standard tour must have at least one gallery image
  to be **published**. The validator is scoped to **standard + publish** only.
- **Drafts stay frictionless.** A standard tour **draft** may be saved with zero
  gallery images (draft skip-validation is preserved).
- **No upload cap.** There is no maximum number of gallery images.
- **Seasonal untouched.** Seasonal tours keep `seasonal.hero` (video + poster) and are
  not subject to the new gallery rules.

## Affected surface

See `openspec/changes/unify-tour-gallery/explore.md` for the full path → role → impact
map. Headline surfaces: `src/collections/Tours.ts` (schema),
`src/lib/seasonal/fieldVisibility.ts` (validation), `src/lib/seasonal/cardThumbnail.ts`
(card thumb), `app/[locale]/tours/[slug]/page.tsx` (detail), a new Postgres migration,
`payload-types.ts` (regenerated), `scripts/seed.ts` (comments), and the fixture/test
set enumerated in the explore map.

## Risks

- **CRITICAL — Destructive migration.** Dropping `heroImage` is irreversible once
  Step 2 runs. Mitigation: the two-step, backfill-first sequence keeps Step 1 fully
  reversible; Step 2 only runs after the backfill is verified; run via `payload migrate`
  in prod, not dev push. Ensure a database backup precedes the destructive step.
- **WARNING — `heroImage` name collision with Landing.** `globals/Landing.ts` and
  `app/[locale]/page.tsx` also define a `heroImage`, but that is the **Landing hero, not
  a tour**. It is out of scope and easy to touch by mistake. All edits and the migration
  must be scoped to the tours collection only.
- **WARNING — Publish-rule scoping.** The new min-1 rule must be scoped to **standard
  tours at publish** only. If it leaks to drafts, seeded/in-progress drafts fail to
  save; if it leaks to seasonal, it breaks the seasonal model. Preserve draft
  skip-validation.
- **SUGGESTION — Convention discoverability.** "Position 1 = cover" is a UI convention,
  not enforced structurally. Mitigated by the admin label/description; if editors still
  find it unclear, revisit in a future change.

## Acceptance criteria

1. A standard tour edited in the admin panel shows **one gallery** and **no separate
   hero field**; the gallery field carries a description making clear the first photo is
   the cover and that it can be reordered by drag & drop.
2. After migration, **every pre-existing standard tour** has its former `heroImage` as
   `gallery[0]` (with its focal point preserved), and the `heroImage` column no longer
   exists.
3. Attempting to **publish** a standard tour with an empty gallery is **rejected** by
   validation; saving it as a **draft** with an empty gallery **succeeds**.
4. There is **no upper limit** on the number of gallery images a standard tour can have.
5. The home card thumbnail and the tour detail page render from `gallery[0]` / the
   single gallery respectively; existing seasonal behavior and the detail-page 5-tile
   display cap are **unchanged**.
6. Seasonal tours (`seasonal.hero`) and the Landing global `heroImage` are **unchanged**.
7. `payload-types.ts` is regenerated (not hand-edited) and the affected tests/fixtures
   pass against the single-gallery model.
