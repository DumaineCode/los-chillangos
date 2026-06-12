import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Tour } from '../../payload-types';
import { EventStory } from './EventStory';

type StoryBlock = NonNullable<NonNullable<Tour['seasonal']>['storytelling']>[number];

/**
 * EventStory — storytelling blocks rendered as alternating rows, with graceful
 * degradation when there is nothing to show.
 *
 * Acceptance criteria (spec: "Graceful degradation"):
 *   - undefined / empty storytelling → renders nothing (section omitted)
 *   - populated blocks → renders headings and bodies
 */

describe('EventStory', () => {
  it('renders nothing when storytelling is undefined', () => {
    const { container } = render(<EventStory storytelling={undefined} eyebrow="The story" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when storytelling is an empty array', () => {
    const { container } = render(<EventStory storytelling={[]} eyebrow="The story" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when blocks have no heading, body, or image', () => {
    const blocks = [{ id: 'a' }] as StoryBlock[];
    const { container } = render(<EventStory storytelling={blocks} eyebrow="The story" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the eyebrow, heading and body of populated blocks', () => {
    const blocks = [
      { id: 'a', heading: 'Night one', body: 'Marigolds line the streets.' },
      { id: 'b', heading: 'Night two', body: 'The vigil begins.' },
    ] as StoryBlock[];
    render(<EventStory storytelling={blocks} eyebrow="The story" />);

    expect(screen.getByText('The story')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Night one' })).toBeInTheDocument();
    expect(screen.getByText('Marigolds line the streets.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Night two' })).toBeInTheDocument();
    expect(screen.getByText('The vigil begins.')).toBeInTheDocument();
  });
});
