import type { GlobalConfig } from 'payload';

/**
 * Footer global — bottom-of-page link columns + tease copy + copyright.
 *
 * `columns` is an array of column blocks, each with a title and a list of
 * links. Seed creates 3 columns: Tours, Company, Help — matching the legacy
 * `data.js` shape.
 */
export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'tease',
      type: 'text',
      localized: true,
      admin: {
        description: 'Main tease line, e.g. "Come ride with us.".',
      },
    },
    {
      name: 'teaseEm',
      type: 'text',
      localized: true,
      admin: {
        description: 'Emphasized (italic) tease, e.g. "CDMX is waiting.".',
      },
    },
    {
      name: 'cta',
      type: 'text',
      localized: true,
    },
    {
      name: 'copyright',
      type: 'text',
      localized: true,
    },
    {
      name: 'columns',
      type: 'array',
      labels: { singular: 'Column', plural: 'Columns' },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          localized: true,
        },
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
            },
          ],
        },
      ],
    },
  ],
};
