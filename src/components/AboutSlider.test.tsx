import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ResolvedImage } from '../lib/media';
import { AboutSlider } from './AboutSlider';

/**
 * AboutSlider focal-point integration (FR-1, FR-9).
 *
 * The slider now takes structured `ResolvedImage[]` (url + objectPosition + alt)
 * instead of bare url strings, so each slide frames by its own focal point.
 * The active slide uses the shared frame `alt`; inactive slides are decorative.
 */
function img(url: string, objectPosition: string): ResolvedImage {
  return { url, objectPosition, alt: '' };
}

describe('AboutSlider', () => {
  it('renders one image per slide with its own object-position (FR-1)', () => {
    const images = [img('/a.jpg', '20% 80%'), img('/b.jpg', '70% 30%')];
    const { container } = render(<AboutSlider images={images} alt="Los Chillangos" />);

    // Inactive slides are decorative (alt=""), so query the raw <img> tags:
    // every slide is in the DOM regardless of accessible role.
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveStyle({ objectPosition: '20% 80%' });
    expect(imgs[1]).toHaveStyle({ objectPosition: '70% 30%' });
    expect(imgs[0]).toHaveStyle({ objectFit: 'cover' });
  });

  it('uses the frame alt for the active slide (FR-9)', () => {
    const images = [img('/a.jpg', '50% 50%'), img('/b.jpg', '50% 50%')];
    render(<AboutSlider images={images} alt="Our crew in CDMX" />);

    // The first slide is active on mount → carries the frame alt.
    expect(screen.getByAltText('Our crew in CDMX')).toBeInTheDocument();
  });
});
