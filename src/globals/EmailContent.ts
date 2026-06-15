import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * EmailContent global — editable marketing copy for booking emails.
 *
 * Scope decision: this global holds the COPY the client may want to tweak
 * (greeting, intro, what-to-know bullets, etc.) — NOT the structural labels
 * or layout, which live in code (`src/emails/strings.ts`). That keeps the
 * admin focused and makes it impossible to break the email layout from the CMS.
 *
 * Localized fields fall back per the global localization config. Any field
 * left empty falls back to the in-code defaults (`src/lib/email/defaults.ts`),
 * so a fresh install sends a correct bilingual email with zero configuration.
 *
 * Tokens (replaced at send time):
 *   {name}      — customer first name (greeting)
 *   {tour}      — tour title (subject)
 *   {reference} — booking reference (subject)
 */
export const EmailContent: GlobalConfig = {
  slug: 'email-content',
  label: { en: 'Automated emails', es: 'Correos automáticos' },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  admin: {
    group: NAV_GROUPS.settings,
    description:
      'Wording for the booking confirmation email sent to guests after payment. ' +
      'Leave a field empty to use the built-in default. Dynamic details (tour, ' +
      'date, time, guests, total, reference) are added automatically.',
  },
  fields: [
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: { en: 'Logo', es: 'Logo' },
      admin: {
        description: {
          en: 'Optional logo for the email header. If empty, the brand name is shown.',
          es: 'Logo opcional para el encabezado del correo. Si está vacío, se muestra el nombre de la marca.',
        },
      },
    },
    {
      name: 'confirmation',
      type: 'group',
      label: { en: 'Confirmation email', es: 'Correo de confirmación' },
      fields: [
        {
          name: 'subject',
          type: 'text',
          localized: true,
          label: { en: 'Subject', es: 'Asunto' },
          admin: {
            description: {
              en: 'Email subject. Tokens: {tour}, {reference}.',
              es: 'Asunto del correo. Etiquetas que se reemplazan solas: {tour}, {reference}.',
            },
            placeholder: {
              en: 'Your booking is confirmed — {reference}',
              es: 'Tu reserva está confirmada — {reference}',
            },
          },
        },
        {
          name: 'previewText',
          type: 'text',
          localized: true,
          label: { en: 'Preview text', es: 'Texto de vista previa' },
          admin: {
            description: {
              en: 'Inbox preview snippet shown next to the subject (~90 chars).',
              es: 'Fragmento de vista previa que se ve junto al asunto en la bandeja (~90 caracteres).',
            },
          },
        },
        {
          name: 'greeting',
          type: 'text',
          localized: true,
          label: { en: 'Greeting', es: 'Saludo' },
          admin: {
            description: {
              en: 'Greeting line. Token: {name}.',
              es: 'Línea de saludo. Etiqueta que se reemplaza sola: {name}.',
            },
            placeholder: { en: 'Hi {name},', es: 'Hola {name},' },
          },
        },
        {
          name: 'intro',
          type: 'textarea',
          localized: true,
          label: { en: 'Intro', es: 'Introducción' },
          admin: {
            description: {
              en: 'Opening paragraph under the greeting.',
              es: 'Párrafo de apertura debajo del saludo.',
            },
          },
        },
        {
          name: 'goodToKnow',
          type: 'textarea',
          localized: true,
          label: { en: 'Good to know', es: 'Qué tener en cuenta' },
          admin: {
            description: {
              en: 'Things to know before the tour. One item per line — shown as bullets.',
              es: 'Cosas que conviene saber antes del tour. Una por línea — se muestran como viñetas.',
            },
          },
        },
        {
          name: 'meetingPoint',
          type: 'textarea',
          localized: true,
          label: { en: 'Meeting point', es: 'Punto de encuentro' },
          admin: {
            description: {
              en: 'Optional meeting-point note. Leave empty to hide the section.',
              es: 'Nota opcional del punto de encuentro. Déjalo vacío para ocultar la sección.',
            },
          },
        },
        {
          name: 'closing',
          type: 'textarea',
          localized: true,
          label: { en: 'Closing', es: 'Cierre' },
          admin: {
            description: {
              en: 'Optional closing line before the signature.',
              es: 'Línea de cierre opcional antes de la firma.',
            },
          },
        },
        {
          name: 'signature',
          type: 'text',
          localized: true,
          label: { en: 'Signature', es: 'Firma' },
          admin: {
            description: { en: 'Sign-off line.', es: 'Línea de despedida.' },
            placeholder: {
              en: '— The Los Chillangos team',
              es: '— El equipo de Los Chillangos',
            },
          },
        },
        {
          name: 'footnote',
          type: 'textarea',
          localized: true,
          label: { en: 'Footnote', es: 'Nota al pie' },
          admin: {
            description: {
              en: 'Small print in the footer (e.g. cancellation policy).',
              es: 'Letra chica del pie (ej.: política de cancelación).',
            },
          },
        },
      ],
    },
  ],
};
