import type { CollectionConfig } from 'payload';

import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Media collection — uploads.
 *
 * Storage swap (filesystem vs R2) is configured in `payload.config.ts` via the
 * `s3Storage` plugin (env-gated on `MEDIA_STORAGE`). This file only defines the
 * schema and image-size pipeline.
 *
 * Image sizes per design (PR 4 will consume them via next/image):
 *   - thumbnail (400w)  → grid hover preview
 *   - card (768w)       → tour-card hero on Home grid
 *   - hero (1600w)      → detail-page hero
 *
 * All sizes ship as WebP for bandwidth (lossless `sharp` re-encode).
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: { en: 'Image', es: 'Imagen' },
    plural: { en: 'Images', es: 'Imágenes' },
  },
  admin: {
    useAsTitle: 'filename',
    group: NAV_GROUPS.media,
  },
  access: {
    // Public read so <next/image> can fetch media via the storage adapter
    // (filesystem in dev, R2 public URL in prod).
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: { en: 'Alt text', es: 'Texto alternativo' },
      admin: {
        description: {
          en: 'Accessibility: short description of the image content.',
          es: 'Accesibilidad: descripción corta de lo que muestra la imagen.',
        },
      },
    },
    {
      // Live, component-accurate crop preview driven by focalX/focalY. Renders
      // the four canonical site frames so the editor can pick a focal point that
      // survives every cover crop. Registered in the generated importMap.
      name: 'focalPreview',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/admin/FocalPreviewField',
        },
      },
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
    // Explicit (Payload defaults this to true when imageSizes are defined).
    // Self-documents that focalX/focalY drive cover framing via resolveMediaImage.
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: undefined,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'card',
        width: 768,
        height: undefined,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'hero',
        width: 1600,
        height: undefined,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: 85 } },
      },
    ],
  },
};
