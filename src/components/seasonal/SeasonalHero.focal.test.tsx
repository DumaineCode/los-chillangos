import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Tour } from '../../payload-types';
import { SeasonalHero } from './SeasonalHero';

type Seasonal = NonNullable<Tour['seasonal']>;

function renderHero(seasonal: Seasonal) {
  return render(
    <SeasonalHero
      seasonal={seasonal}
      title="Día de Muertos"
      locale="en"
      dateLabel="Date"
      locationLabel="Location"
    />
  );
}

/**
 * SeasonalHero focal-point integration (FR-1, FR-2).
 *
 * The full-bleed image hero applies the stored focal point as object-position,
 * defaulting to `50% 50%` for legacy/null focal. (The video branch keeps center
 * framing and is out of scope here.)
 */
describe('SeasonalHero — focal point', () => {
  it('applies the stored focal point on the image hero (FR-1)', () => {
    renderHero({
      seasonalHero: {
        mediaType: 'image',
        image: { id: 1, url: '/media/hero.jpg', focalX: 30, focalY: 65 },
      },
    } as Seasonal);

    const img = screen.getByRole('img');
    expect(img).toHaveStyle({ objectPosition: '30% 65%' });
    expect(img).toHaveStyle({ objectFit: 'cover' });
  });

  it('defaults to 50% 50% for legacy/null focal (FR-2)', () => {
    renderHero({
      seasonalHero: { mediaType: 'image', image: { id: 1, url: '/media/hero.jpg' } },
    } as Seasonal);

    expect(screen.getByRole('img')).toHaveStyle({ objectPosition: '50% 50%' });
  });
});
