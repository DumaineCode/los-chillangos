import type { CollectionConfig } from 'payload';

import { revalidateToursAfterChange, revalidateToursAfterDelete } from '../hooks/revalidateTours';
import { isStandardFieldVisible, validateHeroImage } from '../lib/seasonal/fieldVisibility';

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
 * Admin layout:
 *   - `slug` + `isSeasonal` live ABOVE the tabs (always visible): the seasonal
 *     toggle governs which tabs/fields appear, so it must never be hidden.
 *   - The rest is grouped into UNNAMED tabs (label only, no `name`) purely for
 *     orientation. Unnamed tabs DO NOT nest data — the stored shape stays flat
 *     (`tour.title`, `tour.price`, …), so the frontend and DB are untouched.
 *   - The "Page content" tab is hidden for seasonal tours and the "Seasonal"
 *     tab is hidden for standard tours, mirroring the per-field conditions.
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
    // Live Preview: split-screen editor where the client sees the real tour
    // page re-render as they type, before publishing. The iframe loads
    // `/next/preview`, which validates the user + enables Next draft mode and
    // redirects to the localized tour route, so unpublished edits are visible.
    livePreview: {
      url: ({ data, locale }) => {
        const slug = typeof data?.slug === 'string' ? data.slug : '';
        const localeCode = locale?.code ?? 'en';
        const path = `/${localeCode}/tours/${slug}`;
        const params = new URLSearchParams({
          path,
          locale: localeCode,
          previewSecret: process.env.PAYLOAD_SECRET ?? '',
        });
        return `/next/preview?${params.toString()}`;
      },
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 390, height: 844 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
    },
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
  hooks: {
    afterChange: [revalidateToursAfterChange],
    afterDelete: [revalidateToursAfterDelete],
  },
  fields: [
    // ── Always-visible structural fields (above the tabs) ──────────────────
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
      // Structural (NOT localized): flips a standard tour into a seasonal,
      // once-a-year special-event tour. Additive & backward-compatible —
      // pre-existing tours default to `false` and keep the standard layout.
      name: 'isSeasonal',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Turn this tour into a seasonal special-event tour (cinematic hero, storytelling, gallery). Reveals seasonal-only fields below.',
      },
    },
    // ── Tabs (UNNAMED — layout only, data stays flat) ──────────────────────
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          description:
            'Core details: name, category, price, and the quick facts shown across the site.',
          fields: [
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
              // Display-only marketing label. Real capacity lives in `timeSlots[].capacity`.
              name: 'groupSize',
              type: 'text',
              localized: true,
              admin: {
                description: 'E.g. "Up to 8" / "Hasta 8".',
              },
            },
          ],
        },
        {
          label: 'Page content',
          // Standard-only tab: hidden for seasonal tours, which render the
          // cinematic seasonal hero/storytelling/gallery instead. Mirrors the
          // per-field `isStandardFieldVisible` conditions below.
          admin: {
            condition: isStandardFieldVisible,
          },
          description:
            'Hero image, gallery, and the detail-page copy. Used by standard (non-seasonal) tours.',
          fields: [
            {
              // STANDARD-ONLY: the seasonal hero/gallery replace this hint. Hidden for
              // seasonal tours (see isStandardFieldVisible), shown for every other tour.
              name: 'photoDescription',
              type: 'text',
              localized: true,
              admin: {
                condition: isStandardFieldVisible,
                description:
                  'What the hero photo should depict (e.g. "Coyoacán plaza · golden hour"). Hint for the client choosing an image to upload.',
              },
            },
            {
              // STANDARD-ONLY: standard detail/card hero. Seasonal tours render
              // `seasonal.seasonalHero` instead, so this is hidden and made optional
              // for them — a hidden `required` field would otherwise block publishing a
              // valid seasonal tour. `validate` enforces presence only for non-seasonal.
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              admin: {
                condition: isStandardFieldVisible,
              },
              // Required for PUBLISH (not draft) only when the tour is NOT seasonal.
              // Drafts skip required-field validation regardless.
              validate: validateHeroImage,
            },
            {
              // STANDARD-ONLY: duplicates `seasonal.gallery`. Hidden for seasonal tours.
              name: 'gallery',
              type: 'array',
              labels: { singular: 'Gallery image', plural: 'Gallery images' },
              admin: {
                condition: isStandardFieldVisible,
              },
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
              // STANDARD-ONLY: replaced by `seasonal.storytelling`. Hidden for seasonal.
              name: 'aboutP1',
              type: 'textarea',
              localized: true,
              admin: {
                condition: isStandardFieldVisible,
                description: 'Detail page — first paragraph.',
              },
            },
            {
              // STANDARD-ONLY: replaced by `seasonal.storytelling`. Hidden for seasonal.
              name: 'aboutP2',
              type: 'textarea',
              localized: true,
              admin: {
                condition: isStandardFieldVisible,
                description: 'Detail page — second paragraph.',
              },
            },
            {
              // STANDARD-ONLY: replaced by `seasonal.tagline`/`storytelling`. Hidden for seasonal.
              name: 'headlineA',
              type: 'text',
              localized: true,
              admin: {
                condition: isStandardFieldVisible,
                description: 'Detail page headline part A (e.g. "The classic CDMX,").',
              },
            },
            {
              // STANDARD-ONLY: replaced by `seasonal.tagline`/`storytelling`. Hidden for seasonal.
              name: 'headlineB',
              type: 'text',
              localized: true,
              admin: {
                condition: isStandardFieldVisible,
                description: 'Detail page headline part B (e.g. " on a bike.").',
              },
            },
          ],
        },
        {
          label: 'Itinerary',
          description: 'The stop-by-stop schedule and what the price includes.',
          fields: [
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
        },
        {
          label: 'Logistics & booking',
          description: 'Meeting point and the departure days/times the booking flow offers.',
          fields: [
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
              name: 'availableDays',
              type: 'select',
              hasMany: true,
              admin: {
                description:
                  'Days of the week this tour runs. Leave empty if the tour is paused. The site uses these to gate the booking calendar.',
              },
              options: [
                { label: 'Sunday', value: '0' },
                { label: 'Monday', value: '1' },
                { label: 'Tuesday', value: '2' },
                { label: 'Wednesday', value: '3' },
                { label: 'Thursday', value: '4' },
                { label: 'Friday', value: '5' },
                { label: 'Saturday', value: '6' },
              ],
            },
            {
              name: 'timeSlots',
              type: 'array',
              labels: { singular: 'Time slot', plural: 'Time slots' },
              admin: {
                description:
                  'Departure times the tour runs and how many seats each one has. The booking flow reads this per-tour — no global default applies anymore.',
              },
              fields: [
                {
                  name: 'time',
                  type: 'text',
                  required: true,
                  admin: {
                    description: '24h format HH:MM (e.g. "09:00", "14:30").',
                  },
                  validate: (value: string | null | undefined) => {
                    if (!value) return 'Time is required.';
                    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
                      return 'Time must be HH:MM in 24h format.';
                    }
                    return true;
                  },
                },
                {
                  name: 'capacity',
                  type: 'number',
                  required: true,
                  min: 1,
                  admin: {
                    description:
                      'Maximum persons (adults + teens) bookable in this departure slot.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Seasonal',
          // Seasonal-only tab: shown only when `isSeasonal` is checked. The
          // `seasonal` group below is a NAMED group (keeps the `seasonal.*` data
          // namespace the frontend reads); its own condition is kept as a
          // belt-and-suspenders guard.
          admin: {
            condition: (data) => Boolean(data?.isSeasonal),
          },
          description:
            'Cinematic event content (hero, storytelling, gallery). Only used when "Is seasonal" is checked above.',
          fields: [
            {
              // Seasonal-only fields, revealed via admin.condition mirroring Hero.ts.
              // The whole group is non-rendered in the form unless `isSeasonal` is true.
              name: 'seasonal',
              type: 'group',
              admin: {
                condition: (data) => Boolean(data?.isSeasonal),
                description: 'Seasonal event content. Only used when "Is seasonal" is checked.',
              },
              fields: [
                {
                  // Display-only event date. Does NOT gate booking availability —
                  // booking still flows through timeSlots/capacity like any tour.
                  name: 'eventDate',
                  type: 'date',
                  admin: {
                    description:
                      'Display-only date of the event. Does not affect booking availability.',
                  },
                },
                {
                  name: 'seasonWindow',
                  type: 'group',
                  admin: {
                    description: 'Display-only season window (e.g. the days the event runs).',
                  },
                  fields: [
                    { name: 'start', type: 'date' },
                    { name: 'end', type: 'date' },
                  ],
                },
                {
                  // Cinematic full-bleed hero. Mirrors Hero.ts media pattern so it can
                  // be resolved by the same media helpers (Media + MediaVideo).
                  name: 'seasonalHero',
                  type: 'group',
                  fields: [
                    {
                      name: 'mediaType',
                      type: 'select',
                      defaultValue: 'image',
                      options: [
                        { label: 'Image', value: 'image' },
                        { label: 'Video', value: 'video' },
                      ],
                      admin: {
                        description: 'Choose the seasonal hero background medium.',
                      },
                    },
                    {
                      name: 'image',
                      type: 'upload',
                      relationTo: 'media',
                      admin: {
                        condition: (_, sibling) => sibling?.mediaType !== 'video',
                      },
                    },
                    {
                      name: 'video',
                      type: 'upload',
                      relationTo: 'mediaVideo',
                      admin: {
                        condition: (_, sibling) => sibling?.mediaType === 'video',
                        description:
                          'Background video (muted, looping). Mobile/reduced-motion show the poster only.',
                      },
                    },
                    {
                      name: 'poster',
                      type: 'upload',
                      relationTo: 'media',
                      admin: {
                        condition: (_, sibling) => sibling?.mediaType === 'video',
                        description: 'Poster: first paint + mobile/reduced-motion still.',
                      },
                    },
                  ],
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
                  name: 'storytelling',
                  type: 'array',
                  labels: { singular: 'Story block', plural: 'Story blocks' },
                  admin: {
                    description:
                      'Structured storytelling blocks (heading + body + optional image).',
                  },
                  fields: [
                    {
                      name: 'heading',
                      type: 'text',
                      localized: true,
                    },
                    {
                      name: 'body',
                      type: 'textarea',
                      localized: true,
                    },
                    {
                      name: 'image',
                      type: 'upload',
                      relationTo: 'media',
                    },
                  ],
                },
                {
                  name: 'eventLocation',
                  type: 'text',
                  localized: true,
                  admin: {
                    description: 'Event location label, e.g. "Tlaxcala".',
                  },
                },
                {
                  name: 'tagline',
                  type: 'text',
                  localized: true,
                  admin: {
                    description: 'Short cinematic tagline shown over the hero.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
