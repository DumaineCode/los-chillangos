import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Site-wide single-source-of-truth guard (FR-11) + non-destructive guard (FR-15).
 *
 * Statically scans every cover-crop render surface and asserts NONE of them
 * computes an `object-position` percentage or a `?v=` cache-bust token inline:
 * the focal → percentage math lives ONLY in `focal.ts` and the version token
 * ONLY in `resolveMediaImage.ts`. This is what keeps the frontend, the videos,
 * and the in-admin preview from ever diverging.
 *
 * The surface = the 6 sites wired by the prior change + the 4 image sites + the
 * 2 video sites + the admin preview wired here.
 */

const ROOT = process.cwd();

const RENDER_SITES = [
  'app/[locale]/page.tsx',
  'app/[locale]/tours/[slug]/page.tsx',
  'src/components/seasonal/SeasonalHero.tsx',
  'src/components/seasonal/SeasonalGallery.tsx',
  'src/components/seasonal/EventStory.tsx',
  'src/components/seasonal/HighlightSeasonal.tsx',
  'src/components/AboutSlider.tsx',
  'src/components/TourCard.tsx',
  'src/components/admin/FocalPreviewField.tsx',
];

// `${expr}%` — the fingerprint of inline focal→percentage math. A static
// `'50% 50%'` default literal has no `${`, so it is correctly allowed.
const INLINE_PERCENT = /\$\{[^}]*\}\s*%/;
// `?v=` / `&v=` — a cache-bust token appended inline.
const INLINE_VERSION = /[?&]v=/;

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('focal single source of truth (FR-11 guard)', () => {
  it.each(RENDER_SITES)('does not build object-position or ?v= inline: %s', (rel) => {
    const src = read(rel);
    expect(src, `${rel} must not interpolate a focal percentage inline`).not.toMatch(
      INLINE_PERCENT
    );
    expect(src, `${rel} must not append a ?v= cache-bust token inline`).not.toMatch(INLINE_VERSION);
  });

  it('keeps the percentage math in the focal helper seam only', () => {
    expect(read('src/lib/media/focal.ts')).toMatch(INLINE_PERCENT);
    // Resolver delegates to the seam instead of re-implementing the math.
    expect(read('src/lib/media/resolveMediaImage.ts')).toMatch(/focalToObjectPosition\(/);
  });

  it('keeps the cache-bust token in the resolver only', () => {
    expect(read('src/lib/media/resolveMediaImage.ts')).toMatch(/v=\$\{/);
  });
});

describe('focal is non-destructive (FR-15 guard)', () => {
  it('the focal seam never touches the binary or size variants (pure data/CSS)', () => {
    // Changing focal only re-frames via CSS object-position + metadata columns;
    // no image re-encode or filesystem write happens in the focal path.
    for (const rel of ['src/lib/media/focal.ts', 'src/lib/media/resolveMediaImage.ts']) {
      const src = read(rel);
      expect(src, `${rel} must not import an image processor`).not.toMatch(/from ['"]sharp['"]/);
      expect(src, `${rel} must not write files`).not.toMatch(/writeFile|createWriteStream|fs\./);
    }
  });
});
