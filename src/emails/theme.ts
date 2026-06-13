/**
 * Shared brand tokens for booking emails.
 *
 * Email clients don't support CSS custom properties, so these mirror the
 * `app/globals.css` palette as literal hex values. Keep them in sync if the
 * brand palette changes.
 */
export const colors = {
  navy: '#0D182A', // Azul Profundo — header / ink
  cream: '#FFF3D6', // Crema — surfaces / on-navy text
  bg: '#FAFAF7', // off-white page background
  pink: '#FF2E7A', // Rosa Mexicano — primary accent
  pinkDeep: '#D11F60', // darker pink for borders/hovers
  maya: '#00B2D6', // Azul Maya — secondary accent
  white: '#FFFFFF',
  ink: '#0D182A',
  inkSoft: '#41506A', // navy ~80% on white
  inkMuted: '#7A8699', // navy ~50% on white
  line: '#E7E3D8', // hairline borders
} as const;

export const fonts = {
  sans: "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  serif: "'Instrument Serif', 'Cormorant Garamond', Georgia, 'Times New Roman', serif",
} as const;
