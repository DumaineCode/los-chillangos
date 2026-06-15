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
  // Consolidated into the `landing` global; hidden from the nav but kept
  // registered so its data survives as migration source + rollback.
  admin: { hidden: true },
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
      // Structural (NOT localized): chooses the hero background medium.
      // Additive & backward-compatible — pre-existing records default to
      // 'image' and keep rendering `heroImage`.
      name: 'mediaType',
      type: 'select',
      defaultValue: 'image',
      options: [
        { label: 'Image', value: 'image' },
        { label: 'Video', value: 'video' },
      ],
      admin: {
        description: 'Choose the hero background medium.',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        condition: (data) => data?.mediaType !== 'video',
      },
    },
    {
      // Structural (NOT localized): background video shown when mediaType=video.
      name: 'heroVideo',
      type: 'upload',
      relationTo: 'mediaVideo',
      admin: {
        condition: (data) => data?.mediaType === 'video',
        description:
          'Background video (muted, looping). Mobile/reduced-motion show the poster only.',
      },
    },
    {
      // Structural (NOT localized): first-paint (LCP) poster + mobile/reduced-motion still.
      name: 'posterImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        condition: (data) => data?.mediaType === 'video',
        description:
          'Poster: first paint (LCP) + mobile/reduced-motion still. Strongly recommended.',
      },
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
