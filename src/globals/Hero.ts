import type { GlobalConfig } from 'payload';

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
  ],
};
