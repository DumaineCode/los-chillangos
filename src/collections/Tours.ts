import type { CollectionConfig } from 'payload';

import { revalidateToursAfterChange, revalidateToursAfterDelete } from '../hooks/revalidateTours';
import { isStandardFieldVisible, validateHeroImage } from '../lib/seasonal/fieldVisibility';
import { NAV_GROUPS } from '../admin/navGroups';

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
/**
 * Convert a tour title into a URL-safe kebab-case slug.
 * Strips accents ("Coyoacán" → "coyoacan"), lowercases, and collapses any run
 * of non-alphanumeric characters into single hyphens.
 */
function slugifyTitle(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const Tours: CollectionConfig = {
  slug: 'tours',
  labels: {
    singular: { en: 'Tour', es: 'Tour' },
    plural: { en: 'Tours', es: 'Tours' },
  },
  admin: {
    useAsTitle: 'title',
    group: NAV_GROUPS.site,
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
      // No longer required in the form: auto-generated from the title by the
      // beforeValidate hook below. Kept editable + optional so an advanced user
      // can override it, while the non-technical client never has to touch it.
      unique: true,
      index: true,
      label: { en: 'Identifier (URL)', es: 'Identificador (URL)' },
      admin: {
        description: {
          en: 'Auto-generated from the title. Only change it if you know what you are doing — it changes the tour web address.',
          es: 'Se genera solo a partir del título. Cámbialo solo si sabes lo que haces: modifica la dirección (URL) del tour.',
        },
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // Respect an existing/manual slug; only auto-fill when empty so
            // editing a published tour's title never silently breaks its URL.
            if (typeof value === 'string' && value.trim()) return value;
            const raw = data?.title as unknown;
            const title =
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
            return title ? slugifyTitle(title) : value;
          },
        ],
      },
      validate: (value: string | null | undefined) => {
        // Empty is allowed — the hook fills it from the title before save.
        if (!value) return true;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return 'Debe ser tipo kebab-case: minúsculas, números y guiones.';
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
      label: { en: 'Seasonal tour', es: 'Tour de temporada' },
      admin: {
        description: {
          en: 'Turn this tour into a seasonal special-event tour (cinematic hero, storytelling, gallery). Reveals seasonal-only fields below.',
          es: 'Convierte este tour en un evento especial de temporada (portada cinematográfica, narrativa, galería). Muestra abajo los campos de temporada.',
        },
      },
    },
    // ── Tabs (UNNAMED — layout only, data stays flat) ──────────────────────
    {
      type: 'tabs',
      tabs: [
        {
          label: { en: 'General', es: 'General' },
          description: {
            en: 'Core details: name, category, price, and the quick facts shown across the site.',
            es: 'Datos principales: nombre, categoría, precio y los datos rápidos que se ven en todo el sitio.',
          },
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              localized: true,
              label: { en: 'Title', es: 'Título' },
              admin: {
                description: {
                  en: 'The tour name as it appears across the site.',
                  es: 'El nombre del tour tal como aparece en el sitio.',
                },
              },
            },
            {
              name: 'category',
              type: 'select',
              required: true,
              label: { en: 'Category', es: 'Categoría' },
              admin: {
                description: { en: 'Type of tour.', es: 'Tipo de tour.' },
              },
              options: [
                { label: { en: 'E-bike', es: 'E-bike' }, value: 'ebike' },
                { label: { en: 'Walking', es: 'Caminata' }, value: 'walking' },
                { label: { en: 'Day trip', es: 'Excursión de día' }, value: 'daytrip' },
                { label: { en: 'Food', es: 'Gastronomía' }, value: 'food' },
              ],
            },
            {
              name: 'duration',
              type: 'text',
              required: true,
              label: { en: 'Duration', es: 'Duración' },
              admin: {
                description: { en: 'E.g. "3.5h", "4h", "8h".', es: 'Ej.: "3.5h", "4h", "8h".' },
              },
            },
            {
              name: 'distance',
              type: 'text',
              label: { en: 'Distance', es: 'Distancia' },
              admin: {
                description: {
                  en: 'E.g. "14 km". Optional — only e-bike tours typically have it.',
                  es: 'Ej.: "14 km". Opcional — normalmente solo los tours en e-bike la tienen.',
                },
              },
            },
            {
              name: 'price',
              type: 'number',
              required: true,
              min: 0,
              label: { en: 'Price', es: 'Precio' },
              admin: {
                description: { en: 'USD price per person.', es: 'Precio por persona en USD.' },
                step: 1,
              },
            },
            {
              name: 'shortDescription',
              type: 'text',
              required: true,
              localized: true,
              maxLength: 200,
              label: { en: 'Short description', es: 'Descripción corta' },
              admin: {
                description: {
                  en: 'One-liner used on cards (max 200 chars).',
                  es: 'Frase de una línea que se usa en las tarjetas (máx. 200 caracteres).',
                },
              },
            },
            {
              name: 'tag',
              type: 'text',
              localized: true,
              label: { en: 'Tag', es: 'Etiqueta' },
              admin: {
                description: {
                  en: 'Optional badge like "Most booked" / "Más reservado".',
                  es: 'Insignia opcional como "Más reservado".',
                },
              },
            },
            {
              name: 'tagColor',
              type: 'select',
              label: { en: 'Tag color', es: 'Color de la etiqueta' },
              options: [
                {
                  label: { en: 'Terra (Rosa Mexicano)', es: 'Terra (Rosa Mexicano)' },
                  value: 'terra',
                },
                { label: { en: 'Maya (Azul Maya)', es: 'Maya (Azul Maya)' }, value: 'maya' },
                {
                  label: { en: 'Profundo (Azul Profundo)', es: 'Profundo (Azul Profundo)' },
                  value: 'profundo',
                },
                { label: { en: 'Crema (default)', es: 'Crema (por defecto)' }, value: 'crema' },
              ],
              admin: {
                description: {
                  en: 'Badge color. Optional. Matches the brand palette.',
                  es: 'Color de la insignia. Opcional. Combina con la paleta de marca.',
                },
              },
            },
            {
              name: 'languages',
              type: 'text',
              label: { en: 'Languages', es: 'Idiomas' },
              admin: {
                description: {
                  en: 'E.g. "EN · ES". Same string in both locales — non-localized.',
                  es: 'Ej.: "EN · ES". Es el mismo texto en ambos idiomas.',
                },
              },
            },
            {
              name: 'level',
              type: 'text',
              localized: true,
              label: { en: 'Level', es: 'Nivel' },
              admin: {
                description: {
                  en: 'Difficulty label, e.g. "Easy" / "Fácil".',
                  es: 'Nivel de dificultad, ej.: "Fácil".',
                },
              },
            },
            {
              // Display-only marketing label. Real capacity lives in `timeSlots[].capacity`.
              name: 'groupSize',
              type: 'text',
              localized: true,
              label: { en: 'Group size', es: 'Tamaño del grupo' },
              admin: {
                description: { en: 'E.g. "Up to 8" / "Hasta 8".', es: 'Ej.: "Hasta 8".' },
              },
            },
          ],
        },
        {
          label: { en: 'Page content', es: 'Contenido de la página' },
          // Standard-only tab: hidden for seasonal tours, which render the
          // cinematic seasonal hero/storytelling/gallery instead. Mirrors the
          // per-field `isStandardFieldVisible` conditions below.
          admin: {
            condition: isStandardFieldVisible,
          },
          description: {
            en: 'Hero image, gallery, and the detail-page copy. Used by standard (non-seasonal) tours.',
            es: 'Imagen principal, galería y los textos de la página de detalle. Para tours estándar (no de temporada).',
          },
          fields: [
            {
              // STANDARD-ONLY: the seasonal hero/gallery replace this hint. Hidden for
              // seasonal tours (see isStandardFieldVisible), shown for every other tour.
              name: 'photoDescription',
              type: 'text',
              localized: true,
              label: { en: 'Photo description', es: 'Descripción de la foto' },
              admin: {
                condition: isStandardFieldVisible,
                description: {
                  en: 'What the hero photo should depict (e.g. "Coyoacán plaza · golden hour"). Hint for the client choosing an image to upload.',
                  es: 'Qué debería mostrar la foto principal (ej.: "Plaza de Coyoacán · hora dorada"). Una pista para elegir la imagen a subir.',
                },
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
              label: { en: 'Hero image', es: 'Imagen principal' },
              admin: {
                condition: isStandardFieldVisible,
                description: {
                  en: 'Main image shown on the tour card and at the top of the tour page.',
                  es: 'Imagen principal que se ve en la tarjeta del tour y arriba de la página del tour.',
                },
              },
              // Required for PUBLISH (not draft) only when the tour is NOT seasonal.
              // Drafts skip required-field validation regardless.
              validate: validateHeroImage,
            },
            {
              // STANDARD-ONLY: duplicates `seasonal.gallery`. Hidden for seasonal tours.
              name: 'gallery',
              type: 'array',
              labels: {
                singular: { en: 'Gallery image', es: 'Imagen de galería' },
                plural: { en: 'Gallery images', es: 'Imágenes de galería' },
              },
              admin: {
                condition: isStandardFieldVisible,
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
              // STANDARD-ONLY: replaced by `seasonal.storytelling`. Hidden for seasonal.
              name: 'aboutP1',
              type: 'textarea',
              localized: true,
              label: { en: 'About — paragraph 1', es: 'Acerca de — párrafo 1' },
              admin: {
                condition: isStandardFieldVisible,
                description: {
                  en: 'Detail page — first paragraph.',
                  es: 'Página de detalle — primer párrafo.',
                },
              },
            },
            {
              // STANDARD-ONLY: replaced by `seasonal.storytelling`. Hidden for seasonal.
              name: 'aboutP2',
              type: 'textarea',
              localized: true,
              label: { en: 'About — paragraph 2', es: 'Acerca de — párrafo 2' },
              admin: {
                condition: isStandardFieldVisible,
                description: {
                  en: 'Detail page — second paragraph.',
                  es: 'Página de detalle — segundo párrafo.',
                },
              },
            },
          ],
        },
        {
          label: { en: 'Itinerary', es: 'Itinerario' },
          description: {
            en: 'The stop-by-stop schedule and what the price includes.',
            es: 'El recorrido parada por parada y qué incluye el precio.',
          },
          fields: [
            {
              name: 'itinerary',
              type: 'array',
              labels: {
                singular: { en: 'Itinerary stop', es: 'Parada del itinerario' },
                plural: { en: 'Itinerary stops', es: 'Paradas del itinerario' },
              },
              fields: [
                {
                  name: 'time',
                  type: 'text',
                  required: true,
                  label: { en: 'Time', es: 'Hora' },
                  admin: {
                    description: { en: 'E.g. "14:00". Same in both locales.', es: 'Ej.: "14:00".' },
                  },
                },
                {
                  name: 'heading',
                  type: 'text',
                  required: true,
                  localized: true,
                  label: { en: 'Heading', es: 'Título' },
                },
                {
                  name: 'description',
                  type: 'textarea',
                  required: true,
                  localized: true,
                  label: { en: 'Description', es: 'Descripción' },
                },
              ],
            },
            {
              name: 'includes',
              type: 'array',
              labels: {
                singular: { en: 'Inclusion', es: 'Inclusión' },
                plural: { en: 'Inclusions', es: 'Inclusiones' },
              },
              fields: [
                {
                  name: 'text',
                  type: 'text',
                  required: true,
                  localized: true,
                  label: { en: 'Text', es: 'Texto' },
                },
              ],
            },
          ],
        },
        {
          label: { en: 'Logistics & booking', es: 'Logística y reservas' },
          description: {
            en: 'Meeting point and the departure days/times the booking flow offers.',
            es: 'Punto de encuentro y los días y horarios de salida que ofrece la reserva.',
          },
          fields: [
            {
              name: 'meetingPoint',
              type: 'text',
              localized: true,
              label: { en: 'Meeting point', es: 'Punto de encuentro' },
              admin: {
                description: {
                  en: 'Short label, e.g. "Café Avellaneda, Coyoacán".',
                  es: 'Etiqueta corta, ej.: "Café Avellaneda, Coyoacán".',
                },
              },
            },
            {
              name: 'meetingPointText',
              type: 'textarea',
              localized: true,
              label: {
                en: 'How to find the meeting point',
                es: 'Cómo llegar al punto de encuentro',
              },
              admin: {
                description: {
                  en: 'Longer description of how to find the meeting point.',
                  es: 'Descripción más larga de cómo encontrar el punto de encuentro.',
                },
              },
            },
            {
              // Map pin for the meeting point. NOT localized — the coordinates
              // are the same in every language. A custom admin component
              // (MeetingLocationField) lets the client type an address in plain
              // language, autocompletes it via OpenStreetMap (Photon), and
              // stores the resolved address + lat/lng. The public tour page
              // renders an interactive Leaflet map from these coordinates.
              name: 'meetingLocation',
              type: 'group',
              label: { en: 'Map location', es: 'Ubicación en el mapa' },
              admin: {
                components: {
                  Field: '/components/admin/MeetingLocationField',
                },
              },
              fields: [
                { name: 'address', type: 'text' },
                { name: 'lat', type: 'number' },
                { name: 'lng', type: 'number' },
              ],
            },
            {
              name: 'availableDays',
              type: 'select',
              hasMany: true,
              label: { en: 'Available days', es: 'Días disponibles' },
              admin: {
                description: {
                  en: 'Days of the week this tour runs. Leave empty if the tour is paused. The site uses these to gate the booking calendar.',
                  es: 'Días de la semana en que se realiza este tour. Déjalo vacío si el tour está pausado. El sitio los usa para habilitar el calendario de reservas.',
                },
              },
              options: [
                { label: { en: 'Sunday', es: 'Domingo' }, value: '0' },
                { label: { en: 'Monday', es: 'Lunes' }, value: '1' },
                { label: { en: 'Tuesday', es: 'Martes' }, value: '2' },
                { label: { en: 'Wednesday', es: 'Miércoles' }, value: '3' },
                { label: { en: 'Thursday', es: 'Jueves' }, value: '4' },
                { label: { en: 'Friday', es: 'Viernes' }, value: '5' },
                { label: { en: 'Saturday', es: 'Sábado' }, value: '6' },
              ],
            },
            {
              name: 'timeSlots',
              type: 'array',
              labels: {
                singular: { en: 'Time slot', es: 'Horario de salida' },
                plural: { en: 'Time slots', es: 'Horarios de salida' },
              },
              admin: {
                description: {
                  en: 'Departure times the tour runs and how many seats each one has. The booking flow reads this per-tour — no global default applies anymore.',
                  es: 'Horarios de salida del tour y cuántos lugares tiene cada uno. La reserva usa esto por cada tour — ya no hay un valor global por defecto.',
                },
              },
              fields: [
                {
                  name: 'time',
                  type: 'text',
                  required: true,
                  label: { en: 'Time', es: 'Hora' },
                  admin: {
                    description: {
                      en: '24h format HH:MM (e.g. "09:00", "14:30").',
                      es: 'Formato 24h HH:MM (ej.: "09:00", "14:30").',
                    },
                  },
                  validate: (value: string | null | undefined) => {
                    if (!value) return 'La hora es obligatoria.';
                    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
                      return 'La hora debe estar en formato HH:MM (24h).';
                    }
                    return true;
                  },
                },
                {
                  name: 'capacity',
                  type: 'number',
                  required: true,
                  min: 1,
                  label: { en: 'Capacity', es: 'Cupo' },
                  admin: {
                    description: {
                      en: 'Maximum persons (adults + teens) bookable in this departure slot.',
                      es: 'Máximo de personas (adultos + adolescentes) que se pueden reservar en esta salida.',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          label: { en: 'Seasonal', es: 'Temporada' },
          // Seasonal-only tab: shown only when `isSeasonal` is checked. The
          // `seasonal` group below is a NAMED group (keeps the `seasonal.*` data
          // namespace the frontend reads); its own condition is kept as a
          // belt-and-suspenders guard.
          admin: {
            condition: (data) => Boolean(data?.isSeasonal),
          },
          description: {
            en: 'Cinematic event content (hero, storytelling, gallery). Only used when "Is seasonal" is checked above.',
            es: 'Contenido cinematográfico del evento (portada, narrativa, galería). Solo se usa cuando arriba está marcado "Tour de temporada".',
          },
          fields: [
            {
              // Seasonal-only fields, revealed via admin.condition mirroring Hero.ts.
              // The whole group is non-rendered in the form unless `isSeasonal` is true.
              name: 'seasonal',
              type: 'group',
              label: { en: 'Seasonal content', es: 'Contenido de temporada' },
              admin: {
                condition: (data) => Boolean(data?.isSeasonal),
                description: {
                  en: 'Seasonal event content. Only used when "Is seasonal" is checked.',
                  es: 'Contenido del evento de temporada. Solo se usa cuando "Tour de temporada" está marcado.',
                },
              },
              fields: [
                {
                  // Display-only event date. Does NOT gate booking availability —
                  // booking still flows through timeSlots/capacity like any tour.
                  name: 'eventDate',
                  type: 'date',
                  label: { en: 'Event date', es: 'Fecha del evento' },
                  admin: {
                    description: {
                      en: 'Display-only date of the event. Does not affect booking availability.',
                      es: 'Fecha del evento (solo informativa). No afecta la disponibilidad de reservas.',
                    },
                  },
                },
                {
                  name: 'seasonWindow',
                  type: 'group',
                  label: { en: 'Season window', es: 'Ventana de temporada' },
                  admin: {
                    description: {
                      en: 'Display-only season window (e.g. the days the event runs).',
                      es: 'Ventana de temporada (solo informativa), ej.: los días en que se realiza el evento.',
                    },
                  },
                  fields: [
                    { name: 'start', type: 'date', label: { en: 'Start', es: 'Inicio' } },
                    { name: 'end', type: 'date', label: { en: 'End', es: 'Fin' } },
                  ],
                },
                {
                  // Cinematic full-bleed hero. Mirrors Hero.ts media pattern so it can
                  // be resolved by the same media helpers (Media + MediaVideo).
                  name: 'seasonalHero',
                  type: 'group',
                  label: { en: 'Seasonal hero', es: 'Portada de temporada' },
                  fields: [
                    {
                      name: 'mediaType',
                      type: 'select',
                      defaultValue: 'image',
                      label: { en: 'Media type', es: 'Tipo de medio' },
                      options: [
                        { label: { en: 'Image', es: 'Imagen' }, value: 'image' },
                        { label: { en: 'Video', es: 'Video' }, value: 'video' },
                      ],
                      admin: {
                        description: {
                          en: 'Choose the seasonal hero background medium.',
                          es: 'Elige el medio de fondo para la portada de temporada.',
                        },
                      },
                    },
                    {
                      name: 'image',
                      type: 'upload',
                      relationTo: 'media',
                      label: { en: 'Image', es: 'Imagen' },
                      admin: {
                        condition: (_, sibling) => sibling?.mediaType !== 'video',
                      },
                    },
                    {
                      name: 'video',
                      type: 'upload',
                      relationTo: 'mediaVideo',
                      label: { en: 'Video', es: 'Video' },
                      admin: {
                        condition: (_, sibling) => sibling?.mediaType === 'video',
                        description: {
                          en: 'Background video (muted, looping). Mobile/reduced-motion show the poster only.',
                          es: 'Video de fondo (sin sonido, en bucle). En móvil o con menos movimiento se muestra solo el póster.',
                        },
                      },
                    },
                    {
                      name: 'poster',
                      type: 'upload',
                      relationTo: 'media',
                      label: { en: 'Poster', es: 'Póster' },
                      admin: {
                        condition: (_, sibling) => sibling?.mediaType === 'video',
                        description: {
                          en: 'Poster: first paint + mobile/reduced-motion still.',
                          es: 'Póster: imagen fija inicial y para móvil o con menos movimiento.',
                        },
                      },
                    },
                  ],
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
                  name: 'storytelling',
                  type: 'array',
                  labels: {
                    singular: { en: 'Story block', es: 'Bloque de historia' },
                    plural: { en: 'Story blocks', es: 'Bloques de historia' },
                  },
                  admin: {
                    description: {
                      en: 'Structured storytelling blocks (heading + body + optional image).',
                      es: 'Bloques de narrativa (título + texto + imagen opcional).',
                    },
                  },
                  fields: [
                    {
                      name: 'heading',
                      type: 'text',
                      localized: true,
                      label: { en: 'Heading', es: 'Título' },
                    },
                    {
                      name: 'body',
                      type: 'textarea',
                      localized: true,
                      label: { en: 'Body', es: 'Texto' },
                    },
                    {
                      name: 'image',
                      type: 'upload',
                      relationTo: 'media',
                      label: { en: 'Image', es: 'Imagen' },
                    },
                  ],
                },
                {
                  name: 'eventLocation',
                  type: 'text',
                  localized: true,
                  label: { en: 'Event location', es: 'Lugar del evento' },
                  admin: {
                    description: {
                      en: 'Event location label, e.g. "Tlaxcala".',
                      es: 'Nombre del lugar del evento, ej.: "Tlaxcala".',
                    },
                  },
                },
                {
                  name: 'tagline',
                  type: 'text',
                  localized: true,
                  label: { en: 'Tagline', es: 'Frase destacada' },
                  admin: {
                    description: {
                      en: 'Short cinematic tagline shown over the hero.',
                      es: 'Frase corta y llamativa que se muestra sobre la portada.',
                    },
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
