import type { CollectionConfig } from 'payload';

/**
 * Tours collection — the heart of the site catalog.
 *
 * Localization policy (locked in PR 3):
 *   - `slug` is NOT localized. Same slug serves both /en/tours/<slug> and
 *     /es/tours/<slug>. One row per tour, two locales.
 *   - `category`, `duration`, `distance`, `price`, `tagColor`, `languages`,
 *     itinerary `time` are non-localized (technical / shared values).
 *   - Everything user-facing copy is localized en/es.
 *
 * Drafts:
 *   - `versions.drafts: true` so the client can stage edits and publish.
 *   - Seed creates each tour as `_status: 'draft'` because `heroImage` is a
 *     required upload — the client uploads the photo later, then publishes.
 *
 * Access:
 *   - Public read so RSC pages can fetch published tours (PR 4 consumers).
 *   - Create/update/delete require an authenticated admin user.
 */
export const Tours: CollectionConfig = {
  slug: 'tours',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'price', 'updatedAt'],
  },
  versions: {
    drafts: true,
    maxPerDoc: 10,
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-safe identifier (kebab-case). Same slug serves both locales.',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return 'Slug is required.';
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return 'Slug must be kebab-case (lowercase letters, numbers, and hyphens).';
        }
        return true;
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'E-bike', value: 'ebike' },
        { label: 'Walking', value: 'walking' },
        { label: 'Day trip', value: 'daytrip' },
        { label: 'Food', value: 'food' },
      ],
    },
    {
      name: 'duration',
      type: 'text',
      required: true,
      admin: {
        description: 'E.g. "3.5h", "4h", "8h".',
      },
    },
    {
      name: 'distance',
      type: 'text',
      admin: {
        description: 'E.g. "14 km". Optional — only e-bike tours typically have it.',
      },
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'USD price per person.',
        step: 1,
      },
    },
    {
      name: 'tag',
      type: 'text',
      localized: true,
      admin: {
        description: 'Optional badge like "Most booked" / "Más reservado".',
      },
    },
    {
      name: 'tagColor',
      type: 'select',
      options: [
        { label: 'Terra', value: 'terra' },
        { label: 'Cloud', value: 'cloud' },
        { label: 'Navy', value: 'navy' },
        { label: 'Forest', value: 'forest' },
      ],
      admin: {
        description: 'Badge color. Optional.',
      },
    },
    {
      name: 'shortDescription',
      type: 'text',
      required: true,
      localized: true,
      maxLength: 200,
      admin: {
        description: 'One-liner used on cards (max 200 chars).',
      },
    },
    {
      name: 'photoDescription',
      type: 'text',
      localized: true,
      admin: {
        description:
          'What the hero photo should depict (e.g. "Coyoacán plaza · golden hour"). Hint for the client choosing an image to upload.',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      // Required for PUBLISH, not for draft. Drafts skip required-field validation.
      required: true,
    },
    {
      name: 'gallery',
      type: 'array',
      labels: { singular: 'Gallery image', plural: 'Gallery images' },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'aboutP1',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Detail page — first paragraph.',
      },
    },
    {
      name: 'aboutP2',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Detail page — second paragraph.',
      },
    },
    {
      name: 'headlineA',
      type: 'text',
      localized: true,
      admin: {
        description: 'Detail page headline part A (e.g. "The classic CDMX,").',
      },
    },
    {
      name: 'headlineB',
      type: 'text',
      localized: true,
      admin: {
        description: 'Detail page headline part B (e.g. " on a bike.").',
      },
    },
    {
      name: 'meetingPoint',
      type: 'text',
      localized: true,
      admin: {
        description: 'Short label, e.g. "Café Avellaneda, Coyoacán".',
      },
    },
    {
      name: 'meetingPointText',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Longer description of how to find the meeting point.',
      },
    },
    {
      name: 'groupSize',
      type: 'text',
      localized: true,
      admin: {
        description: 'E.g. "Up to 8" / "Hasta 8".',
      },
    },
    {
      name: 'languages',
      type: 'text',
      admin: {
        description: 'E.g. "EN · ES". Same string in both locales — non-localized.',
      },
    },
    {
      name: 'level',
      type: 'text',
      localized: true,
      admin: {
        description: 'Difficulty label, e.g. "Easy" / "Fácil".',
      },
    },
    {
      name: 'itinerary',
      type: 'array',
      labels: { singular: 'Itinerary stop', plural: 'Itinerary stops' },
      fields: [
        {
          name: 'time',
          type: 'text',
          required: true,
          admin: {
            description: 'E.g. "14:00". Same in both locales.',
          },
        },
        {
          name: 'heading',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          localized: true,
        },
      ],
    },
    {
      name: 'includes',
      type: 'array',
      labels: { singular: 'Inclusion', plural: 'Inclusions' },
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
          localized: true,
        },
      ],
    },
  ],
};
