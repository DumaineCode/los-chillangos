import { describe, expect, it } from 'vitest';

import { resolveGoogleFont } from './googleFont';

describe('resolveGoogleFont', () => {
  it('returns no link and empty style when config is missing or blank', () => {
    expect(resolveGoogleFont(null)).toEqual({ linkHref: null, style: {} });
    expect(resolveGoogleFont(undefined)).toEqual({ linkHref: null, style: {} });
    expect(resolveGoogleFont({ family: '   ' })).toEqual({ linkHref: null, style: {} });
  });

  it('builds a css2 URL and quoted font-family for a chosen family', () => {
    const { linkHref, style } = resolveGoogleFont({ family: 'Playfair Display', weight: '800' });
    expect(linkHref).toBe(
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@800&display=swap',
    );
    expect(style.fontFamily).toBe('"Playfair Display", var(--display-alt)');
    expect(style.fontWeight).toBe(800);
  });

  it('defaults the URL weight to 700 when weight is absent or invalid', () => {
    expect(resolveGoogleFont({ family: 'Oswald' }).linkHref).toBe(
      'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap',
    );
    expect(resolveGoogleFont({ family: 'Oswald', weight: 'bold' }).linkHref).toContain('wght@700');
  });

  it('sanitizes the family name so it cannot break the URL or markup', () => {
    const { linkHref, style } = resolveGoogleFont({
      family: 'Evil"; @import url(x)',
      weight: '400',
    });
    // Only [A-Za-z0-9 ] survive: "Evil import urlx".
    expect(linkHref).toBe(
      'https://fonts.googleapis.com/css2?family=Evil+import+urlx:wght@400&display=swap',
    );
    expect(style.fontFamily).toBe('"Evil import urlx", var(--display-alt)');
  });

  it('overrides only the clamp cap with sizePx, keeping the default hero ramp', () => {
    expect(resolveGoogleFont({ sizePx: 96 }).style.fontSize).toBe('clamp(40px, 5.6vw, 96px)');
    expect(resolveGoogleFont({ sizePx: 0 }).style.fontSize).toBeUndefined();
    expect(resolveGoogleFont({ sizePx: -5 }).style.fontSize).toBeUndefined();
  });

  it('honors a custom size ramp and fallback var', () => {
    const { style } = resolveGoogleFont(
      { family: 'Lora', weight: '500', sizePx: 112 },
      { sizeRamp: { floorPx: 48, vw: 7 }, fallbackVar: '--serif' },
    );
    expect(style.fontSize).toBe('clamp(48px, 7vw, 112px)');
    expect(style.fontFamily).toBe('"Lora", var(--serif)');
  });

  it('applies weight and size even without a family (uses default face)', () => {
    const { linkHref, style } = resolveGoogleFont({ weight: '300', sizePx: 60 });
    expect(linkHref).toBeNull();
    expect(style.fontFamily).toBeUndefined();
    expect(style.fontWeight).toBe(300);
    expect(style.fontSize).toBe('clamp(40px, 5.6vw, 60px)');
  });
});
