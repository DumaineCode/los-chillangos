import type { FieldHook } from 'payload';

/**
 * Localized-name → stable display title resolution for the Extras collection.
 *
 * WHY THIS EXISTS
 * ---------------
 * `Extras.name` is `localized: true`. Payload's `admin.useAsTitle` pointed at a
 * localized field resolves the title PER LOCALE when it builds relationship
 * options, so a single extra appears twice (es + en) in the Tours → extras
 * `hasMany` dropdown — letting an editor add the same extra twice.
 *
 * Per the Payload v3.84 guidance ("if useAsTitle points at a localized field,
 * extract the value into a virtual/stable field and use that as the title"),
 * we keep a NON-localized `title` column populated from `name`. A non-localized
 * column holds exactly ONE value per row, so the relationship dropdown lists
 * each extra exactly once regardless of the admin locale.
 *
 * `name` arrives in two shapes depending on how the document is written:
 *   - a plain string on a per-locale write (admin UI, `?locale=es`)
 *   - an `{ en, es, … }` object on an all-locales write (`req.locale === 'all'`,
 *     seed scripts, programmatic `payload.create` with the whole object)
 *
 * `resolveExtraTitle` collapses both shapes to a single string with the
 * preference order es → en → first non-empty locale value.
 */

type LocalizedName = string | Record<string, unknown> | null | undefined;

const PREFERRED_LOCALES = ['es', 'en'] as const;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Pick a single, stable display string from a (possibly localized) name.
 *
 * Pure function — deterministic, no side effects.
 */
export function resolveExtraTitle(name: LocalizedName): string {
  if (typeof name === 'string') {
    return name.trim();
  }

  if (!name || typeof name !== 'object') {
    return '';
  }

  for (const locale of PREFERRED_LOCALES) {
    const candidate = clean(name[locale]);
    if (candidate) {
      return candidate;
    }
  }

  for (const value of Object.values(name)) {
    const candidate = clean(value);
    if (candidate) {
      return candidate;
    }
  }

  return '';
}

/**
 * `beforeChange` field hook for the non-localized `title` column. Reads the
 * sibling localized `name` off `siblingData` and stores the resolved title so
 * the value is present in the DB column that `useAsTitle` reads.
 */
export const populateExtraTitle: FieldHook = ({ siblingData }) => {
  return resolveExtraTitle((siblingData as { name?: LocalizedName } | undefined)?.name);
};
