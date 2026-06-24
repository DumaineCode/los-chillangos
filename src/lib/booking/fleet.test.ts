import { describe, expect, it } from 'vitest';

import {
  type BikeOccurrence,
  type FleetConfig,
  checkFleetCapacity,
  checkRechargeCooldown,
  evaluateBikeAvailability,
} from './fleet';
import type { YMD } from './availability';

/**
 * Pure-core fleet tests (Strict TDD). Every case uses a FIXED `ymd` and never
 * calls `new Date()` — the functions under test derive instants only from the
 * CDMX helpers, so the same input always yields the same verdict.
 *
 * Acceptance criteria mirror the delta spec (#1929):
 *   - Fleet capacity reserves by CAPACITY (full slot cupo), half-open [start,end).
 *   - Recharge cooldown is measured from END; band [end, end+buffer), symmetric.
 *   - Back-to-back touching windows do NOT overlap (strict aStart<bEnd && bStart<aEnd).
 *   - Candidate excludes itself.
 *   - Missing/invalid durationMinutes is a hard precondition (never silently allowed).
 */

const YMD_FIXED: YMD = { year: 2026, month: 6, day: 15 };

const CFG: FleetConfig = { totalBikes: 8, bufferMinutes: 120 };

function occ(overrides: Partial<BikeOccurrence> = {}): BikeOccurrence {
  return {
    tourId: 1,
    time: '09:00',
    durationMinutes: 120,
    capacity: 4,
    ...overrides,
  };
}

describe('checkFleetCapacity', () => {
  it('rejects when overlapping capacities + candidate exceed totalBikes', () => {
    // Existing bike tour cupo 8 at 09:00 (full fleet). Candidate cupo 8 overlapping.
    const candidate = occ({ tourId: 2, capacity: 8 });
    const others = [occ({ tourId: 1, capacity: 8 })];
    expect(checkFleetCapacity(candidate, others, CFG, YMD_FIXED)).toBe(false);
  });

  it('allows when overlapping capacities + candidate equal totalBikes exactly', () => {
    // Two half-fleet tours (4 + 4 = 8) at the same time coexist.
    const candidate = occ({ tourId: 2, capacity: 4 });
    const others = [occ({ tourId: 1, capacity: 4 })];
    expect(checkFleetCapacity(candidate, others, CFG, YMD_FIXED)).toBe(true);
  });

  it('reserves by full slot capacity regardless of persons booked (capacity is the unit)', () => {
    // The "others" carry only capacity, not persons — capacity 8 must block even
    // if just 1 person were booked. This test proves the unit is cupo, not pax:
    // an 8-cupo neighbour leaves 0 room for any positive candidate.
    const candidate = occ({ tourId: 2, capacity: 1 });
    const others = [occ({ tourId: 1, capacity: 8 })];
    expect(checkFleetCapacity(candidate, others, CFG, YMD_FIXED)).toBe(false);
  });

  it('excludes the candidate own occurrence from the overlap sum', () => {
    // The candidate appears in `others` (re-evaluation). It must not count itself,
    // so cupo 8 candidate vs an identical self-row still fits (8 <= 8).
    const candidate = occ({ tourId: 1, time: '09:00', capacity: 8 });
    const others = [occ({ tourId: 1, time: '09:00', capacity: 8 })];
    expect(checkFleetCapacity(candidate, others, CFG, YMD_FIXED)).toBe(true);
  });

  it('ignores non-overlapping occurrences entirely', () => {
    // Candidate 09:00-11:00, other 14:00-16:00 → disjoint, never counted.
    const candidate = occ({ tourId: 2, time: '09:00', capacity: 8 });
    const others = [occ({ tourId: 1, time: '14:00', capacity: 8 })];
    expect(checkFleetCapacity(candidate, others, CFG, YMD_FIXED)).toBe(true);
  });

  it('treats back-to-back touching windows as NOT overlapping', () => {
    // Candidate 11:00-13:00, other 09:00-11:00 → touch at 11:00 but [start,end)
    // is half-open, so they do not overlap. Both cupo 8 coexist.
    const candidate = occ({ tourId: 2, time: '11:00', capacity: 8 });
    const others = [occ({ tourId: 1, time: '09:00', durationMinutes: 120, capacity: 8 })];
    expect(checkFleetCapacity(candidate, others, CFG, YMD_FIXED)).toBe(true);
  });
});

