import { describe, expect, it, vi } from 'vitest';

// Importing `page` transitively pulls in the next-intl locale-aware navigation,
// which can't resolve `next/navigation` under jsdom. `generateMetadata` doesn't
// use it, so stub the module to keep the import graph loadable.
vi.mock('../../i18n/navigation', () => ({ Link: () => null }));

import { generateMetadata } from './page';

// ---------------------------------------------------------------------------
// generateMetadata — SEO decoupled from hero copy (hero inversion).
//
// The hero heading is now the editorial `quote`, which is a poor <title>. So
// generateMetadata MUST NOT set a per-page `title` (nor an OG `title`): with no
// override, Next falls back to the fixed brand default in `app/layout.tsx`. This
// also means generateMetadata no longer reaches into Payload at all.
// ---------------------------------------------------------------------------

describe('generateMetadata — hero inversion', () => {
  it('sets no per-page title so the root brand default wins', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(meta.title).toBeUndefined();
    expect(meta.openGraph?.title).toBeUndefined();
  });

  it('keeps openGraph type/locale and the language alternates', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'es' }) });

    expect(meta.openGraph).toMatchObject({ type: 'website', locale: 'es' });
    expect(meta.alternates?.languages).toEqual({ en: '/en', es: '/es' });
  });
});
