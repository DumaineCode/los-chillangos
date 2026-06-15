import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Footer global — bottom-of-page link columns + tease copy + copyright.
 *
 * `columns` is an array of column blocks, each with a title and a list of
 * links. Seed creates 3 columns: Tours, Company, Help — matching the legacy
 * `data.js` shape.
 */
export const Footer: GlobalConfig = {
  slug: 'footer',
  label: { en: 'Footer', es: 'Pie de página' },
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
      name: 'tease',
      type: 'text',
      localized: true,
      label: { en: 'Tease line', es: 'Frase principal' },
      admin: {
        description: {
          en: 'Main tease line, e.g. "Come ride with us.".',
          es: 'Frase principal, ej.: "Ven a pedalear con nosotros.".',
        },
      },
    },
    {
      name: 'teaseEm',
      type: 'text',
      localized: true,
      label: { en: 'Emphasized tease', es: 'Frase destacada (cursiva)' },
      admin: {
        description: {
          en: 'Emphasized (italic) tease, e.g. "CDMX is waiting.".',
          es: 'Frase en cursiva, ej.: "CDMX te espera.".',
        },
      },
    },
    {
      name: 'cta',
      type: 'text',
      localized: true,
      label: { en: 'Button label', es: 'Texto del botón' },
    },
    {
      name: 'copyright',
      type: 'text',
      localized: true,
      label: { en: 'Copyright', es: 'Derechos de autor' },
    },
    {
      name: 'geoLabel',
      type: 'text',
      label: { en: 'Coordinates label', es: 'Coordenadas' },
      admin: {
        description: {
          en: 'Coordinates shown bottom-right, e.g. "19.43°N · 99.13°W".',
          es: 'Coordenadas que se muestran abajo a la derecha, ej.: "19.43°N · 99.13°W".',
        },
      },
    },
    {
      name: 'columns',
      type: 'array',
      labels: {
        singular: { en: 'Column', es: 'Columna' },
        plural: { en: 'Columns', es: 'Columnas' },
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
          name: 'links',
          type: 'array',
          labels: {
            singular: { en: 'Link', es: 'Enlace' },
            plural: { en: 'Links', es: 'Enlaces' },
          },
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
              localized: true,
              label: { en: 'Label', es: 'Texto' },
            },
            {
              name: 'href',
              type: 'text',
              required: true,
              label: { en: 'Link', es: 'Destino' },
            },
          ],
        },
      ],
    },
  ],
};
