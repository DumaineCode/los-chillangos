import { defineRouting } from 'next-intl/routing';

/**
 * i18n routing configuration.
 *
 * Locked decisions (see SDD tasks artifact #1608):
 *   - locales: ['en', 'es']
 *   - defaultLocale: 'en'  →  root `/` redirects to `/en`
 *   - localePrefix: 'always'  →  URLs are always prefixed (`/en/...`, `/es/...`)
 */
export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
