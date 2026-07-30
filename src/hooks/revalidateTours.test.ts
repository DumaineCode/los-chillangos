import { beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidatePath, revalidateTag } from 'next/cache';

import { revalidateToursAfterChange, revalidateToursAfterDelete } from './revalidateTours';

/**
 * Regression tests for the tour detail on-demand revalidation.
 *
 * `revalidatePath('/[locale]/tours/${slug}', 'page')` mixed a route
 * placeholder with a concrete slug — that string matches no route, so the
 * call was a silent no-op and edited tours kept serving stale detail pages
 * until the ISR window expired. Dynamic routes must be revalidated with the
 * FULL route pattern (`/[locale]/tours/[slug]`).
 */

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

function makeArgs(doc: { slug?: string }) {
  return {
    doc,
    req: { payload: { logger: { warn: vi.fn() } } },
  } as unknown as Parameters<typeof revalidateToursAfterChange>[0];
}

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(revalidateTag).mockClear();
});

describe('revalidateToursAfterChange', () => {
  it('revalidates the tour detail ROUTE PATTERN, never a placeholder/slug mix', () => {
    revalidateToursAfterChange(makeArgs({ slug: 'coyoacan-classic' }));

    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/tours/[slug]', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
    // The buggy shape: pattern segment + concrete slug matches nothing.
    for (const [path] of vi.mocked(revalidatePath).mock.calls) {
      expect(path).not.toBe('/[locale]/tours/coyoacan-classic');
    }
  });

  it('invalidates the shared and per-slug cache tags', () => {
    revalidateToursAfterChange(makeArgs({ slug: 'coyoacan-classic' }));

    expect(revalidateTag).toHaveBeenCalledWith('tours');
    expect(revalidateTag).toHaveBeenCalledWith('tour:coyoacan-classic');
  });

  it('skips the detail-path revalidation when the doc has no slug', () => {
    revalidateToursAfterChange(makeArgs({}));

    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
  });
});

describe('revalidateToursAfterDelete', () => {
  it('invalidates tags and the landing page', () => {
    revalidateToursAfterDelete(
      makeArgs({ slug: 'coyoacan-classic' }) as unknown as Parameters<
        typeof revalidateToursAfterDelete
      >[0]
    );

    expect(revalidateTag).toHaveBeenCalledWith('tours');
    expect(revalidateTag).toHaveBeenCalledWith('tour:coyoacan-classic');
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
  });
});
