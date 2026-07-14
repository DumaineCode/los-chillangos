import type { GroupField } from 'payload';

/**
 * Reusable "choose a Google Font" field group, shared by the Landing hero
 * heading and the Footer tease headline.
 *
 * Emits a `group` field named `headingFont` with three optional subfields:
 *   - `family` (text)   — any Google Fonts family name, loaded at runtime
 *   - `weight` (select) — 100…900, matching the weights on fonts.google.com
 *   - `sizePx` (number) — max size on large screens; still scales responsively
 *
 * Not localized: typography is visual and identical across locales. When every
 * field is blank the element keeps its self-hosted default face.
 *
 * @param sizeExample - placeholder/default shown for the max-size field, so each
 *   element documents its own default cap (hero 82, footer 112).
 */
export function headingFontField(sizeExample: number): GroupField {
  return {
    name: 'headingFont',
    type: 'group',
    label: { en: 'Heading font', es: 'Fuente del título' },
    admin: {
      description: {
        en: 'Optional. Override the font of the main heading using any Google Font. Leave blank to keep the default.',
        es: 'Opcional. Cambia la fuente del título principal usando cualquier fuente de Google Fonts. Déjalo vacío para conservar la predeterminada.',
      },
    },
    fields: [
      {
        name: 'family',
        type: 'text',
        label: { en: 'Google Font name', es: 'Nombre de la fuente (Google Fonts)' },
        admin: {
          placeholder: 'Playfair Display',
          description: {
            en: 'Exact Google Fonts family name, e.g. "Playfair Display", "Oswald", "Montserrat". Copy it as written on fonts.google.com. Leave blank for the default.',
            es: 'Nombre exacto de la fuente en Google Fonts, ej.: "Playfair Display", "Oswald", "Montserrat". Cópialo tal cual aparece en fonts.google.com. Vacío = predeterminada.',
          },
        },
      },
      {
        name: 'weight',
        type: 'select',
        defaultValue: '700',
        label: { en: 'Weight', es: 'Peso' },
        options: [
          { label: '100 — Thin', value: '100' },
          { label: '200 — Extra Light', value: '200' },
          { label: '300 — Light', value: '300' },
          { label: '400 — Regular', value: '400' },
          { label: '500 — Medium', value: '500' },
          { label: '600 — Semi Bold', value: '600' },
          { label: '700 — Bold', value: '700' },
          { label: '800 — Extra Bold', value: '800' },
          { label: '900 — Black', value: '900' },
        ],
        admin: {
          description: {
            en: 'Font weight, matching the weights shown on Google Fonts. If the chosen font lacks this weight, the closest available one is used.',
            es: 'Grosor de la fuente, igual que los pesos que muestra Google Fonts. Si la fuente elegida no tiene este peso, se usa el más cercano disponible.',
          },
        },
      },
      {
        name: 'sizePx',
        type: 'number',
        min: 12,
        max: 300,
        label: { en: 'Max size (px)', es: 'Tamaño máximo (px)' },
        admin: {
          placeholder: String(sizeExample),
          description: {
            en: `Optional. Maximum heading size on large screens, in pixels (e.g. ${sizeExample}). It still scales down responsively on smaller screens. Leave blank for the default (${sizeExample}).`,
            es: `Opcional. Tamaño máximo del título en pantallas grandes, en píxeles (ej.: ${sizeExample}). Sigue reduciéndose de forma responsiva en pantallas chicas. Vacío = predeterminado (${sizeExample}).`,
          },
        },
      },
    ],
  };
}
