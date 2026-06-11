import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

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
      admin: {
        description: 'Primary logo shown in the top navigation (over light surfaces).',
      },
    },
    {
      name: 'logoDark',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Logo used over dark surfaces such as the footer. Falls back to the primary logo.',
      },
    },
    {
      name: 'logoAltText',
      type: 'text',
      localized: true,
      admin: {
        description: 'Accessible alt text for the logo. Defaults to "Los Chillangos".',
      },
    },
    {
      name: 'logoHeight',
      type: 'number',
      admin: {
        description: 'Optional logo height in pixels for the nav (default 40).',
      },
    },
  ],
};
