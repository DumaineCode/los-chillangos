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

/**
 * SeasonalHero video focal-point integration (FR-14).
 *
 * The <video> element's object-position frames BOTH the video and its poster
 * with one value. Per design it is poster-first (the poster is the
 * focal-annotated LCP/reduced-motion still), falling through to the video's own
 * focal only when there is no poster, and to 50% 50% when neither has focal.
 * Asserted via querySelector('video') — a <video> has no img role.
 */
describe('SeasonalHero — video focal point', () => {
  it('frames the video by the poster focal point (poster-first)', () => {
    const { container } = renderHero({
      seasonalHero: {
        mediaType: 'video',
        video: { id: 1, url: '/media/clip.mp4', focalX: 80, focalY: 20 },
        poster: { id: 2, url: '/media/poster.jpg', focalX: 30, focalY: 65 },
      },
    } as Seasonal);

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveStyle({ objectPosition: '30% 65%' });
    expect(video).toHaveStyle({ objectFit: 'cover' });
  });

  it('falls back to the video focal point when there is no poster', () => {
    const { container } = renderHero({
      seasonalHero: {
        mediaType: 'video',
        video: { id: 1, url: '/media/clip.mp4', focalX: 80, focalY: 20 },
      },
    } as Seasonal);

    expect(container.querySelector('video')).toHaveStyle({ objectPosition: '80% 20%' });
  });

  it('defaults to 50% 50% when neither poster nor video has focal', () => {
    const { container } = renderHero({
      seasonalHero: {
        mediaType: 'video',
        video: { id: 1, url: '/media/clip.mp4' },
      },
    } as Seasonal);

    expect(container.querySelector('video')).toHaveStyle({ objectPosition: '50% 50%' });
  });
});
