import type { CollectionConfig } from 'payload';

import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Users collection — Payload built-in auth.
 * Login email + password live here. `admin.user: 'users'` in payload.config.ts
 * points Payload's admin panel to this collection.
 *
 * PR 2: keeps it intentionally minimal (single `name` field beyond auth defaults).
 * Richer roles / RBAC can come later if needed (spec U4 says simple admin is enough).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: { en: 'User', es: 'Usuario' },
    plural: { en: 'Users', es: 'Usuarios' },
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email'],
    group: NAV_GROUPS.settings,
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', es: 'Nombre' },
    },
  ],
};
