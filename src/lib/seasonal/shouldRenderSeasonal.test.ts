import { describe, expect, it } from 'vitest';

import type { Tour } from '../../payload-types';
import { shouldRenderSeasonal } from './shouldRenderSeasonal';

/**
 * Unit tests for `shouldRenderSeasonal` — the predicate the detail route uses
 * to branch between the seasonal template and the standard layout.
 *
 * Acceptance criteria (spec: "Seasonal detail layout"):
 *   - isSeasonal=true  → render the seasonal template
 *   - isSeasonal=false → render the standard layout
 *   - isSeasonal null/undefined → standard layout (backward-compatible default)
 */

function tour(isSeasonal: Tour['isSeasonal']): Tour {
  return { id: 1, slug: 't', title: 'T', isSeasonal } as Tour;
}

describe('shouldRenderSeasonal', () => {
  it('returns true when the tour is seasonal', () => {
    expect(shouldRenderSeasonal(tour(true))).toBe(true);
  });

  it('returns false when the tour is explicitly not seasonal', () => {
    expect(shouldRenderSeasonal(tour(false))).toBe(false);
  });

  it('returns false when isSeasonal is null (legacy tours)', () => {
    expect(shouldRenderSeasonal(tour(null))).toBe(false);
  });

  it('returns false when isSeasonal is undefined', () => {
    expect(shouldRenderSeasonal(tour(undefined))).toBe(false);
  });
});
