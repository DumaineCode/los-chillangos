/**
 * Turn a stored focal point into a CSS `object-position` string.
 *
 * Single source of truth shared by {@link resolveMediaImage} (frontend cover
 * rendering) and the in-admin `FocalPreviewField` live crop preview — so the two
 * can never diverge. Per axis: a null/undefined value falls back to centre (50),
 * the value is clamped into the valid 0..100 percentage range, and rounded to an
 * integer. Returns `"X% Y%"`.
 *
 * Pure and dependency-free (ZERO imports) so it is safe to pull into a
 * `'use client'` admin island without dragging server-only types along.
 */
const CENTER = 50;

/** Clamp to the valid CSS percentage range and round to an integer. */
function toPercent(value: number | null | undefined): number {
  const n = value ?? CENTER;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function focalToObjectPosition(
  focalX?: number | null,
  focalY?: number | null
): string {
  return `${toPercent(focalX)}% ${toPercent(focalY)}%`;
}
