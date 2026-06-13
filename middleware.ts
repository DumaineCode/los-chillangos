import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/**
 * next-intl middleware — handles locale detection, prefix enforcement, and
 * the `/` → `/en` redirect for visitors without a locale prefix.
 *
 * The matcher EXCLUDES every Payload route, Next internals, and static files:
 *   - `/admin/*` (Payload admin UI)
 *   - `/api/*`   (Payload REST + GraphQL endpoints)
 *   - `/next/*`  (Payload Live Preview entry — must NOT get a locale prefix,
 *     it carries its own `locale` query param and redirects to the localized
 *     tour route itself)
 *   - `/_next/*` and `/_vercel/*` (framework internals)
 *   - `/media/*` (Payload media uploads served by Payload)
 *   - any path containing a dot (favicon, images, fonts, etc.)
 */
export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|admin|next|_next|_vercel|media|.*\\..*).*)',
};
