import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * Values global — homepage "Why us" section (block 01).
 *
 * Replaces the legacy `values` next-intl namespace. `items` is an ordered list
 * of value cells; the frontend numbers them 01, 02, … automatically.
 */
export const Values: GlobalConfig = {
  slug: 'values',
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
      admin: { description: 'Small label, e.g. "Why us".' },
    },
    {
      name: 'title',
      type: 'text',
      localized: true,
    },
    {
      name: 'sub',
      type: 'textarea',
      localized: true,
      admin: { description: 'Subheading shown to the right of the title.' },
    },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Value', plural: 'Values' },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          localized: true,
        },
      ],
    },
  ],
};
