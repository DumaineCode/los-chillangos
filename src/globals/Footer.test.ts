import { describe, expect, it } from 'vitest';

import { Footer } from './Footer';

// ---------------------------------------------------------------------------
// Footer global — visual-refresh wall background field.
//
// The footer gains a CMS-replaceable `backgroundImage` upload (relation to the
// `media` collection). The field is structural — NOT localized — because the
// wall photo is shared across locales, matching the Branding/Hero upload
// convention. Until the owner uploads one, the frontend falls back to the
// interim static asset, then to the flat #000 CSS base.
// ---------------------------------------------------------------------------

function fieldByName(name: string) {
  return Footer.fields.find((f) => 'name' in f && f.name === name);
}

describe('Footer — backgroundImage field (visual refresh)', () => {
  it('exposes an upload field relating to the media collection', () => {
    const field = fieldByName('backgroundImage');
    expect(field, 'expected a "backgroundImage" field on the Footer global').toBeDefined();
    expect(field && 'type' in field && field.type).toBe('upload');
    expect(field && 'relationTo' in field && field.relationTo).toBe('media');
  });

  it('is NOT localized (one shared wall photo across locales)', () => {
    const field = fieldByName('backgroundImage');
    expect(
      field && 'localized' in field && field.localized,
      'uploads are structural — must not fork per locale'
    ).toBeFalsy();
  });
});
