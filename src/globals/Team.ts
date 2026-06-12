import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * Team global — homepage "Our team" section (block 06).
 *
 * Each item renders as a circular profile photo + name + role. `name` is a
 * proper noun and intentionally NOT localized (same convention as the
 * Testimonial guest `name`); `role` is marketing copy and IS localized.
 * The `photo` upload is optional; when empty the frontend renders the legacy
 * CSS placeholder circle.
 */
export const Team: GlobalConfig = {
  slug: 'team',
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
      admin: { description: 'Small label, e.g. "The people".' },
    },
    {
      name: 'title',
      type: 'text',
      localized: true,
      admin: { description: 'Section heading, e.g. "Our team".' },
    },
    {
      name: 'sub',
      type: 'textarea',
      localized: true,
      admin: { description: 'Optional short intro under the heading.' },
    },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Member', plural: 'Members' },
      admin: { description: 'Add team members. Three look best in a row.' },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { description: 'Person name, e.g. "Diego R.".' },
        },
        {
          name: 'role',
          type: 'text',
          required: true,
          localized: true,
          admin: { description: 'Role / title, e.g. "Lead guide".' },
        },
        {
          name: 'photo',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Profile photo. If empty, a placeholder circle is shown.' },
        },
      ],
    },
  ],
};
