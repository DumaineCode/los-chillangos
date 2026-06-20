'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  /** Resolved image URLs, in display order. Caller guarantees length >= 2. */
  images: string[];
  /** Shared alt text for the editorial frame. */
  alt: string;
  /** Auto-rotation interval in ms. */
  intervalMs?: number;
};

const SWIPE_THRESHOLD = 40; // px of horizontal travel to count as a swipe
const RESUME_DELAY = 6000; // pause autoplay this long after a manual swipe

/**
 * About-section image slider (Client Component).
 *
 * Cross-fades through the gallery inside the existing `.editorial-img` frame —
 * same box, same `aspect-ratio`, zero layout change. Auto-rotates on a timer
 * and supports touch/mouse swipe. Controls are intentionally hidden to keep
 * the editorial look clean. A manual swipe pauses autoplay briefly so we never
 * fight the visitor. Respects `prefers-reduced-motion` by disabling autoplay.
 */
export function AboutSlider({ images, alt, intervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      setIndex((next + images.length) % images.length);
    },
    [images.length]
  );

  const pauseThenResume = useCallback(() => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), RESUME_DELAY);
  }, []);

  // Auto-rotation. Skipped when paused or when the user prefers reduced motion.
  useEffect(() => {
    if (paused) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [paused, images.length, intervalMs]);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  const onPointerDown = (clientX: number) => {
    dragStartX.current = clientX;
  };

  const onPointerUp = (clientX: number) => {
    if (dragStartX.current === null) return;
    const delta = clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    go(delta < 0 ? index + 1 : index - 1);
    pauseThenResume();
  };

  return (
    <div
      className="editorial-img editorial-slider"
      style={{ position: 'relative', overflow: 'hidden' }}
      role="group"
      aria-roledescription="carousel"
      aria-label={alt}
      onTouchStart={(e) => onPointerDown(e.touches[0].clientX)}
      onTouchEnd={(e) => onPointerUp(e.changedTouches[0].clientX)}
      onMouseDown={(e) => onPointerDown(e.clientX)}
      onMouseUp={(e) => onPointerUp(e.clientX)}
      onMouseLeave={() => {
        dragStartX.current = null;
      }}
    >
      {images.map((src, i) => (
        <div
          key={src}
          className="editorial-slide"
          aria-hidden={i !== index}
          style={{ opacity: i === index ? 1 : 0 }}
        >
          <Image
            src={src}
            alt={i === index ? alt : ''}
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            style={{ objectFit: 'cover' }}
            priority={i === 0}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
