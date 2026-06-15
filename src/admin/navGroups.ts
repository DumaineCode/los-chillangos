/**
 * Centralized admin navigation groups.
 *
 * Payload's sidebar groups collections AND globals together by the *resolved*
 * string of `admin.group` for the current UI language (see
 * `@payloadcms/ui` → `groupNavItems`: it matches existing groups by translated
 * label, regardless of entity type). Sharing ONE constant per group guarantees
 * a collection and a global land under the SAME heading — a typo or a duplicated
 * inline object would silently split them into two separate groups.
 *
 * Each value is an { en, es } translation object so the heading follows the
 * admin's i18n language (Spanish for the client, English for the dev/team).
 *
 * Group ORDER in the sidebar: a group appears at the position of its first
 * entity while iterating `[...collections, ...globals]`. Collections are always
 * iterated before globals, so the registration order in `payload.config.ts`
 * (collections: [Tours, Bookings, Users, Media, MediaVideo]) yields:
 *   Sitio web → Operación → Configuración → Biblioteca de medios.
 */
export const NAV_GROUPS = {
  /** Day-to-day content the client edits often: home page + tours. */
  site: { en: 'Website', es: 'Sitio web' },
  /** Operational data: bookings. */
  operations: { en: 'Operations', es: 'Operación' },
  /** Rarely-touched site settings + account: contact, footer, social, brand, emails, users. */
  settings: { en: 'Settings', es: 'Configuración' },
  /** Uploaded asset libraries: images + videos. */
  media: { en: 'Media library', es: 'Biblioteca de medios' },
} as const;
