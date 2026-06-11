'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { LOADER_VIEWBOX, LoaderMarkPaths } from './loaderMark';

/**
 * Full-screen intro loader for Los Chillangos.
 *
 * Behaviour:
 *  - Shows ONCE per browser session (tracked via sessionStorage). Navigating
 *    between routes does not re-trigger it.
 *  - The brand mark fills bottom-to-top by animating a clipPath rectangle over
 *    the multicolour SVG, so the reveal follows the exact shape of every path.
 *  - When the fill completes, the overlay fades out and unmounts, revealing the
 *    page underneath.
 *  - Respects `prefers-reduced-motion`: motion-averse users get a brief static
 *    flash instead of the sweep, then it is dismissed.
 *
 * The overlay uses the theme background (`--bg`) so it adapts to light/dark.
 */

const SESSION_KEY = 'lc-intro-shown';
const FILL_DURATION_MS = 2200;
const FADE_DURATION_MS = 600;

export function PageLoader() {
  // Start hidden; an effect decides whether to show it after mount. This keeps
  // SSR output stable (no overlay in the server HTML) and avoids hydration
  // mismatches around sessionStorage / matchMedia.
  const [phase, setPhase] = useState<'idle' | 'filling' | 'fading' | 'done'>('idle');
  const clipId = useId().replace(/:/g, '');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already shown this session — never show again.
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Lock scroll while the overlay is visible.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    setPhase('filling');

    const fillTime = reducedMotion ? 350 : FILL_DURATION_MS;

    timers.current.push(
      setTimeout(() => setPhase('fading'), fillTime),
      setTimeout(
        () => {
          setPhase('done');
          document.body.style.overflow = prevOverflow;
        },
        fillTime + FADE_DURATION_MS,
      ),
    );

    const captured = timers.current;
    return () => {
      captured.forEach(clearTimeout);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (phase === 'idle' || phase === 'done') return null;

  return (
    <div
      className={`page-loader${phase === 'fading' ? ' is-fading' : ''}`}
      role="status"
      aria-label="Loading"
      aria-live="polite"
    >
      <svg
        className="page-loader-mark"
        viewBox={LOADER_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`loaderFill-${clipId}`}>
            {/* This rect grows upward (y shrinks, height grows) to reveal the
                mark from the bottom. The animation is declared in globals.css
                via the .page-loader-fill class. */}
            <rect
              className="page-loader-fill"
              x="0"
              y="0"
              width="2912"
              height="2606"
            />
          </clipPath>
        </defs>

        {/* Faint ghost of the full mark so users see the shape before it fills. */}
        <g className="page-loader-ghost">
          <LoaderMarkPaths />
        </g>

        {/* The colour mark, clipped to the rising rectangle. */}
        <g clipPath={`url(#loaderFill-${clipId})`}>
          <LoaderMarkPaths />
        </g>
      </svg>
    </div>
  );
}
