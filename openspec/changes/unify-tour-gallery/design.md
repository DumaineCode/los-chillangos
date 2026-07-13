# Design — unify-tour-gallery

Technical "how" for merging the standard tour `heroImage` upload field into the
`gallery` array as a single ordered source (position 0 = cover). Scope is
**standard (non-seasonal) tours only**. Seasonal (`seasonal.hero`) and the Landing
global `heroImage` are untouched.

Stack: Payload CMS 3.84.1, Next.js App Router, `@payloadcms/db-postgres`, pnpm,
TypeScript, Vitest.

---

## 0. Decisions summary (read first)

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| D1 | Min-1 publish rule location | **Field-level `validate` on the `gallery` array** | Mirrors the existing `validateHeroImage` pattern, colocated with the field, pure + unit-testable, and inherits Payload's draft skip for free. |
| D2 | Draft frictionlessness | **Rely on `versions.drafts` default `validate: false`** | `Tours.versions = { drafts: true }` has no `validate` override, so Payload skips ALL field validation on draft saves. Same mechanism the current hero validator already depends on. No new code needed. |
| D3 | Migration read of `heroImage` | **Raw SQL SELECT of `hero_image_id`** | The `heroImage` field is removed from the Payload schema in this change, so the Local API can no longer expose it. The DB column still exists until Step 2, so SQL reads it directly. |
| D4 | Migration write of `gallery[0]` | **Local API `payload.update`** (primary) | Payload owns the internal `tours_gallery` array-table shape (`_order`, generated row `id`, `_parent_id`, `image_id`). Writing through the Local API avoids hand-guessing that structure and stays correct across Payload minor versions. Raw-SQL relational fallback documented in §4.4. |
| D5 | Backfill transform testability | **Extract a pure `prependHeroToGallery(heroId, gallery)` helper** | Isolates the order-preserving + idempotent logic so it is Vitest-unit-testable without a live DB; the migration file stays a thin DB shell. |
| D6 | Seed behavior | **Keep seed tours as drafts; do NOT populate a gallery image** | Drafts skip the min-1 validate (D2), so empty-gallery drafts still seed. Seed has no real images; the client uploads + reorders in `/admin`. Only comments change. |
| D7 | Destructive drop timing | **Step 2 (DROP COLUMN) is a separate follow-up PR**, run only after Step 1 is verified in prod | Two-step safety. Removing the field from code does NOT require dropping the column — under `migrate` mode an unused column is harmless, which decouples the code deploy from the irreversible drop. |

---

## 1. Schema change — `src/collections/Tours.ts`

### 1.1 Remove the standard `heroImage` field (~:334)

Delete the entire `heroImage` upload field block (the one gated by
`isStandardFieldVisible`, currently `validate: validateHeroImage`). Do **not** touch
`seasonal.seasonalHero` or anything in `globals/Landing.ts`.

### 1.2 Adapt the `gallery` array (~:350) as the single ordered source

Keep the existing array; add a localized description that teaches the
position-0-is-cover convention, and attach the new publish validator (D1). Position 0
is the cover by convention — no structural cover flag.

```ts
{
  // STANDARD-ONLY single ordered source of tour imagery.
  // Position 0 = cover/main image (used by the card thumbnail and the detail-page
  // top tile). Hidden for seasonal tours, which use `seasonal.gallery`.
  name: 'gallery',
  type: 'array',
  labels: {
    singular: { en: 'Gallery image', es: 'Imagen de galería' },
    plural: { en: 'Gallery images', es: 'Imágenes de galería' },
  },
  admin: {
    condition: isStandardFieldVisible,
    description: {
      en: 'The tour photos. The first photo is the cover shown on the card and at the top of the tour page — drag to reorder.',
      es: 'Las fotos del tour. La primera foto es la portada que se ve en la tarjeta y arriba de la página del tour — arrastrá para reordenar.',
    },
  },
  // Min-1 on PUBLISH for standard tours only. Seasonal tours and drafts pass.
  // (Payload skips validation on draft saves; see fieldVisibility.ts.)
  validate: validateStandardGallery,
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true, // each row must reference an image (unchanged)
      label: { en: 'Image', es: 'Imagen' },
    },
  ],
}
```

### 1.3 Copy cleanup (same file)

