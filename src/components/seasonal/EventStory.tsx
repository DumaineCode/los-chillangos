import Image from 'next/image';

import { resolveMediaImage } from '../../lib/media';
import { resolveMediaUrl } from '../../lib/seasonal/resolveMediaUrl';
import type { Tour } from '../../payload-types';

type StoryBlock = NonNullable<NonNullable<Tour['seasonal']>['storytelling']>[number];

type Props = {
  storytelling: StoryBlock[] | null | undefined;
  eyebrow: string;
};

/**
 * Storytelling section for a seasonal tour.
 *
 * Renders structured array blocks (heading + body + optional image) as
 * alternating two-column rows that stack on mobile. Returns `null` when there
 * are no blocks so the layout omits the section entirely (graceful
 * degradation — no empty heading, no crash).
 */
export function EventStory({ storytelling, eyebrow }: Props) {
  const blocks = (storytelling ?? []).filter(
    (b) => Boolean(b?.heading) || Boolean(b?.body) || Boolean(resolveMediaUrl(b?.image))
  );
  if (blocks.length === 0) return null;

  return (
    <section className="event-story container">
      <div className="eyebrow mono">{eyebrow}</div>
      {blocks.map((block, i) => {
        const image = resolveMediaImage(block.image);
        return (
          <div
            className={`event-story-row${i % 2 === 1 ? ' reverse' : ''}`}
            key={block.id ?? i}
          >
            <div className="event-story-text">
              {block.heading ? <h3>{block.heading}</h3> : null}
              {block.body ? <p>{block.body}</p> : null}
            </div>
            {image ? (
              <div className="event-story-media" style={{ position: 'relative' }}>
                <Image
                  src={image.url}
                  alt={block.heading ?? ''}
                  fill
                  sizes="(max-width: 900px) 100vw, 50vw"
                  style={{ objectFit: 'cover', objectPosition: image.objectPosition }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
