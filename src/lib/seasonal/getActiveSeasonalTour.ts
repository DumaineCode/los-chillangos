import type { Payload } from 'payload';

import type { Locale } from '../../../i18n/routing';
import type { Landing, Tour } from '../../payload-types';

/**
 * Resolve the active seasonal tour for the landing page.
 *
 * Reads the `seasonal` tab of the consolidated `landing` global, then — only
 * when the feature is enabled and points at a tour — re-fetches that tour
 * explicitly at `depth: 2` so the seasonal hero/gallery/storytelling media URLs
 * hydrate (the relationship only returns a shallow doc at depth:1).
 *
 * The query additionally enforces `_status: published` and `isSeasonal: true`,
 * so an unpublished or de-seasonalized reference yields `null` and the landing
 * renders no highlight (zero layout shift).
 */
export async function getActiveSeasonalTour(
  payload: Payload,
  locale: Locale
): Promise<Tour | null> {
  const landing = (await payload
    .findGlobal({ slug: 'landing', locale, fallbackLocale: 'en' })
    .catch(() => null)) as Landing | null;

  const seasonal = landing?.seasonal;
  if (!seasonal?.enabled) return null;

  const ref = seasonal.featuredSeasonalTour;
  const id = typeof ref === 'number' ? ref : (ref?.id ?? null);
  if (id == null) return null;

  const { docs } = await payload.find({
    collection: 'tours',
    locale,
    fallbackLocale: 'en',
    where: {
      and: [
        { id: { equals: id } },
        { _status: { equals: 'published' } },
        { isSeasonal: { equals: true } },
      ],
    },
    limit: 1,
    depth: 2,
  });

  return docs[0] ?? null;
}
