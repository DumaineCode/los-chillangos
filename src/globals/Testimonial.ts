import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * Testimonial global — homepage featured guest quote.
 *
 * Replaces the legacy `testimonial` next-intl namespace. `avatar` is optional;
 * when empty the frontend renders the legacy CSS placeholder circle.
 */
export const Testimonial: GlobalConfig = {
  slug: 'testimonial',
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
      admin: { description: 'Small label, e.g. "Notes from guests".' },
    },
    {
      name: 'quote',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'name',
      type: 'text',
      admin: { description: 'Guest name, e.g. "Hana K.".' },
    },
    {
      name: 'loc',
      type: 'text',
      localized: true,
      admin: { description: 'Location / date line, e.g. "Brooklyn, NY · Mar 2026".' },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Guest photo. If empty, a placeholder circle is shown.' },
    },
  ],
};
