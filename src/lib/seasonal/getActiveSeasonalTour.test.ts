import { describe, expect, it, vi } from 'vitest';

import type { Tour } from '../../payload-types';
import { getActiveSeasonalTour } from './getActiveSeasonalTour';

/**
 * Unit tests for `getActiveSeasonalTour` — the Payload-backed resolver used by
 * the landing page. We inject a minimal fake Payload exposing `findGlobal` and
 * `find`, asserting:
 *   - !enabled                → null, no `find` query issued
 *   - ref unset               → null, no `find` query issued
 *   - enabled + ref           → queries published + isSeasonal at depth:2,
 *                               returns docs[0]
 *   - query returns no docs   → null
 */

const featuredTour = {
  id: 42,
  slug: 'dia-de-muertos',
  title: 'Día de Muertos',
  isSeasonal: true,
  _status: 'published',
} as unknown as Tour;

function makePayload(opts: {
  global: unknown;
  docs?: Tour[];
}) {
  const find = vi.fn(async () => ({ docs: opts.docs ?? [] }));
  const findGlobal = vi.fn(async () => opts.global);
  return { payload: { find, findGlobal }, find, findGlobal };
}

describe('getActiveSeasonalTour', () => {
  it('returns null and skips the find query when the feature is disabled', async () => {
    const { payload, find } = makePayload({
      global: { enabled: false, featuredSeasonalTour: 42 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getActiveSeasonalTour(payload as any, 'en');

    expect(result).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it('returns null and skips the find query when no tour is referenced', async () => {
    const { payload, find } = makePayload({
      global: { enabled: true, featuredSeasonalTour: null },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getActiveSeasonalTour(payload as any, 'en');

    expect(result).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it('queries published + isSeasonal at depth 2 and returns the first doc', async () => {
    const { payload, find } = makePayload({
      global: { enabled: true, featuredSeasonalTour: 42 },
      docs: [featuredTour],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getActiveSeasonalTour(payload as any, 'es');

    expect(result).toBe(featuredTour);
    expect(find).toHaveBeenCalledTimes(1);
    const arg = (find.mock.calls[0] as unknown[])[0] as {
      collection: string;
      locale: string;
      depth: number;
      limit: number;
      where: { and: Array<Record<string, unknown>> };
    };
    expect(arg.collection).toBe('tours');
    expect(arg.locale).toBe('es');
    expect(arg.depth).toBe(2);
    expect(arg.limit).toBe(1);
    // The where clause must constrain id + published + seasonal.
    const flattened = JSON.stringify(arg.where);
    expect(flattened).toContain('"equals":42');
    expect(flattened).toContain('published');
    expect(flattened).toContain('isSeasonal');
  });

  it('returns null when the query yields no matching tour', async () => {
    const { payload } = makePayload({
      global: { enabled: true, featuredSeasonalTour: 42 },
      docs: [],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getActiveSeasonalTour(payload as any, 'en');

    expect(result).toBeNull();
  });
});
