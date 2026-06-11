import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * Faq global — homepage "Questions, answered" section (block 05).
 *
 * Replaces the legacy `faq` next-intl namespace. `items` is the ordered list of
 * question/answer pairs rendered by the FAQ accordion.
 */
export const Faq: GlobalConfig = {
  slug: 'faq',
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
      admin: { description: 'Small label, e.g. "Practical".' },
    },
    {
      name: 'title',
      type: 'text',
      localized: true,
    },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Question', plural: 'Questions' },
      fields: [
        {
          name: 'question',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'answer',
          type: 'textarea',
          required: true,
          localized: true,
        },
      ],
    },
  ],
};
