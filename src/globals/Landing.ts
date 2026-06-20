import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { NAV_GROUPS } from '../admin/navGroups';

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
  label: { en: 'Home page', es: 'Página de inicio' },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  admin: {
    group: NAV_GROUPS.site,
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
          label: { en: 'Hero', es: 'Portada' },
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
            },
            {
              name: 'h1a',
              type: 'text',
              localized: true,
              label: { en: 'Headline word 1', es: 'Título — palabra 1' },
            },
            {
              name: 'h1b',
              type: 'text',
              localized: true,
              label: { en: 'Headline word 2', es: 'Título — palabra 2' },
            },
            {
              name: 'h1c',
              type: 'text',
              localized: true,
              label: { en: 'Headline word 3', es: 'Título — palabra 3' },
            },
            {
              name: 'h1d',
              type: 'text',
              localized: true,
              label: { en: 'Headline word 4', es: 'Título — palabra 4' },
            },
            {
              name: 'lede',
              type: 'textarea',
              localized: true,
              label: { en: 'Lede', es: 'Texto de entrada' },
            },
            {
              name: 'ctaPrimary',
              type: 'text',
              localized: true,
              label: { en: 'Primary button', es: 'Botón principal' },
            },
            {
              name: 'ctaGhost',
              type: 'text',
              localized: true,
              label: { en: 'Secondary button', es: 'Botón secundario' },
            },
            {
              // Structural (NOT localized): chooses the hero background medium.
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
                  en: 'Choose the hero background medium.',
                  es: 'Elige el medio de fondo de la portada.',
                },
              },
            },
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              label: { en: 'Hero image', es: 'Imagen de portada' },
              // Nested under a named tab → use siblingData (the `hero` object),
              // NOT the top-level document data.
              admin: { condition: (_, siblingData) => siblingData?.mediaType !== 'video' },
            },
            {
              name: 'heroVideo',
              type: 'upload',
              relationTo: 'mediaVideo',
              label: { en: 'Hero video', es: 'Video de portada' },
              admin: {
                condition: (_, siblingData) => siblingData?.mediaType === 'video',
                description: {
                  en: 'Background video (muted, looping). Mobile/reduced-motion show the poster only.',
                  es: 'Video de fondo (sin sonido, en bucle). En móvil o con menos movimiento se muestra solo el póster.',
                },
              },
            },
            {
              name: 'posterImage',
              type: 'upload',
              relationTo: 'media',
              label: { en: 'Poster image', es: 'Imagen de póster' },
              admin: {
                condition: (_, siblingData) => siblingData?.mediaType === 'video',
                description: {
                  en: 'Poster: first paint (LCP) + mobile/reduced-motion still. Strongly recommended.',
                  es: 'Póster: imagen inicial y para móvil o con menos movimiento. Muy recomendable.',
                },
              },
            },
            {
              name: 'live',
              type: 'text',
              localized: true,
              label: { en: 'Live status line', es: 'Línea de estado "en vivo"' },
              admin: {
                description: {
                  en: 'Top status line, e.g. "Live · CDMX · 19.43°N 99.13°W".',
                  es: 'Línea de estado de arriba, ej.: "Live · CDMX · 19.43°N 99.13°W".',
                },
              },
            },
            {
              name: 'estLabel',
              type: 'text',
              localized: true,
              label: { en: 'Est. label', es: 'Etiqueta "Est."' },
              admin: {
                description: {
                  en: 'Small label next to the neighborhoods, e.g. "Est. 2024".',
                  es: 'Etiqueta pequeña junto a los barrios, ej.: "Est. 2024".',
                },
              },
            },
            {
              name: 'neighborhoods',
              type: 'text',
              localized: true,
              label: { en: 'Neighborhoods', es: 'Barrios' },
              admin: {
                description: {
                  en: 'Neighborhoods line, e.g. "Roma · Condesa · Coyoacán · Centro".',
                  es: 'Línea de barrios, ej.: "Roma · Condesa · Coyoacán · Centro".',
                },
              },
            },
            {
              name: 'scroll',
              type: 'text',
              localized: true,
              label: { en: 'Scroll hint', es: 'Indicación de desplazamiento' },
              admin: {
                description: {
                  en: 'Scroll hint at the bottom of the hero, e.g. "Scroll".',
                  es: 'Indicación para desplazarse, al pie de la portada, ej.: "Scroll".',
                },
              },
            },
            {
              name: 'stats',
              type: 'array',
              labels: {
                singular: { en: 'Stat', es: 'Dato' },
                plural: { en: 'Stats', es: 'Datos' },
              },
              maxRows: 4,
              admin: {
                description: {
                  en: 'The four stat blocks shown under the hero lede.',
                  es: 'Los cuatro bloques de datos que se muestran bajo el texto de entrada.',
                },
              },
              fields: [
                {
                  name: 'num',
                  type: 'text',
                  required: true,
                  label: { en: 'Number', es: 'Número' },
                  admin: {
                    description: {
                      en: 'Big number, e.g. "12" or "3–4h".',
                      es: 'Número grande, ej.: "12" o "3–4h".',
                    },
                  },
                },
                {
                  name: 'label',
                  type: 'textarea',
                  required: true,
                  localized: true,
                  label: { en: 'Caption', es: 'Leyenda' },
                  admin: {
                    description: {
                      en: 'Caption under the number. Line breaks are kept.',
                      es: 'Leyenda debajo del número. Se respetan los saltos de línea.',
                    },
                  },
                },
              ],
            },
          ],
        },
        // ── Marquee ──────────────────────────────────────────────────────
        {
          name: 'marquee',
          label: { en: 'Marquee', es: 'Cinta de texto' },
          fields: [
            {
              name: 'text',
              type: 'text',
              localized: true,
              label: { en: 'Text', es: 'Texto' },
              admin: {
                description: {
                  en: 'Scrolling strip text, e.g. "Coyoacán · Roma Norte · Condesa · …". End with " ·" for a clean loop.',
                  es: 'Texto de la cinta que se desplaza, ej.: "Coyoacán · Roma Norte · Condesa · …". Termina con " ·" para un bucle limpio.',
                },
              },
            },
          ],
        },
        // ── Values ───────────────────────────────────────────────────────
        {
          name: 'values',
          label: { en: 'Values', es: 'Valores' },
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
              admin: {
                description: {
                  en: 'Small label, e.g. "Why us".',
                  es: 'Etiqueta pequeña, ej.: "Por qué nosotros".',
                },
              },
            },
            { name: 'title', type: 'text', localized: true, label: { en: 'Title', es: 'Título' } },
            {
              name: 'sub',
              type: 'textarea',
              localized: true,
              label: { en: 'Subheading', es: 'Subtítulo' },
              admin: {
                description: {
                  en: 'Subheading shown to the right of the title.',
                  es: 'Subtítulo que se muestra a la derecha del título.',
                },
              },
            },
            {
              name: 'items',
              type: 'array',
              labels: {
                singular: { en: 'Value', es: 'Valor' },
                plural: { en: 'Values', es: 'Valores' },
              },
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                  localized: true,
                  label: { en: 'Title', es: 'Título' },
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
          ],
        },
        // ── About ────────────────────────────────────────────────────────
        {
          name: 'about',
          label: { en: 'About', es: 'Sobre nosotros' },
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
              admin: {
                description: {
                  en: 'Small label, e.g. "Our approach".',
                  es: 'Etiqueta pequeña, ej.: "Nuestra forma de trabajar".',
                },
              },
            },
            {
              name: 'title',
              type: 'textarea',
              localized: true,
              label: { en: 'Title', es: 'Título' },
            },
            {
              name: 'p1',
              type: 'textarea',
              localized: true,
              label: { en: 'Paragraph 1', es: 'Párrafo 1' },
              admin: { description: { en: 'First paragraph.', es: 'Primer párrafo.' } },
            },
            {
              name: 'p2',
              type: 'textarea',
              localized: true,
              label: { en: 'Paragraph 2', es: 'Párrafo 2' },
              admin: { description: { en: 'Second paragraph.', es: 'Segundo párrafo.' } },
            },
            {
              name: 'meetCta',
              type: 'text',
              localized: true,
              label: { en: 'Button label', es: 'Texto del botón' },
              admin: {
                description: {
                  en: 'Button label, e.g. "Meet the guides →".',
                  es: 'Texto del botón, ej.: "Conoce a los guías →".',
                },
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              label: { en: 'Image', es: 'Imagen' },
              admin: {
                description: {
                  en: 'Photo for the section. If empty, a placeholder is shown.',
                  es: 'Foto de la sección. Si está vacía, se muestra un marcador de posición.',
                },
              },
            },
            {
              name: 'imageLabel',
              type: 'text',
              localized: true,
              label: { en: 'Image caption', es: 'Leyenda de la imagen' },
              admin: {
                description: {
                  en: 'Caption shown over the placeholder when no image is uploaded.',
                  es: 'Leyenda que se muestra sobre el marcador cuando no se ha subido una imagen.',
                },
              },
            },
          ],
        },
        // ── Testimonial ──────────────────────────────────────────────────
        {
          name: 'testimonial',
          label: { en: 'Testimonial', es: 'Testimonio' },
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
              admin: {
                description: {
                  en: 'Small label, e.g. "Notes from guests".',
                  es: 'Etiqueta pequeña, ej.: "Lo que dicen los viajeros".',
                },
              },
            },
            {
              name: 'items',
              type: 'array',
              label: { en: 'Testimonials', es: 'Testimonios' },
              admin: {
                description: {
                  en: 'Each entry is a full testimonial shown in the slider. The layout stays identical across slides.',
                  es: 'Cada entrada es un testimonio completo que se muestra en el slider. El diseño es idéntico en todos.',
                },
              },
              fields: [
                {
                  name: 'quote',
                  type: 'textarea',
                  localized: true,
                  label: { en: 'Quote', es: 'Cita' },
                },
                {
                  name: 'name',
                  type: 'text',
                  label: { en: 'Guest name', es: 'Nombre del viajero' },
                  admin: {
                    description: {
                      en: 'Guest name, e.g. "Hana K.".',
                      es: 'Nombre del viajero, ej.: "Hana K.".',
                    },
                  },
                },
                {
                  name: 'loc',
                  type: 'text',
                  localized: true,
                  label: { en: 'Location / date', es: 'Lugar / fecha' },
                  admin: {
                    description: {
                      en: 'Location / date line, e.g. "Brooklyn, NY · Mar 2026".',
                      es: 'Línea de lugar y fecha, ej.: "Brooklyn, NY · Mar 2026".',
                    },
                  },
                },
                {
                  name: 'avatar',
                  type: 'upload',
                  relationTo: 'media',
                  label: { en: 'Photo', es: 'Foto' },
                  admin: {
                    description: {
                      en: 'Guest photo. If empty, a placeholder circle is shown.',
                      es: 'Foto del viajero. Si está vacía, se muestra un círculo de marcador.',
                    },
                  },
                },
              ],
            },
          ],
        },
        // ── Services ─────────────────────────────────────────────────────
        {
          name: 'services',
          label: { en: 'Services', es: 'Servicios' },
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
              admin: {
                description: {
                  en: 'Small label, e.g. "Beyond the tour".',
                  es: 'Etiqueta pequeña, ej.: "Más allá del tour".',
                },
              },
            },
            { name: 'title', type: 'text', localized: true, label: { en: 'Title', es: 'Título' } },
            {
              name: 'sub',
              type: 'textarea',
              localized: true,
              label: { en: 'Subheading', es: 'Subtítulo' },
            },
            {
              name: 'inquireCta',
              type: 'text',
              localized: true,
              label: { en: 'Link label', es: 'Texto del enlace' },
              admin: {
                description: {
                  en: 'Link label on each card, e.g. "Inquire →".',
                  es: 'Texto del enlace en cada tarjeta, ej.: "Consultar →".',
                },
              },
            },
            {
              name: 'items',
              type: 'array',
              labels: {
                singular: { en: 'Service', es: 'Servicio' },
                plural: { en: 'Services', es: 'Servicios' },
              },
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                  localized: true,
                  label: { en: 'Title', es: 'Título' },
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
          ],
        },
        // ── FAQ ──────────────────────────────────────────────────────────
        {
          name: 'faq',
          label: { en: 'FAQ', es: 'Preguntas frecuentes' },
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
              admin: {
                description: {
                  en: 'Small label, e.g. "Practical".',
                  es: 'Etiqueta pequeña, ej.: "Información práctica".',
                },
              },
            },
            { name: 'title', type: 'text', localized: true, label: { en: 'Title', es: 'Título' } },
            {
              name: 'items',
              type: 'array',
              labels: {
                singular: { en: 'Question', es: 'Pregunta' },
                plural: { en: 'Questions', es: 'Preguntas' },
              },
              fields: [
                {
                  name: 'question',
                  type: 'text',
                  required: true,
                  localized: true,
                  label: { en: 'Question', es: 'Pregunta' },
                },
                {
                  name: 'answer',
                  type: 'textarea',
                  required: true,
                  localized: true,
                  label: { en: 'Answer', es: 'Respuesta' },
                },
              ],
            },
          ],
        },
        // ── Team ─────────────────────────────────────────────────────────
        {
          name: 'team',
          label: { en: 'Team', es: 'Equipo' },
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
              admin: {
                description: {
                  en: 'Small label, e.g. "The people".',
                  es: 'Etiqueta pequeña, ej.: "Las personas".',
                },
              },
            },
            {
              name: 'title',
              type: 'text',
              localized: true,
              label: { en: 'Title', es: 'Título' },
              admin: {
                description: {
                  en: 'Section heading, e.g. "Our team".',
                  es: 'Título de la sección, ej.: "Nuestro equipo".',
                },
              },
            },
            {
              name: 'sub',
              type: 'textarea',
              localized: true,
              label: { en: 'Subheading', es: 'Subtítulo' },
              admin: {
                description: {
                  en: 'Optional short intro under the heading.',
                  es: 'Introducción corta opcional debajo del título.',
                },
              },
            },
            {
              name: 'items',
              type: 'array',
              labels: {
                singular: { en: 'Member', es: 'Integrante' },
                plural: { en: 'Members', es: 'Integrantes' },
              },
              admin: {
                description: {
                  en: 'Add team members. Three look best in a row.',
                  es: 'Agrega integrantes del equipo. Tres se ven mejor en una fila.',
                },
              },
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                  label: { en: 'Name', es: 'Nombre' },
                  admin: {
                    description: {
                      en: 'Person name, e.g. "Diego R.".',
                      es: 'Nombre de la persona, ej.: "Diego R.".',
                    },
                  },
                },
                {
                  name: 'role',
                  type: 'text',
                  required: true,
                  localized: true,
                  label: { en: 'Role', es: 'Rol' },
                  admin: {
                    description: {
                      en: 'Role / title, e.g. "Lead guide".',
                      es: 'Rol o puesto, ej.: "Guía principal".',
                    },
                  },
                },
                {
                  name: 'photo',
                  type: 'upload',
                  relationTo: 'media',
                  label: { en: 'Photo', es: 'Foto' },
                  admin: {
                    description: {
                      en: 'Profile photo. If empty, a placeholder circle is shown.',
                      es: 'Foto de perfil. Si está vacía, se muestra un círculo de marcador.',
                    },
                  },
                },
              ],
            },
          ],
        },
        // ── Seasonal ─────────────────────────────────────────────────────
        {
          name: 'seasonal',
          label: { en: 'Seasonal', es: 'Temporada' },
          fields: [
            {
              name: 'enabled',
              type: 'checkbox',
              defaultValue: false,
              label: { en: 'Show on home page', es: 'Mostrar en la página de inicio' },
              admin: {
                description: {
                  en: 'Show the seasonal highlight on the landing page.',
                  es: 'Muestra el destacado de temporada en la página de inicio.',
                },
              },
            },
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
              admin: {
                description: {
                  en: 'Small label above the highlight, e.g. "This season".',
                  es: 'Etiqueta pequeña sobre el destacado, ej.: "Esta temporada".',
                },
              },
            },
            {
              name: 'featuredSeasonalTour',
              type: 'relationship',
              relationTo: 'tours',
              hasMany: false,
              label: { en: 'Featured seasonal tour', es: 'Tour de temporada destacado' },
              admin: {
                description: {
                  en: 'The seasonal tour to highlight. Must be published and marked seasonal.',
                  es: 'El tour de temporada a destacar. Debe estar publicado y marcado como de temporada.',
                },
              },
            },
          ],
        },
      ],
    },
  ],
};
