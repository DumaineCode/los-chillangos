import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Tour } from '../../payload-types';
import { SeasonalGallery } from './SeasonalGallery';

type GalleryItem = NonNullable<NonNullable<Tour['seasonal']>['gallery']>[number];

/**
 * SeasonalGallery focal-point integration (FR-1, FR-2).
 *
 * Each gallery image carries its own object-position from its focal point,
 * defaulting to `50% 50%` when focal is null.
 */
describe('SeasonalGallery — focal point', () => {
  it('applies per-item focal points as object-position (FR-1)', () => {
    const items = [
      { id: 'a', image: { id: 1, url: '/media/1.jpg', focalX: 10, focalY: 90 } },
      { id: 'b', image: { id: 2, url: '/media/2.jpg', focalX: 70, focalY: 25 } },
    ] as GalleryItem[];
    render(<SeasonalGallery gallery={items} eyebrow="Gallery" title="Día" />);

    const imgs = screen.getAllByRole('img');
    expect(imgs[0]).toHaveStyle({ objectPosition: '10% 90%' });
    expect(imgs[1]).toHaveStyle({ objectPosition: '70% 25%' });
    expect(imgs[0]).toHaveStyle({ objectFit: 'cover' });
  });

  it('defaults to 50% 50% for legacy/null focal (FR-2)', () => {
    const items = [{ id: 'a', image: { id: 1, url: '/media/1.jpg' } }] as GalleryItem[];
    render(<SeasonalGallery gallery={items} eyebrow="Gallery" title="Día" />);

    expect(screen.getByRole('img')).toHaveStyle({ objectPosition: '50% 50%' });
  });
});
