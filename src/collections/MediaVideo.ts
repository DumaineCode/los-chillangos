import type { CollectionConfig } from 'payload';

/**
 * MediaVideo collection — video uploads for the homepage hero.
 *
 * Deliberately SEPARATE from `Media`: video assets must NOT enter the
 * `sharp`/WebP `imageSizes` pipeline (sharp cannot process video and would
 * produce sizeless documents + broken admin thumbnails). Keeping a dedicated
 * collection also leaves every image picker (about/tour/avatar) clean.
 *
 * Storage swap (filesystem vs R2) is configured in `payload.config.ts` via the
 * `s3Storage` plugin (env-gated on `MEDIA_STORAGE`), mirroring `media`. This
 * file only defines the schema; there are NO imageSizes by design.
 */
export const MediaVideo: CollectionConfig = {
  slug: 'mediaVideo',
  admin: {
    useAsTitle: 'filename',
  },
  access: {
    // Public read so the hero <video> can fetch the asset via the storage
    // adapter (filesystem in dev, R2 public URL in prod).
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Accessibility: short description of the video content.',
      },
    },
  ],
  upload: {
    // Accept common web-deliverable video formats. NO imageSizes — sharp is
    // never invoked on these uploads.
    mimeTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  },
};
