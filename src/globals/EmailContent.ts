import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';

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
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  admin: {
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
      admin: {
        description: 'Optional logo for the email header. If empty, the brand name is shown.',
      },
    },
    {
      name: 'confirmation',
      type: 'group',
      label: 'Confirmation email',
      fields: [
        {
          name: 'subject',
          type: 'text',
          localized: true,
          admin: {
            description: 'Email subject. Tokens: {tour}, {reference}.',
            placeholder: 'Your booking is confirmed — {reference}',
          },
        },
        {
          name: 'previewText',
          type: 'text',
          localized: true,
          admin: {
            description: 'Inbox preview snippet shown next to the subject (~90 chars).',
          },
        },
        {
          name: 'greeting',
          type: 'text',
          localized: true,
          admin: {
            description: 'Greeting line. Token: {name}.',
            placeholder: 'Hi {name},',
          },
        },
        {
          name: 'intro',
          type: 'textarea',
          localized: true,
          admin: {
            description: 'Opening paragraph under the greeting.',
          },
        },
        {
          name: 'goodToKnow',
          type: 'textarea',
          localized: true,
          admin: {
            description: 'Things to know before the tour. One item per line — shown as bullets.',
          },
        },
        {
          name: 'meetingPoint',
          type: 'textarea',
          localized: true,
          admin: {
            description: 'Optional meeting-point note. Leave empty to hide the section.',
          },
        },
        {
          name: 'closing',
          type: 'textarea',
          localized: true,
          admin: {
            description: 'Optional closing line before the signature.',
          },
        },
        {
          name: 'signature',
          type: 'text',
          localized: true,
          admin: {
            description: 'Sign-off line.',
            placeholder: '— The Los Chillangos team',
          },
        },
        {
          name: 'footnote',
          type: 'textarea',
          localized: true,
          admin: {
            description: 'Small print in the footer (e.g. cancellation policy).',
          },
        },
      ],
    },
  ],
};
