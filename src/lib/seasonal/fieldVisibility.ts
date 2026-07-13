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
 * Standard-only fields (the standard `gallery`, photoDescription, aboutP1/P2)
 * are replaced by the seasonal group, so they hide for seasonal tours and stay
 * visible for every standard/legacy tour — exactly matching today's behavior
 * when `isSeasonal` is false/unset.
 */
export function isStandardFieldVisible(data: SeasonalFlag): boolean {
  return !data?.isSeasonal;
}

/**
 * Whether the standard `gallery` must be non-empty to publish.
 *
 * Required for standard tours: the card thumbnail and the detail page render
 * `gallery[0]` (the cover) / the gallery as the single ordered image source.
 * Not required for seasonal tours, which render `seasonal.seasonalHero` /
 * `seasonal.gallery` instead — forcing a standard gallery would block publishing
 * a perfectly valid seasonal tour.
 */
export function isStandardGalleryRequired(data: SeasonalFlag): boolean {
  return !data?.isSeasonal;
}

/**
 * Payload `validate` for the standard `gallery` array.
 *
 * Returns `true` when the tour is seasonal (regardless of value), or when a
 * standard tour has at least one gallery row. Returns an error string when a
 * standard/legacy tour would publish with an empty gallery.
 *
 * Draft saves never reach this: `Tours.versions.drafts` has no `validate`
 * override, so Payload's default (`validateDrafts: false`) skips all field
 * validation for drafts — a standard draft with zero images still saves.
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
