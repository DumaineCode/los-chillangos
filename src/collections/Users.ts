import type { CollectionConfig } from 'payload';

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
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email'],
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
};
