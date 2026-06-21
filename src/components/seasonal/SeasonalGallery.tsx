import Image from 'next/image';

import { resolveMediaImage, type ResolvedImage } from '../../lib/media';
import type { Tour } from '../../payload-types';

type GalleryItem = NonNullable<NonNullable<Tour['seasonal']>['gallery']>[number];

type Props = {
  gallery: GalleryItem[] | null | undefined;
  eyebrow: string;
  title: string;
};

/**
 * Responsive seasonal gallery grid (no lightbox).
 *
 * Renders only items that resolve to a real media URL. Returns `null` when no
 * images resolve, so the section is omitted entirely (graceful degradation).
 */
export function SeasonalGallery({ gallery, eyebrow, title }: Props) {
  const items = (gallery ?? [])
    .map((item) => ({ id: item?.id, image: resolveMediaImage(item?.image) }))
    .filter(
      (item): item is { id: string | null | undefined; image: ResolvedImage } =>
        item.image !== null
    );

  if (items.length === 0) return null;

  return (
    <section className="seasonal-gallery-section container">
      <div className="eyebrow mono">{eyebrow}</div>
      <div className="seasonal-gallery">
        {items.map((item, i) => (
          <div className="seasonal-gallery-item" key={item.id ?? i} style={{ position: 'relative' }}>
            <Image
              src={item.image.url}
              alt={`${title} — ${i + 1}`}
              fill
              sizes="(max-width: 900px) 50vw, 33vw"
              style={{ objectFit: 'cover', objectPosition: item.image.objectPosition }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