describe('checkRechargeCooldown', () => {
  it('rejects a start inside a prior tour cooldown band', () => {
    // Prior 09:00 dur 120 ends 11:00, buffer 120 → cooldown until 13:00.
    // Candidate starts 12:00 (before 13:00) → blocked.
    const candidate = occ({ tourId: 2, time: '12:00' });
    const others = [occ({ tourId: 1, time: '09:00', durationMinutes: 120 })];
    expect(checkRechargeCooldown(candidate, others, CFG, YMD_FIXED)).toBe(false);
  });

  it('allows a start exactly at end + buffer (half-open boundary)', () => {
    // Prior ends 11:00, +120 buffer = 13:00. Candidate starts exactly 13:00 → allowed.
    const candidate = occ({ tourId: 2, time: '13:00' });
    const others = [occ({ tourId: 1, time: '09:00', durationMinutes: 120 })];
    expect(checkRechargeCooldown(candidate, others, CFG, YMD_FIXED)).toBe(true);
  });

  it('applies cooldown symmetrically when the candidate is the earlier tour', () => {
    // Candidate 09:00 dur 120 ends 11:00 → its cooldown runs to 13:00. An existing
    // later tour at 12:00 would start inside the candidate's band → blocked.
    const candidate = occ({ tourId: 2, time: '09:00', durationMinutes: 120 });
    const others = [occ({ tourId: 1, time: '12:00' })];
    expect(checkRechargeCooldown(candidate, others, CFG, YMD_FIXED)).toBe(false);
  });

  it('enforces cooldown across different tour types', () => {
    // Different tourId (different bike tour type) still respects the buffer.
    const candidate = occ({ tourId: 99, time: '12:00' });
    const others = [occ({ tourId: 1, time: '09:00', durationMinutes: 120 })];
    expect(checkRechargeCooldown(candidate, others, CFG, YMD_FIXED)).toBe(false);
  });

  it('excludes the candidate own occurrence from cooldown checks', () => {
    // The same (tour,time) row appearing in others must not block itself.
    const candidate = occ({ tourId: 1, time: '09:00', durationMinutes: 120 });
    const others = [occ({ tourId: 1, time: '09:00', durationMinutes: 120 })];
    expect(checkRechargeCooldown(candidate, others, CFG, YMD_FIXED)).toBe(true);
  });
});

describe('evaluateBikeAvailability', () => {
  it('returns ok when capacity and cooldown both pass', () => {
    const candidate = occ({ tourId: 2, time: '13:00', capacity: 4 });
    const others = [occ({ tourId: 1, time: '09:00', durationMinutes: 120, capacity: 4 })];
    expect(
      evaluateBikeAvailability({ candidate, others, cfg: CFG, ymd: YMD_FIXED })
    ).toEqual({ ok: true });
  });

  it('returns reason "fleet" when capacity is exceeded', () => {
    const candidate = occ({ tourId: 2, time: '09:00', capacity: 8 });
    const others = [occ({ tourId: 1, time: '09:00', capacity: 8 })];
    expect(
      evaluateBikeAvailability({ candidate, others, cfg: CFG, ymd: YMD_FIXED })
    ).toEqual({ ok: false, reason: 'fleet' });
  });

  it('returns reason "cooldown" when capacity is fine but the buffer is violated', () => {
    // Small capacities (1+1) so fleet never trips; only cooldown should fail.
    const candidate = occ({ tourId: 2, time: '12:00', capacity: 1 });
    const others = [occ({ tourId: 1, time: '09:00', durationMinutes: 120, capacity: 1 })];
    expect(
      evaluateBikeAvailability({ candidate, others, cfg: CFG, ymd: YMD_FIXED })
    ).toEqual({ ok: false, reason: 'cooldown' });
  });

  it('returns reason "unevaluatable" when candidate durationMinutes is null', () => {
    const candidate = occ({ durationMinutes: null as unknown as number });
    expect(
      evaluateBikeAvailability({ candidate, others: [], cfg: CFG, ymd: YMD_FIXED })
    ).toEqual({ ok: false, reason: 'unevaluatable' });
  });

  it('returns reason "unevaluatable" when candidate durationMinutes is <= 0', () => {
    const candidate = occ({ durationMinutes: 0 });
    expect(
      evaluateBikeAvailability({ candidate, others: [], cfg: CFG, ymd: YMD_FIXED })
    ).toEqual({ ok: false, reason: 'unevaluatable' });
  });
});
