import type { Tour } from '../../payload-types';

/**
 * Decide whether the detail route should render the seasonal template.
 *
 * Backward-compatible: only an explicit `isSeasonal === true` opts a tour into
 * the seasonal layout. `false`, `null`, and `undefined` (legacy tours) all keep
 * the standard layout. Pure and deterministic.
 */
export function shouldRenderSeasonal(tour: Pick<Tour, 'isSeasonal'>): boolean {
  return tour.isSeasonal === true;
}
