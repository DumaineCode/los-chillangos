import type { CSSProperties } from 'react';

/**
 * A CMS-chosen Google Font (the `headingFont` group shared by the hero and
 * footer). All fields optional: when `family` is blank the element keeps its
 * self-hosted default face.
 */
export type GoogleFontConfig = {
  family?: string | null;
  weight?: string | null;
  sizePx?: number | null;
};

/**
 * Responsive size ramp used to build the `clamp()` when `sizePx` is set. Only
 * the upper cap comes from the CMS; `floorPx` and `vw` keep each element's own
 * small-screen behavior (they differ between hero and footer).
 */
export type SizeRamp = { floorPx: number; vw: number };

export type ResolveGoogleFontOptions = {
  /** Small-screen floor + viewport ramp for the size clamp. */
  sizeRamp?: SizeRamp;
  /** CSS variable used as the font-family fallback (e.g. '--display-alt'). */
  fallbackVar?: string;
};

export type ResolvedGoogleFont = {
  /** Google Fonts stylesheet URL to load at runtime, or null for the default. */
  linkHref: string | null;
  /** Inline style to apply to the target element. Empty object keeps defaults. */
  style: CSSProperties;
};

/**
 * Turn a CMS-chosen Google Font into a stylesheet URL + inline style.
 *
 * Runtime (not build-time) font loading: `next/font/google` needs statically
 * analyzable imports, so an arbitrary family picked in the admin can't go
 * through it. Instead we emit a `<link>` to `fonts.googleapis.com/css2` and set
 * `font-family` inline, falling back to the element's self-hosted default var.
 *
 * The family name is sanitized to `[A-Za-z0-9 ]` before it reaches the URL and
 * the inline style, so a malformed CMS value can't break the request or inject
 * anything into the markup.
 */
export function resolveGoogleFont(
  config?: GoogleFontConfig | null,
  options: ResolveGoogleFontOptions = {},
): ResolvedGoogleFont {
  const { sizeRamp = { floorPx: 40, vw: 5.6 }, fallbackVar = '--display-alt' } = options;

  const style: CSSProperties = {};
  let linkHref: string | null = null;

  // Google Fonts family names are ASCII letters, digits and spaces. Stripping
  // everything else keeps the css2 URL well-formed (no stray `:`/`@`/quotes).
  const family = (config?.family ?? '').replace(/[^A-Za-z0-9 ]/g, '').trim();
  const weight = (config?.weight ?? '').trim();
  const sizePx = config?.sizePx;

  if (family) {
    const familyParam = family.replace(/\s+/g, '+');
    const wght = /^\d{3}$/.test(weight) ? weight : '700';
    linkHref = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${wght}&display=swap`;
    // Quote the family (it may contain spaces) and keep the element's default as
    // the fallback so a font that fails to load still renders a sensible face.
    style.fontFamily = `"${family}", var(${fallbackVar})`;
  }

  if (/^\d{3}$/.test(weight)) {
    style.fontWeight = Number(weight);
  }

  if (typeof sizePx === 'number' && Number.isFinite(sizePx) && sizePx > 0) {
    // Preserve responsive scaling: keep the element's floor + vw ramp, only
    // override the upper cap so the text still shrinks on small screens.
    style.fontSize = `clamp(${sizeRamp.floorPx}px, ${sizeRamp.vw}vw, ${sizePx}px)`;
  }

  return { linkHref, style };
}
