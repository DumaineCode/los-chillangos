import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

/**
 * Landing global — the SINGLE editing surface for the homepage body.
 *
 * Consolidates what used to be nine separate globals (hero, marquee, values,
 * about, testimonial, services, faq, team, seasonalFeature) into ONE document
 * organized with NAMED tabs, so a non-technical editor opens one place and
 * edits the whole landing — top to bottom — instead of hunting through the
 * sidebar.
 *
 * Why named tabs (not unnamed like Tours): the sections collide on field names
 * (`eyebrow`, `title`, `sub`, `items` repeat across sections), so each tab
 * MUST namespace its data. The stored/read shape is therefore nested:
 * `landing.hero.eyebrow`, `landing.values.items`, `landing.seasonal.enabled`, …
 *
 * Field definitions are copied 1:1 from the legacy globals so the migration
 * (`scripts/migrate-landing.ts`) is a straight value copy. The legacy globals
 * remain registered but `admin.hidden` until the migration is verified in
 * production — they are the rollback/source-of-truth safety net.
 *
 * Live Preview: split-screen editor where the client sees the real homepage
 * re-render. The iframe loads `/next/preview`, which validates the user, enables
 * Next draft mode, and redirects to `/<locale>`. Globals have no drafts, so the
 * preview reflects the last SAVED state (refresh-on-save), not keystrokes.
 */
