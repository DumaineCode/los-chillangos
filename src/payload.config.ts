import path from 'path';
import { fileURLToPath } from 'url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { buildConfig, type Plugin } from 'payload';
import sharp from 'sharp';

import { Users } from './collections/Users';
import { Media } from './collections/Media';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/**
 * Resolve the storage plugin based on `MEDIA_STORAGE`.
 *
 * - `local` (or unset in dev): use Payload's built-in filesystem storage to
 *   `./media` at the repo root. No plugin returned.
 * - `r2`: configure `@payloadcms/storage-s3` against Cloudflare R2's
 *   S3-compatible API. ALL R2_* env vars must be present — fail loudly if not.
 *
 * This function only THROWS at startup when the user has explicitly opted into
 * R2 and forgotten a credential. Local development never touches R2 env vars.
 */
function resolveStoragePlugins(): Plugin[] {
  const mode = process.env.MEDIA_STORAGE?.trim().toLowerCase() || 'local';

  if (mode === 'local') {
    // Payload's default filesystem upload handler writes to the collection's
    // `staticDir` (resolved relative to repo root by Payload). We do NOT
    // override staticDir, so it defaults to `media/<collection-slug>/...`.
    return [];
  }

  if (mode === 'r2') {
    const required = {
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_BUCKET: process.env.R2_BUCKET,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => !v || !v.trim())
      .map(([k]) => k);

    if (missing.length > 0) {
      throw new Error(
        `[payload.config] MEDIA_STORAGE=r2 but the following env vars are missing or empty: ${missing.join(
          ', '
        )}. Either populate them or set MEDIA_STORAGE=local for dev.`
      );
    }

    const accountId = required.R2_ACCOUNT_ID as string;
    const publicUrl = (required.R2_PUBLIC_URL as string).replace(/\/$/, '');

    return [
      s3Storage({
        enabled: true,
        collections: {
          media: {
            disablePayloadAccessControl: true,
            // R2's S3 endpoint is upload-only; serve files from R2_PUBLIC_URL
            // (custom domain or *.r2.dev) via generateFileURL.
            generateFileURL: ({ filename: f, prefix }) => {
              const key = prefix ? `${prefix}/${f}` : f;
              return `${publicUrl}/${key}`;
            },
          },
        },
        bucket: required.R2_BUCKET as string,
        config: {
          credentials: {
            accessKeyId: required.R2_ACCESS_KEY_ID as string,
            secretAccessKey: required.R2_SECRET_ACCESS_KEY as string,
          },
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          forcePathStyle: true,
        },
      }),
    ];
  }

  throw new Error(
    `[payload.config] Unknown MEDIA_STORAGE value: "${mode}". Expected "local" or "r2".`
  );
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    // TODO(PR 3): import and register `Tours` here.
    // import { Tours } from './collections/Tours';
  ],
  // TODO(PR 3): register the 5 globals here:
  //   - Navigation, ContactInfo, Hero, Footer, SocialLinks
  // globals: [Navigation, ContactInfo, Hero, Footer, SocialLinks],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: resolveStoragePlugins(),
});
