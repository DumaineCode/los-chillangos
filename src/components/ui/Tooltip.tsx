'use client';

import { useId, useState } from 'react';

type Props = {
  /** The disclaimer / fine print to reveal. */
  content: string;
  /** Accessible label for the ⓘ trigger button (e.g. "More info about Private tour"). */
  label: string;
};

/**
 * Accessible info (ⓘ) tooltip.
 *
 * Behavior (WCAG-minded):
 *   - Trigger is a real <button> → keyboard-focusable and tab-ordered.
 *   - Opens on focus/hover and on click (mobile tap toggles it).
 *   - The revealed text has role="tooltip" and is wired to the trigger via
 *     `aria-describedby`, so assistive tech announces it.
 *   - Escape closes it; blur closes it.
 *   - 44×44px hit target; honors `prefers-reduced-motion` via the global CSS
 *     transition utility (no JS animation here).
 *
 * Styling stays inline + minimal so the component is drop-in on the public
 * tour page without a new stylesheet. No CSS-class assertions in tests — the
 * contract is the semantics above.
 */
export function Tooltip({ content, label }: Props) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-muted)',
          lineHeight: 1,
        }}
      >
        {/* ⓘ info glyph as inline SVG (no emoji icons). */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {open ? (
        <span
          id={tipId}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            minWidth: 200,
            maxWidth: 280,
            padding: '10px 12px',
            background: 'var(--ink, #1a1a1a)',
            color: 'var(--cream, #fff)',
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.5,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            whiteSpace: 'normal',
          }}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
