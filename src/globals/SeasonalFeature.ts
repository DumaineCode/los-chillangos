import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * SeasonalFeature global — owner-controlled pointer to the active seasonal tour.
 *
 * The active seasonal experience is selected MANUALLY (not date-based): the
 * owner toggles `enabled` and points `featuredSeasonalTour` at a published
 * seasonal tour. When disabled or unset, the landing renders no highlight.
 *
 * The relationship returns a shallow doc at depth:1, so consumers re-fetch the
 * featured tour explicitly at depth:2 to hydrate seasonal media (see
 * `src/lib/seasonal/getActiveSeasonalTour.ts`).
 */
export const SeasonalFeature: GlobalConfig = {
  slug: 'seasonalFeature',
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show the seasonal highlight on the landing page.',
      },
    },
    {
      name: 'eyebrow',
      type: 'text',
      localized: true,
      admin: {
        description: 'Small label above the highlight, e.g. "This season".',
      },
    },
    {
      name: 'featuredSeasonalTour',
      type: 'relationship',
      relationTo: 'tours',
      hasMany: false,
      admin: {
        description: 'The seasonal tour to highlight. Must be published and marked seasonal.',
      },
    },
  ],
};
