# Tours Imagery Specification

## Purpose

Define the imagery model for **standard (non-seasonal) tours**: a single ordered
`gallery` array is the source of truth, where the first item (`gallery[0]`) is the
cover/main image. This spec formalizes an already-existing UI convention (the detail
page renders hero + gallery as one ordered strip) into the data model, and defines the
behavior everywhere the cover is consumed, the publish-time quality rule, the admin
experience, and the one-time data migration.

Scope is **standard tours only**. Seasonal tours (`seasonal.hero`, video + poster) and
the Landing global `heroImage` are explicitly out of scope and MUST remain unchanged.

## Requirements

### Requirement: Single ordered gallery is the source of truth for standard tours

A standard (non-seasonal) tour MUST expose exactly one ordered `gallery` array as the
single source of truth for its imagery. The standard `heroImage` field MUST NOT exist on
standard tours. `gallery[0]` (position index 0, the first item) MUST be treated as the
cover/main image. Each gallery item MUST carry an `image` upload relating to the `media`
collection. The gallery MUST remain gated by `isStandardFieldVisible` (visible only for
standard tours). There MUST be no upper limit on the number of gallery items.

#### Scenario: Standard tour has a gallery and no hero field

- GIVEN a standard (non-seasonal) tour
- WHEN its schema/document shape is inspected
- THEN it exposes a `gallery` array whose items each have an `image` upload to `media`
- AND it exposes NO standalone `heroImage` field
- AND the first gallery item (`gallery[0]`) is the cover/main image

#### Scenario: No upload cap on the gallery

- GIVEN a standard tour being edited
- WHEN the editor adds many images (e.g. 20) to the gallery
- THEN all images are accepted with no maximum-count validation error

#### Scenario: Gallery is hidden for seasonal tours

- GIVEN a seasonal tour
- WHEN the admin form is rendered
- THEN the standard `gallery` field follows existing `isStandardFieldVisible` gating and
  is not shown as the standard-tour imagery source

### Requirement: Cover resolves from gallery[0] on the tour card thumbnail

The card thumbnail selection (`selectCardThumbnail`) for a standard tour MUST resolve the
cover from `gallery[0].image` instead of the removed `heroImage`. Existing seasonal
fallback behavior in the thumbnail selector MUST be preserved unchanged. The per-image
focal point / `objectPosition` of the selected cover image MUST be preserved.

#### Scenario: Card thumbnail uses the first gallery image

- GIVEN a standard tour with a non-empty gallery
- WHEN its card thumbnail is selected for the home listing
- THEN the thumbnail resolves to `gallery[0].image`
- AND that image's focal point / `objectPosition` is applied

#### Scenario: Seasonal thumbnail fallbacks are unchanged

- GIVEN a seasonal tour
- WHEN its card thumbnail is selected
- THEN the existing seasonal fallback logic produces the same result as before this change

### Requirement: Tour detail page renders the single gallery in order

The tour detail page MUST render the standard tour's imagery by iterating the single
`gallery` array in stored order, with `gallery[0]` as the top/hero tile. The page MUST NOT
compose a separate `[hero, ...gallery]` strip. The existing display behavior that caps the
visible grid at 5 tiles MUST be preserved exactly — this change MUST NOT redesign how more
than 5 images are handled. The per-image focal point / `objectPosition` MUST be preserved
for every rendered image, including `gallery[0]`.

#### Scenario: Detail page renders gallery in order with cover on top

- GIVEN a standard tour whose gallery is `[A, B, C]`
- WHEN the detail page renders
- THEN image `A` (`gallery[0]`) is the top/hero tile
- AND `B` and `C` follow in stored order
- AND each image keeps its own focal point / `objectPosition`

#### Scenario: 5-tile display cap is preserved

- GIVEN a standard tour with more than 5 gallery images
- WHEN the detail page renders
- THEN it displays at most 5 tiles, matching the pre-change cap behavior exactly
- AND no new "show more than 5" behavior is introduced

### Requirement: Publishing a standard tour requires at least one gallery image

Validation MUST reject publishing a standard (non-seasonal) tour when its gallery has zero
images. The rule MUST be scoped to the exact condition **standard tour AND publish status**
(`_status === 'published'`). A standard tour saved as a **draft** with zero gallery images
MUST succeed (draft skip-validation preserved). Seasonal tours MUST NOT be subject to this
rule.

#### Scenario: Publish with empty gallery is rejected

- GIVEN a standard tour with zero gallery images
- WHEN it is saved with publish status (`_status = published`)
- THEN validation rejects the operation with a "gallery requires at least one image" error

#### Scenario: Publish with at least one image succeeds

- GIVEN a standard tour with one or more gallery images
- WHEN it is published
- THEN validation passes and the tour is published

#### Scenario: Draft with empty gallery saves

