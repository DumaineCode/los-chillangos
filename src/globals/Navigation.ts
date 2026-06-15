import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Navigation global — top-nav links + book CTA.
 *
 * Locked decision: globals are NOT localized at the global level; individual
 * fields toggle `localized: true` as needed. `href` is non-localized (same path
 * in both locales — the locale prefix lives in routing).
 */
export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: { en: 'Navigation menu', es: 'Menú de navegación' },
  admin: {
    group: NAV_GROUPS.settings,
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  fields: [
    {
      name: 'links',
      type: 'array',
      labels: {
        singular: { en: 'Link', es: 'Enlace' },
        plural: { en: 'Links', es: 'Enlaces' },
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          localized: true,
          label: { en: 'Label', es: 'Texto' },
        },
        {
          name: 'href',
          type: 'text',
          required: true,
          label: { en: 'Link', es: 'Destino' },
          admin: {
            description: {
              en: 'Path or anchor (e.g. "tours", "about"). Locale prefix is added by routing.',
              es: 'Ruta o ancla (ej.: "tours", "about"). El prefijo de idioma lo agrega el sitio automáticamente.',
            },
          },
        },
      ],
    },
    {
      name: 'bookCtaLabel',
      type: 'text',
      localized: true,
      label: { en: 'Book button label', es: 'Texto del botón de reservar' },
      admin: {
        description: {
          en: 'Label for the primary "Book a tour" CTA in the nav.',
          es: 'Texto del botón principal de "Reservar un tour" en el menú.',
        },
      },
    },
  ],
};
