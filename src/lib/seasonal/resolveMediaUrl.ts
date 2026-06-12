import type { Media, MediaVideo } from '../../payload-types';

/**
 * Extract a usable URL from a Payload upload relationship.
 *
 * Upload fields can arrive as `null`, an unhydrated numeric id, or a populated
 * `Media`/`MediaVideo` doc. Only a populated doc with a `url` yields a string;
 * everything else returns `null`. Pure and deterministic.
 */
export function resolveMediaUrl(
  value: number | Media | MediaVideo | null | undefined
): string | null {
  if (!value || typeof value === 'number') return null;
  return value.url ?? null;
}