- GIVEN a standard tour with zero gallery images
- WHEN it is saved as a draft (`_status = draft`)
- THEN the save succeeds (draft skip-validation preserved)

#### Scenario: Seasonal tours are exempt from the gallery-min rule

- GIVEN a seasonal tour with zero standard-gallery images
- WHEN it is published
- THEN the standard gallery-min-1 rule does not apply and does not block the publish

### Requirement: Admin gallery field communicates the cover convention

The gallery field in the admin panel MUST present a localized (English and Spanish)
label/description that makes clear the first photo is the cover and that photos can be
reordered by drag & drop (e.g. *"The first photo is the cover — drag to reorder"* /
Spanish equivalent). No separate hero field MUST be shown for standard tours.

#### Scenario: Editor sees the cover-first guidance in both locales

- GIVEN an editor opening a standard tour in the admin panel
- WHEN the admin locale is English
- THEN the gallery field shows an English description stating the first photo is the cover
  and can be reordered by drag & drop
- AND WHEN the admin locale is Spanish
- THEN the equivalent Spanish description is shown

#### Scenario: No separate hero field in the admin form

- GIVEN a standard tour in the admin panel
- WHEN the form renders
- THEN there is a single gallery field and no standalone hero-image field

### Requirement: Migration prepends each former heroImage as gallery[0] for tours only

A data migration MUST ensure that after it runs, every standard tour that previously had a
`heroImage` has that same media as `gallery[0]`, prepended before any pre-existing gallery
items, with the remaining gallery order otherwise preserved and each image's focal point
preserved. Tours that had no `heroImage` MUST be left unchanged. No tour MUST lose its
cover. The migration MUST affect ONLY the `tours` collection and MUST NOT touch the Landing
global, which shares the field name `heroImage` but is a separate concept. The migration is
performed in a non-destructive-first sequence (backfill, then drop column) run via
`payload migrate`, not dev-mode schema push.

#### Scenario: Former hero becomes gallery[0], existing order preserved

- GIVEN a tour with `heroImage = H` and existing gallery `[G1, G2]`
- WHEN the migration runs
- THEN the resulting gallery is `[H, G1, G2]`
- AND `H`'s focal point is preserved

#### Scenario: Tour without heroImage is unchanged

- GIVEN a tour with no `heroImage` and gallery `[G1, G2]`
- WHEN the migration runs
- THEN the gallery remains `[G1, G2]`

#### Scenario: No tour loses its cover

- GIVEN any set of pre-existing standard tours that each had a `heroImage`
- WHEN the migration completes
- THEN every such tour has a non-empty gallery whose `gallery[0]` is its former `heroImage`

#### Scenario: Landing global is untouched by the migration

- GIVEN the Landing global also defines a `heroImage`
- WHEN the tour migration runs
- THEN the Landing global's `heroImage` value and shape are unchanged

## Acceptance Criteria

1. **One gallery, no hero (admin).** GIVEN a standard tour in the admin panel, WHEN the
   form renders, THEN there is exactly one `gallery` field, no standalone hero field, and
   the gallery carries a localized (en/es) description stating the first photo is the cover
   and can be reordered by drag & drop.
2. **Migration prepends former hero.** GIVEN pre-existing standard tours, WHEN the migration
   completes, THEN every tour that had a `heroImage` has that media as `gallery[0]` prepended
   before existing items (focal point preserved), tours without a `heroImage` are unchanged,
   and the `heroImage` column no longer exists on tours.
3. **Publish requires ≥1, draft does not.** GIVEN a standard tour with an empty gallery,
   WHEN published THEN validation rejects it; WHEN saved as a draft THEN it succeeds.
4. **No upload cap.** GIVEN a standard tour, WHEN the editor adds an arbitrarily large
   number of gallery images, THEN there is no maximum-count validation error.
5. **Cover consumption unchanged in behavior.** GIVEN a standard tour, WHEN the home card
   thumbnail and the detail page render, THEN the thumbnail resolves from `gallery[0].image`
   and the detail page renders the single ordered gallery with `gallery[0]` on top; existing
   seasonal thumbnail behavior and the detail-page 5-tile display cap are unchanged; every
   image (including `gallery[0]`) keeps its focal point / `objectPosition`.
6. **Seasonal untouched.** GIVEN a seasonal tour, WHEN it is edited, published, or its
   thumbnail is selected, THEN `seasonal.hero` (video + poster) and all seasonal behavior
   are unchanged and the standard gallery-min-1 rule does not apply to it.
7. **Landing global untouched.** GIVEN the Landing global `heroImage`, WHEN the tour changes
   and migration are applied, THEN the Landing global's `heroImage` is unchanged in value and
   shape.
8. **Types regenerated, tests pass.** GIVEN the schema change, WHEN types are regenerated via
   dev `autoGenerate` / `payload build` (not hand-edited), THEN `payload-types.ts` reflects
   the single-gallery model and the affected fixtures/tests pass against it.
