import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * SocialLinks global — URLs to brand social profiles.
 *
 * All fields non-localized (URLs are the same regardless of UI locale) and
 * optional (client can leave channels they don't use blank).
 */
export const SocialLinks: GlobalConfig = {
  slug: 'social-links',
  label: { en: 'Social links', es: 'Redes sociales' },
  admin: {
    group: NAV_GROUPS.settings,
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  fields: [
    {
      name: 'instagram',
      type: 'text',
      label: { en: 'Instagram', es: 'Instagram' },
      admin: { description: { en: 'Full profile URL.', es: 'URL completa del perfil.' } },
    },
    {
      name: 'tiktok',
      type: 'text',
      label: { en: 'TikTok', es: 'TikTok' },
      admin: { description: { en: 'Full profile URL.', es: 'URL completa del perfil.' } },
    },
    {
      name: 'youtube',
      type: 'text',
      label: { en: 'YouTube', es: 'YouTube' },
      admin: { description: { en: 'Full channel URL.', es: 'URL completa del canal.' } },
    },
    {
      name: 'facebook',
      type: 'text',
      label: { en: 'Facebook', es: 'Facebook' },
      admin: { description: { en: 'Full page URL.', es: 'URL completa de la página.' } },
    },
  ],
};
