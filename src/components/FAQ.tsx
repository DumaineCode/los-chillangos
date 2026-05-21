'use client';

import { useState } from 'react';

type Item = {
  q: string;
  a: string;
};

type Props = {
  items: Item[];
};

/**
 * FAQ accordion (Client Component).
 *
 * Mirrors the legacy behavior: clicking an open item closes it; clicking a
 * closed item opens it and closes the others. First item starts open to
 * match the legacy default (`useState(0)`).
 */
export function FAQList({ items }: Props) {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div className="faq-list">
      {items.map((f, i) => (
        <div
          key={i}
          className={`faq-item ${openIdx === i ? 'open' : ''}`}
          onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
        >
          <div className="faq-q">
            <span>{f.q}</span>
            <span className="faq-toggle">+</span>
          </div>
          <div className="faq-a">{f.a}</div>
        </div>
      ))}
    </div>
  );
}