- The **"Page content" tab** description mentions *"Hero image, gallery…"* — drop the
  hero mention: `en: 'Photo gallery and the detail-page copy…'`,
  `es: 'Galería de fotos y los textos de la página de detalle…'`.
- The **`photoDescription`** field copy says *"hero photo"* — reword to *"cover photo"*
  / *"foto de portada"* (it is a hint for the first uploaded image).
- The collection **header comment (~:28)** *"heroImage is a required field"* →
  *"the gallery must have at least one image to publish"*.

### 1.4 Why field-level `validate` and not a collection hook (D1 rationale)

A collection-level `validate`/`beforeValidate` would work but is heavier: it must
re-derive scoping, does not colocate with the field, and duplicates the exact shape the
existing code already proved out with `validateHeroImage`. The array field's `validate`
receives `(value, { data })` — `value` is the whole array and `data` is the document —
which is everything the min-1 + seasonal-scoping rule needs. It is also the **only**
option that inherits Payload's draft-skip automatically (D2), so drafts stay
frictionless with zero extra branching. Choose the field-level validator.

---

## 2. Validation — `src/lib/seasonal/fieldVisibility.ts`

Remove `isHeroImageRequired` and `validateHeroImage`. Add a gallery-non-empty rule with
the same seasonal scoping. Keep `isStandardFieldVisible` and the `SeasonalFlag` type
exactly as-is.

```ts
/**
 * Whether the standard gallery must be non-empty to publish.
 *
 * Required for standard tours (card + detail render `gallery[0]` / the gallery).
 * Not required for seasonal tours, which render `seasonal.seasonalHero` /
 * `seasonal.gallery` instead.
 */
export function isStandardGalleryRequired(data: SeasonalFlag): boolean {
  return !data?.isSeasonal;
}

/**
 * Payload `validate` for the standard `gallery` array.
 *
 * Returns `true` when the tour is seasonal (regardless of value), or when a standard
 * tour has at least one gallery row. Returns an error string when a standard/legacy
 * tour would publish with an empty gallery.
 *
 * Draft saves never reach this: `Tours.versions.drafts` has no `validate` override, so
 * Payload's default (`validateDrafts: false`) skips all field validation for drafts —
 * a standard draft with zero images still saves.
 *
 * `value` is the array field value; `args.data` is the whole document.
 */
export function validateStandardGallery(
  value: unknown,
  args: { data?: SeasonalFlag } | undefined
): true | string {
  if (!isStandardGalleryRequired(args?.data)) return true;
  if (!Array.isArray(value) || value.length === 0) {
    return 'Add at least one gallery image before publishing.';
  }
  return true;
}
```

Update the module docstring: replace `heroImage` references in the standard-only field
list with `gallery` as the single ordered source.

---

## 3. Consumer updates

### 3.1 Card thumbnail — `src/lib/seasonal/cardThumbnail.ts`

`selectCardThumbnail` reads `gallery[0].image` instead of `heroImage`; seasonal
fallbacks and null-safety preserved.

```ts
export function selectCardThumbnail(tour: Tour): ResolvedImage | null {
  // Position 0 of the standard gallery is the cover.
  const cover = resolveMediaImage(tour.gallery?.[0]?.image);
  if (cover) return cover;

  if (tour.isSeasonal === true) {
    const seasonalHero = tour.seasonal?.seasonalHero;
    return resolveMediaImage(seasonalHero?.image) ?? resolveMediaImage(seasonalHero?.poster);
  }

  return null;
}
```

Update the priority list in the docstring: `1. gallery[0].image` replaces
`1. heroImage`. `tour.gallery?.[0]?.image` is null-safe for empty/undefined galleries
(returns `undefined` → `resolveMediaImage` yields `null`).

### 3.2 Detail page — `app/[locale]/tours/[slug]/page.tsx` (~:86–91)

Drop the `heroMedia` composition; iterate the single gallery. `gallery[0]` is the top
tile. Keep the 5-tile cap and route every tile through `resolveMediaImage` (via
`GalleryTile`), which preserves per-image focal / `objectPosition`.

