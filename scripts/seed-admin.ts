/**
 * Idempotent first-admin seed.
 *
 * Reads SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD from env.
 * Creates the admin user only if the `users` collection is empty.
 * Safe to re-run: if an admin already exists, exits 0 with a noop log.
 *
 * Run with: `pnpm seed:admin`
 *
 * NOTE: PR 3 will add a separate `scripts/seed.ts` for tours + globals.
 * Keep this file scoped to the admin user only.
 */
import 'dotenv/config';
import { getPayload } from 'payload';

import config from '../src/payload.config';

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!email || !password) {
    console.error(
      '[seed-admin] SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env. Aborting.'
    );
    process.exit(1);
  }

  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: 'users',
    limit: 1,
    pagination: false,
  });

  if (existing.docs.length > 0) {
    console.log('[seed-admin] Admin already seeded — at least one user exists. Nothing to do.');
    process.exit(0);
  }

  await payload.create({
    collection: 'users',
    data: {
      email,
      password,
      name: 'Admin',
    },
  });

  console.log(`[seed-admin] Created first admin user: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-admin] Failed:', err);
  process.exit(1);
});
