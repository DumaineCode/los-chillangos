/**
 * Admin field-visibility predicates for the Tours collection.
 *
 * A seasonal tour replaces several standard fields with its own `seasonal`
 * group (cinematic hero, storytelling, gallery). Without these predicates the
 * admin form shows BOTH sets at once — the owner sees a duplicated hero, two
 * galleries, and standard storytelling fields that no longer apply.
 *
 * These pure functions back the collection's `admin.condition` and `validate`
 * hooks so the visibility/validation logic is unit-testable outside the Payload
 * admin (which cannot be rendered in vitest).
 */

/** Minimal shape the predicates read from the admin form `data`. */
type SeasonalFlag = { isSeasonal?: boolean | null } | null | undefined;

/**
 * Whether a STANDARD-ONLY field should be visible in the admin form.
 *
 * Standard-only fields (heroImage, photoDescription, standard gallery,
 * aboutP1/P2, headlineA/B) are replaced by the seasonal group, so they hide
 * for seasonal tours and stay visible for every standard/legacy tour — exactly
 * matching today's behavior when `isSeasonal` is false/unset.
 */
export function isStandardFieldVisible(data: SeasonalFlag): boolean {
  return !data?.isSeasonal;
}

/**
 * Whether `heroImage` must be present to publish.
 *
 * Required for standard tours (the detail layout + card read `heroImage`).
 * Optional for seasonal tours, which render `seasonal.seasonalHero` instead —
 * forcing `heroImage` would block publishing a perfectly valid seasonal tour.
 */
export function isHeroImageRequired(data: SeasonalFlag): boolean {
  return !data?.isSeasonal;
}

/**
 * Payload `validate` for `heroImage`.
 *
 * Returns `true` (valid) when the tour is seasonal regardless of value, or when
 * a standard tour actually has an upload. Returns an error string when a
 * standard/legacy tour is missing its hero image. A field hidden by
 * `admin.condition` still runs `validate` on publish, so this guard is what
 * actually unblocks publishing seasonal tours.
 *
 * Typed to match Payload's upload-field `validate` signature: the value is the
 * upload reference and `args.data` is the whole document being validated.
 */
export function validateHeroImage(
  value: unknown,
  args: { data?: SeasonalFlag } | undefined
): true | string {
  if (!isHeroImageRequired(args?.data)) return true;
  if (value === null || value === undefined) return 'Hero image is required.';
  return true;
}
