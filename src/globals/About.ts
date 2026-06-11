import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * About global — homepage "Our approach" editorial section (block 03).
 *
 * Replaces the legacy `editorial` next-intl namespace. `image` is an optional
 * upload; when empty the frontend renders the legacy CSS placeholder using
 * `imageLabel` as the caption.
 */
export const About: GlobalConfig = {
  slug: 'about',
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
      admin: { description: 'Small label, e.g. "Our approach".' },
    },
    {
      name: 'title',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'p1',
      type: 'textarea',
      localized: true,
      admin: { description: 'First paragraph.' },
    },
    {
      name: 'p2',
      type: 'textarea',
      localized: true,
      admin: { description: 'Second paragraph.' },
    },
    {
      name: 'meetCta',
      type: 'text',
      localized: true,
      admin: { description: 'Button label, e.g. "Meet the guides →".' },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Photo for the section. If empty, a placeholder is shown.' },
    },
    {
      name: 'imageLabel',
      type: 'text',
      localized: true,
      admin: {
        description: 'Caption shown over the placeholder when no image is uploaded.',
      },
    },
  ],
};
