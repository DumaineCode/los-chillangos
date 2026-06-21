import { describe, expect, it } from 'vitest';

import { focalToObjectPosition } from './focal';

/**
 * Unit tests for `focalToObjectPosition` — the pure, dependency-free seam that
 * turns a stored focal point into a CSS `object-position` string.
 *
 * This is the single source of truth shared by `resolveMediaImage` (frontend)
 * and the in-admin `FocalPreviewField`, so the two can never diverge. Covers
 * FR-10 from the spec; the parametrized table mirrors the spec table exactly.
 */
describe('focalToObjectPosition', () => {
  // Spec table (FR-10): honor, single-axis default, both-default, boundary,
  // clamp, and round in one parametrized pass.
  it.each([
    { focalX: 30, focalY: 70, expected: '30% 70%' },
    { focalX: null, focalY: 40, expected: '50% 40%' },
    { focalX: 60, focalY: undefined, expected: '60% 50%' },
    { focalX: null, focalY: null, expected: '50% 50%' },
    { focalX: 0, focalY: 0, expected: '0% 0%' },
    { focalX: 100, focalY: 100, expected: '100% 100%' },
    { focalX: 140, focalY: -20, expected: '100% 0%' },
    { focalX: 33.4, focalY: 66.6, expected: '33% 67%' },
  ])('maps ($focalX, $focalY) → "$expected"', ({ focalX, focalY, expected }) => {
    expect(focalToObjectPosition(focalX, focalY)).toBe(expected);
  });

  it('honors a numeric focal point (forces real logic, not a hardcode)', () => {
    expect(focalToObjectPosition(20, 80)).toBe('20% 80%');
    expect(focalToObjectPosition(70, 30)).toBe('70% 30%');
  });

  it('defaults a missing axis to 50%', () => {
    expect(focalToObjectPosition()).toBe('50% 50%');
    expect(focalToObjectPosition(undefined, undefined)).toBe('50% 50%');
    expect(focalToObjectPosition(80, null)).toBe('80% 50%');
    expect(focalToObjectPosition(null, 80)).toBe('50% 80%');
  });

  it('keeps the 0/0 and 100/100 boundaries exact', () => {
    expect(focalToObjectPosition(0, 0)).toBe('0% 0%');
    expect(focalToObjectPosition(100, 100)).toBe('100% 100%');
  });

  it('clamps out-of-range values into 0..100', () => {
    expect(focalToObjectPosition(150, -20)).toBe('100% 0%');
    expect(focalToObjectPosition(-1, 101)).toBe('0% 100%');
  });

  it('rounds sub-percent precision to the nearest integer', () => {
    expect(focalToObjectPosition(33.4, 66.6)).toBe('33% 67%');
    expect(focalToObjectPosition(25.5, 49.4)).toBe('26% 49%');
  });
});