```ts
// gallery[0] is the cover/top tile; the grid reshapes to the real photo count.
// Capped at 5 (the grid's max layout). resolveMedia/GalleryTile keep focal points.
const galleryTiles: Media[] = (tour.gallery ?? [])
  .map((g) => resolveMedia(g.image))
  .filter((m): m is Media => Boolean(m?.url))
  .slice(0, 5);
```

Remove the now-unused `heroMedia` line and the `[heroMedia, ...galleryMedia]` spread.
The local `resolveMedia` helper and `GalleryTile` component at the file bottom are
unchanged. Update the inline comment that says *"Hero leads, then gallery photos"* →
*"First gallery photo leads (the cover), then the rest"*.

### 3.3 Seed — `scripts/seed.ts` (:9, :250)

Keep tours as **drafts** (D6). Only comments change:

- `:9` — *"Tours are created as DRAFTS because `heroImage` is required for publish"* →
  *"…because a standard tour needs at least one gallery image to publish and we don't
  seed real images."*
- `:250` — *"heroImage intentionally omitted — required for publish, not draft."* →
  *"gallery intentionally omitted — a non-empty gallery is required for publish, not for
  drafts. The client uploads photos in /admin."*

No `gallery` data is added. Drafts skip the min-1 validate (D2), so `pnpm seed` keeps
working unchanged.

### 3.4 Types — `payload-types.ts`

Regenerated, never hand-edited. The dev server (`typescript.autoGenerate` default true)
regenerates on config change; otherwise run `pnpm generate:types`. Expect `Tour` to lose
`heroImage` and keep `gallery`.

---

## 4. Postgres migration (CRITICAL)

### 4.1 How migrations are created/run here

`src/payload.config.ts` uses `postgresAdapter` with **no** `push` or `migrationDir`
override, and there is currently **no `src/migrations/` directory** — i.e. dev relies on
schema `push`. Production must NOT push. The migration workflow:

- **Create:** `pnpm payload migrate:create <name>` → scaffolds
  `src/migrations/<timestamp>_<name>.ts` (Payload also maintains an `index.ts` barrel).
  The default `migrationDir` for this project resolves to **`src/migrations`** (sibling
  of `payload.config.ts`).
- **Run:** `pnpm payload migrate` (applies pending), `pnpm payload migrate:status`,
  `pnpm payload migrate:down` (rollback last). Run these against prod with
  `NODE_ENV=production` and the prod `DATABASE_URL`.
