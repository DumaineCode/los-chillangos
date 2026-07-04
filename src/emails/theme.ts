import type * as React from 'react';

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

/** Spacing scale (px strings — email clients need literal values). */
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const;

/** Corner radius scale. */
export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
} as const;

/**
 * Shared style primitives consumed by every template.
 *
 * Visual polish lands HERE, once — all templates inherit. Keep everything as
 * inline-style objects (react-email convention); no CSS classes, no custom
 * properties, email-client-safe values only.
 *
 * Intentional visual deltas vs. the pre-primitive per-template styles
 * (unification polish, NOT behavior-preserving 1:1 extraction):
 * - heading: margin unified to `0 0 8px` (Booking was `0 0 12px`,
 *   Owner/Contact `0 0 4px`); Owner/Contact also step 24px → 26px and gain
 *   `lineHeight: 32px`.
 * - subtle: gains `lineHeight: 21px`; bottom margin 20px → 24px.
 * - card: gains a hairline `1px solid colors.line` border (none before);
 *   margin unified to `0 0 24px` (Booking was `8px 0 24px`, Owner/Contact
 *   `0 0 20px`).
 * - cardTitle: bottom margin 6px → 4px.
 * - rowValue: Booking steps 16px → 15px (matches Owner/Contact).
 * - button: background navy → pink (brand primary accent); text cream
 *   (#FFF3D6) → white; padding `12px 22px` → `12px 24px`.
 * - paragraph, rowLabel, badge, sectionTitle, bullet, signature, message:
 *   extracted 1:1, unchanged.
 */
export const styles = {
  /** Serif display heading (guest greeting / notification title). */
  heading: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: '26px',
    lineHeight: '32px',
    margin: `0 0 ${spacing.sm}`,
  },
  /** Muted one-liner right under a heading. */
  subtle: {
    color: colors.inkMuted,
    fontFamily: fonts.sans,
    fontSize: '14px',
    lineHeight: '21px',
    margin: `0 0 ${spacing.lg}`,
  },
  /** Body copy. */
  paragraph: {
    color: colors.inkSoft,
    fontFamily: fonts.sans,
    fontSize: '15px',
    lineHeight: '24px',
    margin: `0 0 ${spacing.md}`,
  },
  /** Cream facts card. */
  card: {
    backgroundColor: colors.cream,
    border: `1px solid ${colors.line}`,
    borderRadius: radius.md,
    margin: `0 0 ${spacing.lg}`,
    padding: `${spacing.sm} 20px`,
  },
  /** Uppercase kicker at the top of a card. */
  cardTitle: {
    color: colors.navy,
    fontFamily: fonts.sans,
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    margin: `14px 0 ${spacing.xs}`,
    textTransform: 'uppercase',
  },
  /** Small uppercase label of a key/value row. */
  rowLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.sans,
    fontSize: '12px',
    letterSpacing: '0.04em',
    margin: '12px 0 0',
    textTransform: 'uppercase',
  },
  /** Value of a key/value row. */
  rowValue: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: '15px',
    fontWeight: 600,
    margin: '2px 0 12px',
  },
  /** Emphasized value (booking reference). */
  badge: {
    color: colors.pinkDeep,
    fontFamily: fonts.sans,
    fontSize: '16px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    margin: '2px 0 12px',
  },
  /** Uppercase section title between content blocks. */
  sectionTitle: {
    color: colors.navy,
    fontFamily: fonts.sans,
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    margin: `${spacing.lg} 0 ${spacing.sm}`,
    textTransform: 'uppercase',
  },
  /** Bulleted line in a "good to know" list. */
  bullet: {
    color: colors.inkSoft,
    fontFamily: fonts.sans,
    fontSize: '15px',
    lineHeight: '22px',
    margin: '0 0 6px',
    paddingLeft: '18px',
    textIndent: '-18px',
  },
  /** Serif sign-off line. */
  signature: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: '18px',
    margin: '20px 0 0',
  },
  /** Free-form user message (preserves line breaks). */
  message: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: '15px',
    lineHeight: '24px',
    margin: '2px 0 12px',
    whiteSpace: 'pre-wrap',
  },
  /** Primary action button (Rosa Mexicano). */
  button: {
    backgroundColor: colors.pink,
    borderRadius: '10px',
    color: colors.white,
    fontFamily: fonts.sans,
    fontSize: '14px',
    fontWeight: 700,
    padding: '12px 24px',
    textDecoration: 'none',
  },
} as const satisfies Record<string, React.CSSProperties>;
