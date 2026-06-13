import path from 'path';
import { fileURLToPath } from 'url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { buildConfig, type Plugin } from 'payload';
import sharp from 'sharp';

import { Users } from './collections/Users';
import { Media } from './collections/Media';
import { MediaVideo } from './collections/MediaVideo';
import { Tours } from './collections/Tours';
import { Bookings } from './collections/Bookings';
import { Navigation } from './globals/Navigation';
import { ContactInfo } from './globals/ContactInfo';
import { Hero } from './globals/Hero';
import { Marquee } from './globals/Marquee';
import { Values } from './globals/Values';
import { About } from './globals/About';
import { Testimonial } from './globals/Testimonial';
import { Services } from './globals/Services';
import { Team } from './globals/Team';
import { Faq } from './globals/Faq';
import { Footer } from './globals/Footer';
import { SocialLinks } from './globals/SocialLinks';
import { Branding } from './globals/Branding';
import { SeasonalFeature } from './globals/SeasonalFeature';
import { EmailContent } from './globals/EmailContent';

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
          mediaVideo: {
            disablePayloadAccessControl: true,
            // Mirror `media`: serve hero videos from R2_PUBLIC_URL since the
            // S3 endpoint is upload-only.
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
    components: {
      graphics: {
        Logo: '/components/admin/AdminLogo',
      },
    },
  },
  collections: [Users, Media, MediaVideo, Tours, Bookings],
  globals: [
    Navigation,
    ContactInfo,
    Hero,
    Marquee,
    Values,
    About,
    Testimonial,
    Services,
    Team,
    Faq,
    Footer,
    SocialLinks,
    Branding,
    SeasonalFeature,
    EmailContent,
  ],
  localization: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    fallback: true,
  },
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
