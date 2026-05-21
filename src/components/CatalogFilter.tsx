'use client';

import { useState, type ReactNode } from 'react';

type FilterKey = 'all' | 'ebike' | 'walking' | 'daytrip' | 'new';

type Props = {
  filters: { key: FilterKey; label: string }[];
  /**
   * Pre-rendered tour cards keyed by filter. Filtering happens client-side by
   * hiding/showing pre-rendered cards — no extra fetch round trip, full RSC
   * rendering preserved.
   */
  cards: { tour: { id: number; category: string; tag: string | null }; node: ReactNode }[];
};

/**
 * Catalog filter bar + tour grid (Client Component).
 *
 * The cards themselves are rendered server-side and passed in as ReactNode.
 * This component only handles the filter UI + visibility toggling.
 */
export function CatalogFilter({ filters, cards }: Props) {
  const [active, setActive] = useState<FilterKey>('all');

  const visible = cards.filter(({ tour }) => {
    if (active === 'all') return true;
    if (active === 'new') return tour.tag === 'New' || tour.tag === 'Nuevo';
    return tour.category === active;
  });

  return (
    <>
      <div className="filter-bar">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`filter-chip ${active === f.key ? 'active' : ''}`}
            onClick={() => setActive(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="tour-grid">{visible.map((v) => v.node)}</div>
    </>
  );
}