- Each migration exports `up`/`down` typed from `@payloadcms/db-postgres`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
```

Add `src/migrations/` to the repo (committed) so prod applies exactly what was reviewed.

### 4.2 How Payload stores the relevant data (Postgres)

- `tours` table — one row per tour. `heroImage` (non-localized upload) is stored as a
  FK column **`hero_image_id`** → `media.id`. `_status` holds `draft`/`published`.
- `tours_gallery` table — the `gallery` array (non-localized), one row per image:
  - `_order` — integer, **1-indexed** row ordering within a parent.
  - `_parent_id` — FK → `tours.id`.
  - `id` — array row primary key (Payload-generated).
  - `image_id` — FK → `media.id` (the row's `image` upload).
- Landing's `heroImage` lives on the **`landing`** global table — a different table,
  never referenced by these migrations. Table scoping (`tours` / `tours_gallery` only)
  is what guarantees Landing is untouched.

> The exact column types/constraints of `tours_gallery.id` and `_order` MUST be
> confirmed by introspection (`\d tours_gallery`) before writing any raw SQL. The
> primary approach below (§4.4) writes through the Local API precisely to avoid
> depending on those internals.

### 4.3 Step 1 — Backfill (non-destructive)

**File:** `src/migrations/<ts>_backfill_tour_hero_into_gallery.ts`
**Goal:** for every `tours` row with a `hero_image_id`, prepend that image as
`gallery[0]`, preserving existing gallery order. Idempotent and re-runnable.

Pure transform (extracted to `src/lib/tours/prependHeroToGallery.ts`, D5):

```ts
/** Prepend the hero image id to a gallery, preserving order, idempotently. */
export function prependHeroToGallery(
  heroId: number,
  gallery: { image: number }[]
): { image: number }[] {
  if (gallery[0]?.image === heroId) return gallery; // already prepended → no-op
  return [{ image: heroId }, ...gallery];
}
```

Migration `up` (primary approach — SQL read + Local API write, D3/D4):

```ts
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // READ the soon-to-be-dropped column directly (Local API no longer exposes it).
  const { rows } = await db.execute<{ id: number; hero_image_id: number }>(
    sql`SELECT id, hero_image_id FROM tours WHERE hero_image_id IS NOT NULL`
  )

  for (const { id, hero_image_id } of rows) {
    // Read current gallery via the Local API (field still in schema post-change).
    const tour = await payload.findByID({ collection: 'tours', id, depth: 0, req })
    const current = (tour.gallery ?? []).map((g) => ({
      image: typeof g.image === 'object' ? g.image.id : g.image,
    }))

    const next = prependHeroToGallery(hero_image_id, current)
    if (next === current) continue // idempotent skip

    // WRITE via Local API so Payload manages tours_gallery (_order, row id, image_id).
    await payload.update({
      collection: 'tours',
      id,
      data: { gallery: next },
      depth: 0,
      req, // run inside the migration transaction
    })
  }
}
```

Notes:
- `req` threads the migration transaction → atomic; a failure rolls back cleanly.
- The min-1 validator passes for every affected tour (gallery becomes non-empty).
- `payload.update` on a published tour re-runs document validation; if any tour holds an
  unrelated invalid state the update fails loudly — desirable (surfaces bad data before
  the drop). Log per-tour progress so a failure is pinpointable.
- Idempotent: re-running skips tours already prepended, so a partial run is safe to
  resume.

`down` (reverse of Step 1 — best-effort): remove `gallery[0]` for tours whose
`gallery[0].image === hero_image_id`. Because Step 2 is a separate migration, Step 1's
`down` runs while `hero_image_id` still exists, so it can be validated against the column.

### 4.4 Step 1 raw-SQL fallback (reference / no-Local-API path)

If the Local API path is undesirable (e.g. to skip hooks/validation entirely), the
equivalent relational writes are — **only after confirming column defs via
introspection**:

```sql
-- 1) Shift every existing gallery row down by one (make room at position 1).
UPDATE tours_gallery SET _order = _order + 1
 WHERE _parent_id IN (SELECT id FROM tours WHERE hero_image_id IS NOT NULL);

-- 2) Insert the former hero at position 1 for each such tour.
--    <row-id-generation> MUST match tours_gallery.id's type/format (introspect first).
INSERT INTO tours_gallery (id, _order, _parent_id, image_id)
SELECT <row-id-generation>, 1, t.id, t.hero_image_id
  FROM tours t
 WHERE t.hero_image_id IS NOT NULL;
