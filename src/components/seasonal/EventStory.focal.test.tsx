import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Tour } from '../../payload-types';
import { EventStory } from './EventStory';

type StoryBlock = NonNullable<NonNullable<Tour['seasonal']>['storytelling']>[number];

/**
 * EventStory focal-point integration (FR-1, FR-2).
 *
 * The rendered cover <img> must carry an `object-position` reflecting the
 * stored focal point, defaulting to `50% 50%` for legacy/null focal.
 */
describe('EventStory — focal point', () => {
  it('applies the stored focal point as object-position (FR-1)', () => {
    const blocks = [
      {
        id: 'a',
        heading: 'Night one',
        image: { id: 1, url: '/media/story.jpg', focalX: 20, focalY: 80 },
      },
    ] as StoryBlock[];
    render(<EventStory storytelling={blocks} eyebrow="The story" />);

    const img = screen.getByRole('img');
    expect(img).toHaveStyle({ objectPosition: '20% 80%' });
    expect(img).toHaveStyle({ objectFit: 'cover' });
  });

  it('defaults to 50% 50% for legacy/null focal (FR-2)', () => {
    const blocks = [
      { id: 'a', heading: 'Night one', image: { id: 1, url: '/media/story.jpg' } },
    ] as StoryBlock[];
    render(<EventStory storytelling={blocks} eyebrow="The story" />);

    expect(screen.getByRole('img')).toHaveStyle({ objectPosition: '50% 50%' });
  });
});
