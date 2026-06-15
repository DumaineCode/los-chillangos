import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * Services global — homepage "Beyond the tour" section (block 04).
 *
 * Replaces the legacy `services` next-intl namespace. Each item maps to one
 * service card; the frontend keeps the legacy decorative glyphs (↗ ◐ ✦).
 */
export const Services: GlobalConfig = {
  slug: 'services',
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
      admin: { description: 'Small label, e.g. "Beyond the tour".' },
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
    },
    {
      name: 'inquireCta',
      type: 'text',
      localized: true,
      admin: { description: 'Link label on each card, e.g. "Inquire →".' },
    },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Service', plural: 'Services' },
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
