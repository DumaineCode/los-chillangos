# Exploration — unify-tour-gallery

## Goal (context)

For **standard (non-seasonal) tours**, merge the separate `heroImage` upload field
and the `gallery` array into a single ordered gallery where **position 1 = cover/main
image**. Seasonal tours are OUT OF SCOPE — `seasonal.hero` supports video + poster
(cinematic) and stays as-is.

## Key finding

The tour **detail page already renders hero + gallery as one ordered strip**
(`[heroMedia, ...galleryMedia]`, hero = position 1, capped at 5 tiles). The merge
mostly **formalizes an existing UI convention** into the data model. The two real
cost centers are:

1. The required-on-publish rule (`validateHeroImage`) → must become
   "gallery non-empty for standard publish".
2. A **destructive Postgres migration** (copy each `heroImage` into `gallery[0]`,
   then drop the column) — must run via `payload migrate` in prod, not dev push.

## Affected map (path → role → impact)

| File | Role | Impact |
|---|---|---|
| `src/collections/Tours.ts` (:334 heroImage, :350 gallery) | schema | Remove `heroImage`; `gallery` becomes the ordered source; position 1 = cover. Both gated by `isStandardFieldVisible`. |
| `src/lib/seasonal/fieldVisibility.ts` | validation | `validateHeroImage`/`isHeroImageRequired` → replace with gallery-non-empty-on-standard-publish. `isStandardFieldVisible` stays. |
| `src/lib/seasonal/cardThumbnail.ts` | card thumb | `selectCardThumbnail` reads `tour.heroImage` first → change to `gallery[0].image`, keep seasonal fallbacks. |
| `src/components/TourCard.tsx` | home card | Consumes cardThumbnail; no direct change beyond helper. |
| `app/[locale]/tours/[slug]/page.tsx` (:86-91) | detail | Already unifies hero+gallery; simplify to iterate single `gallery`. Local `resolveMedia`/`GalleryTile` at file bottom. |
| `src/hooks/revalidateTours.ts` | cache | Field-agnostic — no change. |
| `src/lib/media/resolveMediaImage.ts` + `focal.ts` | focal | Per-image focal preserved when hero→gallery[0]. No change. |
| `src/components/admin/FocalPreviewField.tsx` | admin preview | Frame-agnostic — unaffected. |
| `src/payload.config.ts` (:177) | db | postgres, no explicit `push`/`migrationDir` → **needs a real prod migration**. |
| `payload-types.ts` | types | Auto-regenerated via `pnpm generate:types`; don't hand-edit. |
| `scripts/seed.ts` (:9,250) | seed | Comments about "heroImage required" need updating; seed doesn't populate gallery. |
| Tests: `page.focal.test.tsx`, `TourCard.test.tsx`, `cardThumbnail.focal.test.ts`, `fieldVisibility.test.ts`, `capacity.test.ts:34` | tests | Fixtures use `heroImage` — rewrite to single ordered gallery. |

## Risks

- **CRITICAL (migration):** dropping `heroImage` is destructive. Two-step: copy
  `heroImage`→`gallery[0]` first, drop column later. Run via `payload migrate` in
  prod (not dev push).
- **WARNING (name collision):** `globals/Landing.ts` and `app/[locale]/page.tsx:211`
  also have a `heroImage` — that is the **LANDING hero, NOT a tour**. Out of scope;
  easy to touch by mistake.
- **WARNING (publish rule):** keep draft skip-validation so seeded drafts still save;
  scope the new "gallery non-empty" rule to standard + publish only.
- **SUGGESTION:** "position 1 = cover" is a UI convention — add an admin description
  and a min-1 validator for standard publish.

## Migration decision (from user)

- Data migration IS performed automatically (copy `heroImage` → `gallery[0]`) so no
  tour loses its current cover.
- The client reorders the final order by hand via the admin drag & drop afterward.

## Next

`sdd-proposal`
