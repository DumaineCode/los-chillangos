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
            // ── Hero heading (the quote) ─────────────────────────────────
            // The quote IS the primary hero heading (rendered as the single
            // <h1>), so it leads the tab and is required. The author is
            // optional attribution shown beneath it.
            {
              name: 'quote',
              type: 'textarea',
              localized: true,
              required: true,
              label: { en: 'Hero heading (quote)', es: 'Título principal (cita)' },
              admin: {
                description: {
                  en: 'The big primary hero heading. Shown as the main <h1>, e.g. a famous quote. Wrap text in *asterisks* to highlight it in pink, e.g. "La vida es *corta*".',
                  es: 'El título principal grande de la portada. Se muestra como el <h1>, ej.: una cita célebre. Envuelve texto en *asteriscos* para resaltarlo en rosa, ej.: "La vida es *corta*".',
                },
              },
            },
            {
              // NOT localized: a proper name is identical in both languages.
              name: 'quoteAuthor',
              type: 'text',
              label: { en: 'Quote — author', es: 'Cita — autor' },
              admin: {
                description: {
                  en: 'Optional attribution shown under the heading, e.g. "Frida Kahlo".',
                  es: 'Atribución opcional que se muestra bajo el título, ej.: "Frida Kahlo".',
                },
              },
            },
            // ── Primary button (label + link) ────────────────────────────
            {
              name: 'ctaPrimary',
              type: 'text',
              localized: true,
              label: { en: 'Primary button — label', es: 'Botón principal — texto' },
            },
            {
              // Destination is NOT localized: the same target works for both
              // languages (anchors stay #anchor, /book → /es/book via
              // next-intl's localized Link).
              name: 'ctaPrimaryHref',
              type: 'text',
              defaultValue: '#tours',
              label: { en: 'Primary button — link', es: 'Botón principal — destino' },
              admin: {
                description: {
                  en: 'Where the primary button takes the visitor. Examples: "#tours" (section on the home page), "/book" (another page on your site), "https://wa.me/52...".',
                  es: 'A dónde lleva el botón principal. Ejemplos: "#tours" (una sección de la página de inicio), "/book" (otra página de tu sitio), "https://wa.me/52...".',
                },
              },
            },
            // ── Secondary button (label + link) ──────────────────────────
            {
              name: 'ctaGhost',
              type: 'text',
              localized: true,
              label: { en: 'Secondary button — label', es: 'Botón secundario — texto' },
            },
            {
              name: 'ctaGhostHref',
              type: 'text',
              defaultValue: '#about',
              label: { en: 'Secondary button — link', es: 'Botón secundario — destino' },
              admin: {
                description: {
                  en: 'Where the secondary button takes the visitor. Examples: "#about", "/services", "mailto:hola@…".',
                  es: 'A dónde lleva el botón secundario. Ejemplos: "#about", "/services", "mailto:hola@…".',
                },
              },
            },
            // ── Rentals button (label + link) ────────────────────────────
            // Visual refresh: the hero grows to 4 CTAs. The two new buttons
            // render ONLY when their label is filled, so existing rows keep
            // showing exactly the original 2 CTAs until the owner (or seed)
            // provides copy.
            {
              name: 'ctaRentals',
              type: 'text',
              localized: true,
              label: { en: 'Rentals button — label', es: 'Botón de rentas — texto' },
              admin: {
                description: {
                  en: 'Optional. Shown only when filled, e.g. "Rent a bike". Links to the rentals catalog.',
                  es: 'Opcional. Se muestra solo si tiene texto, ej.: "Renta una bici". Enlaza al catálogo de rentas.',
                },
              },
            },
            {
              name: 'ctaRentalsHref',
              type: 'text',
              defaultValue: '/rentals',
              label: { en: 'Rentals button — link', es: 'Botón de rentas — destino' },
              admin: {
                description: {
                  en: 'Where the rentals button takes the visitor. Default: "/rentals".',
                  es: 'A dónde lleva el botón de rentas. Predeterminado: "/rentals".',
                },
              },
            },
            // ── Plan-your-own-trip button (label + link) ─────────────────
            {
              name: 'ctaPlan',
              type: 'text',
              localized: true,
              label: { en: 'Plan-your-trip button — label', es: 'Botón de viaje a medida — texto' },
              admin: {
                description: {
                  en: 'Optional. Shown only when filled, e.g. "Plan your own trip". Links to the contact section.',
                  es: 'Opcional. Se muestra solo si tiene texto, ej.: "Arma tu propio viaje". Enlaza a la sección de contacto.',
                },
              },
            },
            {
              name: 'ctaPlanHref',
              type: 'text',
              defaultValue: '#contact',
              label: { en: 'Plan-your-trip button — link', es: 'Botón de viaje a medida — destino' },
              admin: {
                description: {
                  en: 'Where the plan-your-trip button takes the visitor. Default: "#contact".',
                  es: 'A dónde lleva el botón de viaje a medida. Predeterminado: "#contact".',
                },
              },
            },
            // ── Background media ─────────────────────────────────────────
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
              label: { en: 'Image (fallback)', es: 'Imagen (alternativa)' },
              admin: {
                description: {
                  en: 'Single photo, used only when the gallery below is empty. If both are empty, a placeholder is shown.',
                  es: 'Foto única, se usa solo cuando la galería de abajo está vacía. Si ambas están vacías, se muestra un marcador de posición.',
                },
              },
            },
            {
              name: 'images',
              type: 'array',
              label: { en: 'Image gallery (slider)', es: 'Galería de imágenes (slider)' },
              maxRows: 8,
              admin: {
                description: {
                  en: 'Upload one or more photos. With two or more, they auto-rotate as a slider in the same image frame (no design change). Swipe or drag also works.',
                  es: 'Subí una o más fotos. Con dos o más, rotan solas como slider en el mismo marco de imagen (sin cambiar el diseño). También se puede deslizar o arrastrar.',
                },
              },
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                  label: { en: 'Photo', es: 'Foto' },
                },
              ],
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
        // ── Rentals ──────────────────────────────────────────────────────
        // Featured bike-rentals home block. Mirrors the other marketing tabs
        // (eyebrow/title/sub + CTA label, all localized). Like the seasonal tab
        // it relates to a collection conceptually, but the CTA destination is
        // the fixed `/rentals` catalog route — so there is no per-row relation,
        // just localized copy + a link the home page renders.
        {
          name: 'rentals',
          label: { en: 'Bike rentals', es: 'Renta de bicicletas' },
          fields: [
            {
              name: 'eyebrow',
              type: 'text',
              localized: true,
              label: { en: 'Eyebrow', es: 'Antetítulo' },
              admin: {
                description: {
                  en: 'Small label above the block, e.g. "Bike rentals".',
                  es: 'Etiqueta pequeña sobre el bloque, ej.: "Renta de bicicletas".',
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
                  en: 'Block heading, e.g. "Rather ride on your own?".',
                  es: 'Título del bloque, ej.: "¿Prefieres rodar por tu cuenta?".',
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
                  en: 'Short copy under the heading.',
                  es: 'Texto corto debajo del título.',
                },
              },
            },
            {
              name: 'ctaLabel',
              type: 'text',
              localized: true,
              label: { en: 'Button label', es: 'Texto del botón' },
              admin: {
                description: {
                  en: 'Label on the button that links to the rentals catalog, e.g. "Browse rentals →".',
                  es: 'Texto del botón que enlaza al catálogo de rentas, ej.: "Ver rentas →".',
                },
              },
            },
          ],
        },
      ],
    },
  ],
};
