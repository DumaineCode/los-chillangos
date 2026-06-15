import type { GlobalAfterChangeHook } from 'payload';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Generic `afterChange` hook for Payload globals.
 *
 * Each global (`navigation`, `footer`, `contact-info`, `hero`, `social-links`)
 * gets a cache tag of the form `global:<slug>` so individual reads can opt in
 * to fine-grained invalidation. The hook also blasts the `/[locale]` page
 * since most globals affect the layout chrome (nav, footer, hero).
 */
export const revalidateGlobalAfterChange: GlobalAfterChangeHook = ({
  global,
  doc,
  req,
  context,
}) => {
  // Standalone scripts (migrations, seeds) run OUTSIDE a Next.js request, where
  // next/cache's revalidateTag/revalidatePath throw `Invariant: static
  // generation store missing`. Those callers opt out via
  // `context: { skipRevalidate: true }` — ISR (`revalidate`) rebuilds the cache
  // on the next request anyway, so skipping here is safe.
  if (context?.skipRevalidate) {
    return doc;
  }
  try {
    if (global?.slug) {
      revalidateTag(`global:${global.slug}`);
    }
    revalidatePath('/[locale]', 'layout');
  } catch (err) {
    req.payload.logger?.warn?.(
      { err },
      '[revalidateGlobals/afterChange] revalidation skipped (likely outside request context)'
    );
  }
  return doc;
};
