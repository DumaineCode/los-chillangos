import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Branding global — site-wide brand assets managed from the admin panel.
 *
 * The logo is the SAME image regardless of scroll position (no more over-hero
 * swap). Two slots are provided so the client can supply a logo tuned for
 * light surfaces and one for dark surfaces (e.g. the footer); when a slot is
 * empty the frontend falls back to the bundled `/brand/*.png` assets so the
 * site never renders without a logo.
 */
export const Branding: GlobalConfig = {
  slug: 'branding',
  label: { en: 'Logo & brand', es: 'Logo y marca' },
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
      name: 'logoLight',
      type: 'upload',
      relationTo: 'media',
      label: { en: 'Light logo', es: 'Logo para fondos claros' },
      admin: {
        description: {
          en: 'Primary logo shown in the top navigation (over light surfaces).',
          es: 'Logo principal que se muestra en el menú de arriba (sobre fondos claros).',
        },
      },
    },
    {
      name: 'logoDark',
      type: 'upload',
      relationTo: 'media',
      label: { en: 'Dark logo', es: 'Logo para fondos oscuros' },
      admin: {
        description: {
          en: 'Logo used over dark surfaces such as the footer. Falls back to the primary logo.',
          es: 'Logo para fondos oscuros, como el pie de página. Si está vacío, se usa el logo principal.',
        },
      },
    },
    {
      name: 'logoAltText',
      type: 'text',
      localized: true,
      label: { en: 'Logo alt text', es: 'Texto alternativo del logo' },
      admin: {
        description: {
          en: 'Accessible alt text for the logo. Defaults to "Los Chillangos".',
          es: 'Texto alternativo (accesibilidad) del logo. Por defecto: "Los Chillangos".',
        },
      },
    },
    {
      name: 'logoHeight',
      type: 'number',
      label: { en: 'Logo height', es: 'Altura del logo' },
      admin: {
        description: {
          en: 'Optional logo height in pixels for the nav (default 40).',
          es: 'Altura del logo en píxeles para el menú (por defecto 40). Opcional.',
        },
      },
    },
  ],
};
