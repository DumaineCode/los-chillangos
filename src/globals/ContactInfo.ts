import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * ContactInfo global — single source of contact channels for booking flow + footer.
 *
 * Locked decision: `address` is NON-LOCALIZED (same physical place).
 * `addressLabel` IS localized ("Studio" / "Estudio").
 */
export const ContactInfo: GlobalConfig = {
  slug: 'contact-info',
  label: { en: 'Contact details', es: 'Datos de contacto' },
  admin: {
    group: NAV_GROUPS.settings,
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
  },
  fields: [
    {
      name: 'whatsapp',
      type: 'text',
      label: { en: 'WhatsApp', es: 'WhatsApp' },
      admin: {
        description: {
          en: 'International format including country code, e.g. "+525555555555".',
          es: 'Formato internacional con código de país, ej.: "+525555555555".',
        },
      },
    },
    {
      name: 'email',
      type: 'email',
      label: { en: 'Email', es: 'Correo electrónico' },
    },
    {
      name: 'phone',
      type: 'text',
      label: { en: 'Phone', es: 'Teléfono' },
    },
    {
      name: 'address',
      type: 'text',
      label: { en: 'Address', es: 'Dirección' },
      admin: {
        description: {
          en: 'Physical address — same in both locales.',
          es: 'Dirección física — la misma en ambos idiomas.',
        },
      },
    },
    {
      name: 'address2',
      type: 'text',
      label: { en: 'Address line 2', es: 'Dirección (línea 2)' },
      admin: {
        description: {
          en: 'Second address line, e.g. "Ciudad de México, 06700".',
          es: 'Segunda línea de la dirección, ej.: "Ciudad de México, 06700".',
        },
      },
    },
    {
      name: 'addressLabel',
      type: 'text',
      localized: true,
      label: { en: 'Address label', es: 'Etiqueta de la dirección' },
      admin: {
        description: {
          en: 'Optional label like "Studio" / "Estudio".',
          es: 'Etiqueta opcional como "Estudio".',
        },
      },
    },
  ],
};
