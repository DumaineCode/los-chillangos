import { render } from '@testing-library/react';
import type { ComponentProps, CSSProperties } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Footer } from './Footer';

// ---------------------------------------------------------------------------
// Footer wall background — visual-refresh fallback chain.
//
// Footer is an async Server Component reading globals via the Payload Local
// API, so we mock the data boundary (findGlobal), the Next runtime pieces
// (next/image, locale Link), and the interim-asset existence check (node:fs).
//
// Chain under test: CMS backgroundImage → static /brand/calle-mural.png →
// nothing rendered (flat #000 comes from the .footer CSS base — never a
// broken image).
// ---------------------------------------------------------------------------

const findGlobalMock = vi.fn();

vi.mock('../lib/payload', () => ({
  getPayload: () => Promise.resolve({ findGlobal: findGlobalMock }),
}));

vi.mock('../../i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: ComponentProps<'a'> & { href: unknown }) => (
    <a href={typeof href === 'string' ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

// next/image → plain img (jsdom can't run the Next image loader). Keeps
// className/style so the wall layer and focal object-position stay assertable.
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    style,
  }: {
    src: string;
    alt: string;
    className?: string;
    style?: CSSProperties;
  }) => <img src={src} alt={alt} className={className} style={style} />,
}));

// Interim-asset existence check. Mutable so each test picks its branch of the
// fallback chain. Default: the bundled asset exists (repo reality).
const existsSyncMock = vi.fn().mockReturnValue(true);

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const existsSync = (...args: unknown[]) => existsSyncMock(...args);
  return { ...actual, existsSync, default: { ...actual, existsSync } };
});

type GlobalsBySlug = Record<string, unknown>;

function stubGlobals(overrides: GlobalsBySlug = {}) {
  const globals: GlobalsBySlug = {
    footer: {
      tease: 'Come ride with us.',
      teaseEm: 'CDMX is waiting.',
      cta: 'Book a tour',
      copyright: '© Los Chillangos',
      geoLabel: '19.43°N · 99.13°W',
      columns: [],
    },
    'contact-info': { address: 'Calle Chilanga 1', email: 'hola@chillangos.mx' },
    'social-links': {},
    navigation: { bookCtaLabel: 'Book a tour' },
    branding: null,
    ...overrides,
  };
  findGlobalMock.mockImplementation(({ slug }: { slug: string }) =>
    Promise.resolve(globals[slug] ?? null)
  );
}

function cmsWallMedia() {
  return {
    id: 7,
    alt: 'Painted wall in Roma Norte',
    url: '/media/wall.jpg',
    updatedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    focalX: 30,
    focalY: 70,
  };
}

async function renderFooter() {
  return render(await Footer({ locale: 'en' }));
}

function wallImg(container: HTMLElement): HTMLImageElement | null {
  return container.querySelector<HTMLImageElement>('img.footer-wall');
}

beforeEach(() => {
  findGlobalMock.mockReset();
  existsSyncMock.mockReset().mockReturnValue(true);
});

describe('Footer — wall background fallback chain (visual refresh)', () => {
  it('renders the CMS image focal-point aware with a readability overlay', async () => {
    stubGlobals({
      footer: { columns: [], backgroundImage: cmsWallMedia() },
    });

    const { container } = await renderFooter();

    const img = wallImg(container);
    expect(img, 'expected the CMS wall image to render').not.toBeNull();
    expect(img?.getAttribute('src')).toContain('/media/wall.jpg');
    expect(img?.style.objectPosition).toBe('30% 70%');
    expect(
      container.querySelector('.footer-overlay'),
      'a dark overlay must keep footer text readable over the image'
    ).not.toBeNull();
  });

  it('falls back to the interim static mural when no CMS image is set', async () => {
    stubGlobals();

    const { container } = await renderFooter();

    const img = wallImg(container);
    expect(img, 'expected the interim wall image to render').not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/brand/calle-mural.png');
    expect(container.querySelector('.footer-overlay')).not.toBeNull();
  });

  it('treats an unhydrated media id as no CMS image (interim fallback)', async () => {
    stubGlobals({
      footer: { columns: [], backgroundImage: 7 },
    });

    const { container } = await renderFooter();

    expect(wallImg(container)?.getAttribute('src')).toBe('/brand/calle-mural.png');
  });

  it('renders no wall layer at all when the interim asset is also absent (flat #000 base)', async () => {
    stubGlobals();
    existsSyncMock.mockReturnValue(false);

    const { container } = await renderFooter();

    expect(wallImg(container), 'no image must render — never a broken image').toBeNull();
    expect(
      container.querySelector('.footer-overlay'),
      'no overlay without an image — flat #000 comes from the CSS base'
    ).toBeNull();
    // Footer content still renders normally on the flat base.
    expect(container.querySelector('.footer-headline')?.textContent).toContain(
      'Come ride with us.'
    );
  });
});
