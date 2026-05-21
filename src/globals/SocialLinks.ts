import type { GlobalConfig } from 'payload';

/**
 * SocialLinks global — URLs to brand social profiles.
 *
 * All fields non-localized (URLs are the same regardless of UI locale) and
 * optional (client can leave channels they don't use blank).
 */
export const SocialLinks: GlobalConfig = {
  slug: 'social-links',
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'instagram',
      type: 'text',
    },
    {
      name: 'tiktok',
      type: 'text',
    },
    {
      name: 'youtube',
      type: 'text',
    },
    {
      name: 'facebook',
      type: 'text',
    },
  ],
};
