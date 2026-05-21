import type { GlobalConfig } from 'payload';

/**
 * Navigation global — top-nav links + book CTA.
 *
 * Locked decision: globals are NOT localized at the global level; individual
 * fields toggle `localized: true` as needed. `href` is non-localized (same path
 * in both locales — the locale prefix lives in routing).
 */
export const Navigation: GlobalConfig = {
  slug: 'navigation',
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'links',
      type: 'array',
      labels: { singular: 'Link', plural: 'Links' },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'href',
          type: 'text',
          required: true,
          admin: {
            description:
              'Path or anchor (e.g. "tours", "about"). Locale prefix is added by routing.',
          },
        },
      ],
    },
    {
      name: 'bookCtaLabel',
      type: 'text',
      localized: true,
      admin: {
        description: 'Label for the primary "Book a tour" CTA in the nav.',
      },
    },
  ],
};
