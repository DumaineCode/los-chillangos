import type { CollectionConfig } from 'payload';

import { revalidateRentalsAfterChange, revalidateRentalsAfterDelete } from '../hooks/revalidateRentals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Rentals collection — standalone bike-rental catalog (Phase A).
 *
 * Mirrors the Tours content/i18n/draft policy for a NEW, decoupled domain
 * WITHOUT any tour scheduling. There is intentionally NO itinerary, route,
 * seasonal, timeSlots, availableDays, or booking-engine coupling here — Rentals
 * are display-only bike models with an inquiry CTA (wired in a later slice).
 *
 * Localization policy (identical to Tours, locked in PR 3):
 *   - `slug` is NOT localized. The same slug serves /en/rentals/<slug> and
 *     /es/rentals/<slug>. One row per bike, two locales.
 *   - User-facing copy (`name`, `description`, `characteristics`) is localized.
 *   - `price` is a display-only TEXT field (e.g. "$150/day"): stored verbatim,
 *     no pricing math is ever applied (Phase B concern, out of scope).
 *
 * Accessories:
 *   - Modeled as an `accessories[]` array ON Rentals (helmet, lock, child seat),
 *     deliberately SEPARATE from `Extras.ts`. Extras is engine-coupled
 *     (perPerson/total math, Tours booking wizard, no media); accessories just
 *     carry a localized name, a photo, and an optional display price (text).
 *
 * Drafts / preview / revalidation:
 *   - `versions.drafts: true` so the client can stage edits and publish.
 *   - `livePreview` renders the localized /rentals/<slug> route in a split view.
 *   - afterChange/afterDelete revalidate the rentals cache (see revalidateRentals).
 *
 * Access:
 *   - Public read so RSC pages can fetch published rentals.
 *   - Create/update/delete require an authenticated admin user.
 */

/**
 * Convert a rental name into a URL-safe kebab-case slug. Strips accents
 * ("Montaña" → "montana"), lowercases, and collapses any run of non-alphanumeric
 * characters into single hyphens. Mirrors the Tours slug policy.
 */
function slugifyName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const Rentals: CollectionConfig = {
  slug: 'rentals',
  labels: {
    singular: { en: 'Rental', es: 'Renta' },
    plural: { en: 'Rentals', es: 'Rentas' },
  },
  admin: {
    useAsTitle: 'name',
    group: NAV_GROUPS.site,
    defaultColumns: ['name', 'price', 'updatedAt'],
    // Live Preview: split-screen editor where the client sees the real rental
    // page re-render as they type. The iframe loads `/next/preview`, which
    // validates the user + enables Next draft mode, then redirects to the
    // localized rental route so unpublished edits are visible.
    livePreview: {
      url: ({ data, locale }) => {
        const slug = typeof data?.slug === 'string' ? data.slug : '';
        const localeCode = locale?.code ?? 'en';
        const path = `/${localeCode}/rentals/${slug}`;
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
    afterChange: [revalidateRentalsAfterChange],
    afterDelete: [revalidateRentalsAfterDelete],
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      // Auto-generated from the name by the beforeValidate hook below. Kept
      // editable + optional so an advanced user can override it, while the
      // non-technical client never has to touch it. NON-localized: one slug row
      // serves both locales (identical to Tours).
      unique: true,
      index: true,
      label: { en: 'Identifier (URL)', es: 'Identificador (URL)' },
      admin: {
        description: {
          en: 'Auto-generated from the name. Only change it if you know what you are doing — it changes the rental web address.',
          es: 'Se genera solo a partir del nombre. Cámbialo solo si sabes lo que haces: modifica la dirección (URL) de la renta.',
        },
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // Respect an existing/manual slug; only auto-fill when empty so
            // editing a published rental's name never silently breaks its URL.
            if (typeof value === 'string' && value.trim()) return value;
            const raw = data?.name as unknown;
            const name =
              typeof raw === 'string'
                ? raw
                : raw && typeof raw === 'object'
                  ? String(
                      (raw as Record<string, string>).es ??
                        (raw as Record<string, string>).en ??
                        Object.values(raw as Record<string, string>)[0] ??
                        ''
                    )
                  : '';
            return name ? slugifyName(name) : value;
          },
        ],
      },
      validate: (value: string | null | undefined) => {
        // Empty is allowed — the hook fills it from the name before save.
        if (!value) return true;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return 'Debe ser tipo kebab-case: minúsculas, números y guiones.';
        }
        return true;
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
      label: { en: 'Name', es: 'Nombre' },
      admin: {
        description: {
          en: 'The bike model name as it appears across the site.',
          es: 'El nombre del modelo de bici tal como aparece en el sitio.',
        },
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      label: { en: 'Description', es: 'Descripción' },
      admin: {
        description: {
          en: 'Detail-page copy describing the bike.',
          es: 'Texto de la página de detalle que describe la bici.',
        },
      },
    },
    {
      name: 'characteristics',
      type: 'textarea',
      localized: true,
      label: { en: 'Characteristics', es: 'Características' },
      admin: {
        description: {
          en: 'Key features of the bike (e.g. motor, range, frame size).',
          es: 'Características principales de la bici (ej.: motor, autonomía, talla del cuadro).',
        },
      },
    },
    {
      // Display-only price: stored VERBATIM as text (e.g. "$150/day"). No math
      // is ever applied — pricing/availability/checkout is Phase B, out of scope.
      name: 'price',
      type: 'text',
      label: { en: 'Price', es: 'Precio' },
      admin: {
        description: {
          en: 'Informative price shown as-is, e.g. "$150/day". No calculation is applied.',
          es: 'Precio informativo que se muestra tal cual, ej.: "$150/día". No se aplica ningún cálculo.',
        },
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: { en: 'Hero image', es: 'Imagen principal' },
      admin: {
        description: {
          en: 'Main image shown on the rental card and at the top of the rental page.',
          es: 'Imagen principal que se ve en la tarjeta de renta y arriba de la página de la renta.',
        },
      },
    },
    {
      name: 'gallery',
      type: 'array',
      labels: {
        singular: { en: 'Gallery image', es: 'Imagen de galería' },
        plural: { en: 'Gallery images', es: 'Imágenes de galería' },
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: { en: 'Image', es: 'Imagen' },
        },
      ],
    },
    {
      // Rentable accessories modeled ON Rentals — deliberately SEPARATE from
      // Extras.ts (engine-coupled). Display-only in Phase A: each item carries a
      // localized name, a photo, and an optional informative price (text).
      name: 'accessories',
      type: 'array',
      labels: {
        singular: { en: 'Accessory', es: 'Accesorio' },
        plural: { en: 'Accessories', es: 'Accesorios' },
      },
      admin: {
        description: {
          en: 'Rentable accessories (helmet, lock, child seat). Display-only — no booking math.',
          es: 'Accesorios para rentar (casco, candado, silla para niño). Solo informativos — sin cálculo de reserva.',
        },
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          localized: true,
          label: { en: 'Name', es: 'Nombre' },
        },
        {
          name: 'photo',
          type: 'upload',
          relationTo: 'media',
          label: { en: 'Photo', es: 'Foto' },
        },
        {
          // Optional display-only price as TEXT (e.g. "$50/day"), mirroring the
          // bike price. No pricing-engine coupling.
          name: 'price',
          type: 'text',
          label: { en: 'Price', es: 'Precio' },
          admin: {
            description: {
              en: 'Optional informative price shown as-is, e.g. "$50/day".',
              es: 'Precio informativo opcional que se muestra tal cual, ej.: "$50/día".',
            },
          },
        },
      ],
    },
  ],
};