```

This is documented for completeness; the **Local API path (§4.3) is the recommended
approach** because it does not hardcode `tours_gallery.id`/`_order` semantics.

### 4.5 Step 2 — Drop column (destructive, follow-up)

**File:** `src/migrations/<ts>_drop_tour_hero_image.ts` — created and merged as a
**follow-up PR** (D7), run only after Step 1 is verified in prod and a DB backup is
taken.

```ts
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Table-scoped to `tours` — Landing's heroImage (landing table) is never touched.
  await db.execute(sql`ALTER TABLE tours DROP COLUMN IF EXISTS hero_image_id`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-add as nullable; the FK/data is NOT restored (backfill already moved it).
  await db.execute(sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS hero_image_id integer`)
}
```

**Backup:** take a snapshot / `pg_dump` of the `tours` table (or full DB) immediately
before running Step 2 — the drop is irreversible for the FK data.

---

## 5. Test strategy (Vitest — `pnpm test`)

| File | Change |
|------|--------|
| `src/lib/seasonal/fieldVisibility.test.ts` | Remove `isHeroImageRequired`/`validateHeroImage` suites. Add `isStandardGalleryRequired` (seasonal→false, standard/legacy→true) and `validateStandardGallery`: seasonal→`true` for any value; standard empty `[]`/`undefined`/`null`→error string; standard `[{image:1}]`→`true`. Keep `isStandardFieldVisible` suite. |
| `src/lib/seasonal/cardThumbnail.focal.test.ts` | Rewrite fixtures: `heroImage: media(...)` → `gallery: [{ image: media(...) }]`. Assert cover = `gallery[0]`, focal preserved, empty gallery falls through to seasonal fallback / `null`, standard-empty→`null`. Keep the seasonal-fallback and focal-default cases (now with empty gallery). |
| `app/[locale]/tours/[slug]/page.focal.test.tsx` | Update `makeTour` fixtures: drop `heroImage`, express the cover as `gallery[0]`. Assert `gallery[0]` is the top tile, 5-tile cap holds, per-tile `object-position` preserved. |
| `src/components/TourCard.test.tsx` | Fixtures `heroImage` → `gallery[0].image`; the FR-1 focal case and FR-5 no-image (empty gallery) case adjusted. |
| `src/lib/booking/capacity.test.ts` (:34) | Remove `heroImage: 1` from the tour fixture (or replace with `gallery: [{ image: 1 }]` if the builder requires imagery); unrelated to capacity logic. |
| **NEW** `src/lib/tours/prependHeroToGallery.test.ts` | Pure-function tests for the backfill transform (D5): prepends hero at index 0; preserves existing order; idempotent when `gallery[0].image === heroId`; empty gallery → single-element result. |

Do **NOT** modify `app/[locale]/page.focal.test.tsx` — its `heroImage` is the **Landing
home hero**, out of scope.

If a shared tour fixture/factory centralizes `heroImage`, update it once there.

Migration DB behavior is not unit-tested (no live DB in Vitest); the risky logic lives in
the pure `prependHeroToGallery` helper, which is. Verify the migration itself manually
against a staging DB (`migrate` + spot-check `gallery[0]`).

---

## 6. Rollout order

Preflight is **single-PR / 600-line budget**. The two-step migration means the
destructive DROP is intentionally a **follow-up PR** (D7) — the code change is one PR.

**PR #1 (this change — single PR):**
1. `src/collections/Tours.ts` — remove `heroImage`, adapt `gallery` + validator + copy.
2. `src/lib/seasonal/fieldVisibility.ts` — swap validators.
3. `src/lib/seasonal/cardThumbnail.ts`, `app/[locale]/tours/[slug]/page.tsx` — consumers.
4. `scripts/seed.ts` — comments only.
5. `src/lib/tours/prependHeroToGallery.ts` — new pure helper.
6. `src/migrations/<ts>_backfill_tour_hero_into_gallery.ts` — Step 1 (non-destructive).
7. Tests updated/added (§5). `payload-types.ts` regenerated.

**Deploy PR #1:** deploy code, then immediately `pnpm payload migrate` (runs Step 1).
Run migrate as part of the release so there is no visible window where the code reads
`gallery[0]` before the backfill has populated it. The `hero_image_id` column remains in
the DB, unused — harmless under `migrate` mode.

**Verify in prod:** every standard tour now has its former hero as `gallery[0]` (focal
preserved); publish is blocked on empty gallery; drafts still save empty; seasonal +
Landing unchanged.

**PR #2 (follow-up, after verification):**
1. Back up `tours` (`pg_dump` / snapshot).
2. `src/migrations/<ts>_drop_tour_hero_image.ts` — Step 2 (DROP COLUMN).
3. Deploy + `pnpm payload migrate` → drops `hero_image_id`.

**Call-out:** the single-PR preflight applies to the code change (PR #1). The
irreversible column drop is deliberately deferred to PR #2 so Step 1 can be verified in
prod first — this is a safety requirement, not a budget split.

---

## 7. Risks & mitigations

- **CRITICAL — destructive drop.** Mitigated by the two-step sequence (§4), Step-1
  idempotency, prod `migrate` (never dev `push`), pre-drop backup, and deferring the drop
  to PR #2 after verification.
- **WARNING — Landing collision.** All schema edits and both migrations are scoped to
  `tours` / `tours_gallery`; `app/[locale]/page.focal.test.tsx` and `globals/Landing.ts`
  are explicitly excluded. Landing's `landing.hero_image_id` is a different table.
- **WARNING — publish-rule scoping.** `validateStandardGallery` short-circuits on
  seasonal and relies on `versions.drafts` default `validate:false` for the draft skip —
  the same mechanism the current hero validator uses. Covered by unit tests.
- **SUGGESTION — convention discoverability.** Localized field description teaches
  "first photo is the cover — drag to reorder". Revisit if editors still find it unclear.
