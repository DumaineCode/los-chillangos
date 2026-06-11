import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * Hero global — homepage hero section content.
 *
 * The h1 is intentionally split into four parts (h1a..h1d) to preserve the
 * typography composition from the legacy `data.js`. PR 4 will compose them
 * back together with the original layout.
 */
export const Hero: GlobalConfig = {
  slug: 'hero',
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      localized: true,
    },
    {
      name: 'h1a',
      type: 'text',
      localized: true,
    },
    {
      name: 'h1b',
      type: 'text',
      localized: true,
    },
    {
      name: 'h1c',
      type: 'text',
      localized: true,
    },
    {
      name: 'h1d',
      type: 'text',
      localized: true,
    },
    {
      name: 'lede',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'ctaPrimary',
      type: 'text',
      localized: true,
    },
    {
      name: 'ctaGhost',
      type: 'text',
      localized: true,
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'live',
      type: 'text',
      localized: true,
      admin: {
        description: 'Top status line, e.g. "Live · CDMX · 19.43°N 99.13°W".',
      },
    },
    {
      name: 'estLabel',
      type: 'text',
      localized: true,
      admin: {
        description: 'Small label next to the neighborhoods, e.g. "Est. 2024".',
      },
    },
    {
      name: 'neighborhoods',
      type: 'text',
      localized: true,
      admin: {
        description: 'Neighborhoods line, e.g. "Roma · Condesa · Coyoacán · Centro".',
      },
    },
    {
      name: 'scroll',
      type: 'text',
      localized: true,
      admin: {
        description: 'Scroll hint at the bottom of the hero, e.g. "Scroll".',
      },
    },
    {
      name: 'stats',
      type: 'array',
      labels: { singular: 'Stat', plural: 'Stats' },
      maxRows: 4,
      admin: {
        description: 'The four stat blocks shown under the hero lede.',
      },
      fields: [
        {
          name: 'num',
          type: 'text',
          required: true,
          admin: { description: 'Big number, e.g. "12" or "3–4h".' },
        },
        {
          name: 'label',
          type: 'textarea',
          required: true,
          localized: true,
          admin: { description: 'Caption under the number. Line breaks are kept.' },
        },
      ],
    },
  ],
};
