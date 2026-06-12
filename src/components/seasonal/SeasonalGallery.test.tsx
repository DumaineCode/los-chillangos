import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Tour } from '../../payload-types';
import { SeasonalGallery } from './SeasonalGallery';

type GalleryItem = NonNullable<NonNullable<Tour['seasonal']>['gallery']>[number];

/**
 * SeasonalGallery — responsive grid with graceful degradation.
 *
 * Acceptance criteria (spec: "Graceful degradation"):
 *   - undefined / empty gallery → renders nothing (section omitted)
 *   - items with no resolvable media → renders nothing
 *   - items with resolvable media → renders one image per item
 */

describe('SeasonalGallery', () => {
  it('renders nothing when gallery is undefined', () => {
    const { container } = render(
      <SeasonalGallery gallery={undefined} eyebrow="Gallery" title="Tour" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when gallery items have no resolvable media', () => {
    const items = [{ id: 'a', image: 123 }] as GalleryItem[];
    const { container } = render(
      <SeasonalGallery gallery={items} eyebrow="Gallery" title="Tour" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one image per item with resolvable media', () => {
    const items = [
      { id: 'a', image: { id: 1, url: '/media/1.jpg' } },
      { id: 'b', image: { id: 2, url: '/media/2.jpg' } },
    ] as GalleryItem[];
    render(<SeasonalGallery gallery={items} eyebrow="Gallery" title="Día" />);

    expect(screen.getByText('Gallery')).toBeInTheDocument();
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('alt', 'Día — 1');
    expect(imgs[1]).toHaveAttribute('alt', 'Día — 2');
  });
});
