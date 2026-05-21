import type { GlobalConfig } from 'payload';

/**
 * ContactInfo global — single source of contact channels for booking flow + footer.
 *
 * Locked decision: `address` is NON-LOCALIZED (same physical place).
 * `addressLabel` IS localized ("Studio" / "Estudio").
 */
export const ContactInfo: GlobalConfig = {
  slug: 'contact-info',
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'whatsapp',
      type: 'text',
      admin: {
        description: 'International format including country code, e.g. "+525555555555".',
      },
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'address',
      type: 'text',
      admin: {
        description: 'Physical address — same in both locales.',
      },
    },
    {
      name: 'addressLabel',
      type: 'text',
      localized: true,
      admin: {
        description: 'Optional label like "Studio" / "Estudio".',
      },
    },
  ],
};