export const Landing: GlobalConfig = {
  slug: 'landing',
  label: 'Landing Page',
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  admin: {
    // Live Preview: point the iframe at the localized homepage root (no slug).
    livePreview: {
      url: ({ locale }) => {
        const localeCode = locale?.code ?? 'en';
        const params = new URLSearchParams({
          path: `/${localeCode}`,
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
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // ── Hero ─────────────────────────────────────────────────────────
        {
          name: 'hero',
          label: 'Hero',
          fields: [
            { name: 'eyebrow', type: 'text', localized: true },
            { name: 'h1a', type: 'text', localized: true },
            { name: 'h1b', type: 'text', localized: true },
            { name: 'h1c', type: 'text', localized: true },
            { name: 'h1d', type: 'text', localized: true },
            { name: 'lede', type: 'textarea', localized: true },
            { name: 'ctaPrimary', type: 'text', localized: true },
            { name: 'ctaGhost', type: 'text', localized: true },
            {
              // Structural (NOT localized): chooses the hero background medium.
              name: 'mediaType',
              type: 'select',
              defaultValue: 'image',
              options: [
                { label: 'Image', value: 'image' },
                { label: 'Video', value: 'video' },
              ],
              admin: { description: 'Choose the hero background medium.' },
            },
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              // Nested under a named tab → use siblingData (the `hero` object),
              // NOT the top-level document data.
              admin: { condition: (_, siblingData) => siblingData?.mediaType !== 'video' },
            },
            {
              name: 'heroVideo',
              type: 'upload',
              relationTo: 'mediaVideo',
              admin: {
                condition: (_, siblingData) => siblingData?.mediaType === 'video',
                description:
                  'Background video (muted, looping). Mobile/reduced-motion show the poster only.',
              },
            },
            {
              name: 'posterImage',
              type: 'upload',
              relationTo: 'media',
              admin: {
                condition: (_, siblingData) => siblingData?.mediaType === 'video',
                description:
                  'Poster: first paint (LCP) + mobile/reduced-motion still. Strongly recommended.',
              },
            },
            {
              name: 'live',
              type: 'text',
              localized: true,
              admin: { description: 'Top status line, e.g. "Live · CDMX · 19.43°N 99.13°W".' },
            },
            {
              name: 'estLabel',
              type: 'text',
              localized: true,
              admin: { description: 'Small label next to the neighborhoods, e.g. "Est. 2024".' },
            },
            {
              name: 'neighborhoods',
              type: 'text',
              localized: true,
              admin: {
                description: 'Neighborhoods line, e.g. "Roma · Condesa · Coyoacán · Centro".',
              },
            },
            {
              name: 'scroll',
              type: 'text',
              localized: true,
              admin: { description: 'Scroll hint at the bottom of the hero, e.g. "Scroll".' },
            },
            {
              name: 'stats',
              type: 'array',
              labels: { singular: 'Stat', plural: 'Stats' },
              maxRows: 4,
              admin: { description: 'The four stat blocks shown under the hero lede.' },
              fields: [
                {
                  name: 'num',
                  type: 'text',
                  required: true,
                  admin: { description: 'Big number, e.g. "12" or "3–4h".' },
                },
                {
                  name: 'label',
                  type: 'textarea',
                  required: true,
                  localized: true,
                  admin: { description: 'Caption under the number. Line breaks are kept.' },
                },
              ],
            },
          ],
        },
        // ── Marquee ──────────────────────────────────────────────────────
        {
          name: 'marquee',
          label: 'Marquee',
          fields: [
            {
              name: 'text',
              type: 'text',
              localized: true,
              admin: {
                description:
                  'Scrolling strip text, e.g. "Coyoacán · Roma Norte · Condesa · …". End with " ·" for a clean loop.',
              },
            },
          ],
        },
        // ── Values ───────────────────────────────────────────────────────
        {
          name: 'values',
          label: 'Values',
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              admin: { description: 'Small label, e.g. "Why us".' },
            },
            { name: 'title', type: 'text', localized: true },
            {
              name: 'sub',
              type: 'textarea',
              localized: true,
              admin: { description: 'Subheading shown to the right of the title.' },
            },
            {
              name: 'items',
              type: 'array',
              labels: { singular: 'Value', plural: 'Values' },
              fields: [
                { name: 'title', type: 'text', required: true, localized: true },
                { name: 'description', type: 'textarea', required: true, localized: true },
              ],
            },
          ],
        },
        // ── About ────────────────────────────────────────────────────────
        {
          name: 'about',
          label: 'About',
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              admin: { description: 'Small label, e.g. "Our approach".' },
            },
            { name: 'title', type: 'textarea', localized: true },
            {
              name: 'p1',
              type: 'textarea',
              localized: true,
              admin: { description: 'First paragraph.' },
            },
            {
              name: 'p2',
              type: 'textarea',
              localized: true,
              admin: { description: 'Second paragraph.' },
            },
            {
              name: 'meetCta',
              type: 'text',
              localized: true,
              admin: { description: 'Button label, e.g. "Meet the guides →".' },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Photo for the section. If empty, a placeholder is shown.' },
            },
            {
              name: 'imageLabel',
              type: 'text',
              localized: true,
              admin: {
                description: 'Caption shown over the placeholder when no image is uploaded.',
              },
            },
          ],
        },
        // ── Testimonial ──────────────────────────────────────────────────
        {
          name: 'testimonial',
          label: 'Testimonial',
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              admin: { description: 'Small label, e.g. "Notes from guests".' },
            },
            { name: 'quote', type: 'textarea', localized: true },
            {
              name: 'name',
              type: 'text',
              admin: { description: 'Guest name, e.g. "Hana K.".' },
            },
            {
              name: 'loc',
              type: 'text',
              localized: true,
              admin: { description: 'Location / date line, e.g. "Brooklyn, NY · Mar 2026".' },
            },
            {
              name: 'avatar',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Guest photo. If empty, a placeholder circle is shown.' },
            },
          ],
        },
        // ── Services ─────────────────────────────────────────────────────
        {
          name: 'services',
          label: 'Services',
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              admin: { description: 'Small label, e.g. "Beyond the tour".' },
            },
            { name: 'title', type: 'text', localized: true },
            { name: 'sub', type: 'textarea', localized: true },
            {
              name: 'inquireCta',
              type: 'text',
              localized: true,
              admin: { description: 'Link label on each card, e.g. "Inquire →".' },
            },
            {
              name: 'items',
              type: 'array',
              labels: { singular: 'Service', plural: 'Services' },
              fields: [
                { name: 'title', type: 'text', required: true, localized: true },
                { name: 'description', type: 'textarea', required: true, localized: true },
              ],
            },
          ],
        },
        // ── FAQ ──────────────────────────────────────────────────────────
        {
          name: 'faq',
          label: 'FAQ',
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              admin: { description: 'Small label, e.g. "Practical".' },
            },
            { name: 'title', type: 'text', localized: true },
            {
              name: 'items',
              type: 'array',
              labels: { singular: 'Question', plural: 'Questions' },
              fields: [
                { name: 'question', type: 'text', required: true, localized: true },
                { name: 'answer', type: 'textarea', required: true, localized: true },
              ],
            },
          ],
        },
        // ── Team ─────────────────────────────────────────────────────────
        {
          name: 'team',
          label: 'Team',
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              admin: { description: 'Small label, e.g. "The people".' },
            },
            {
              name: 'title',
              type: 'text',
              localized: true,
              admin: { description: 'Section heading, e.g. "Our team".' },
            },
            {
              name: 'sub',
              type: 'textarea',
              localized: true,
              admin: { description: 'Optional short intro under the heading.' },
            },
            {
              name: 'items',
              type: 'array',
              labels: { singular: 'Member', plural: 'Members' },
              admin: { description: 'Add team members. Three look best in a row.' },
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                  admin: { description: 'Person name, e.g. "Diego R.".' },
                },
                {
                  name: 'role',
                  type: 'text',
                  required: true,
                  localized: true,
                  admin: { description: 'Role / title, e.g. "Lead guide".' },
                },
                {
                  name: 'photo',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    description: 'Profile photo. If empty, a placeholder circle is shown.',
                  },
                },
              ],
            },
          ],
        },
        // ── Seasonal ─────────────────────────────────────────────────────
        {
          name: 'seasonal',
          label: 'Seasonal',
          fields: [
            {
              name: 'enabled',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Show the seasonal highlight on the landing page.' },
            },
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              admin: { description: 'Small label above the highlight, e.g. "This season".' },
            },
            {
              name: 'featuredSeasonalTour',
              type: 'relationship',
              relationTo: 'tours',
              hasMany: false,
              admin: {
                description: 'The seasonal tour to highlight. Must be published and marked seasonal.',
              },
            },
          ],
        },
      ],
    },
  ],
};
