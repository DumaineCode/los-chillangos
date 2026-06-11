import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * Marquee global — the scrolling neighborhoods strip under the hero.
 *
 * Replaces the legacy `marquee` next-intl string. A single localized line; the
 * frontend duplicates it to create the seamless scroll.
 */
export const Marquee: GlobalConfig = {
  slug: 'marquee',
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  fields: [
    {
      name: 'text',
      type: 'text',
      localized: true,
      admin: {
        description:
          'Scrolling strip text, e.g. "Coyoacán · Roma Norte · Condesa · …". End with " ·" for a clean loop.',
      },
    },
  ],
};
