import type { Payload } from 'payload';

import type { Booking, Tour } from '../../payload-types';
import {
  type YMD,
  getCDMXDayRange,
  getTimeSlotsForTour,
  getYMDInTourTZ,
  ymdHHMMToCDMXInstant,
} from './availability';

/**
 * Bike-fleet availability & recharge-cooldown layer.
 *
 * Two cross-tour rules that the per-slot capacity layer (capacity.ts) has no
 * concept of (per locked product decisions #1927, spec #1929):
 *
 *   RULE 1 — FINITE FLEET. Each bike tour reserves bikes BY CAPACITY (full slot
 *   cupo), independent of persons actually booked. Overlapping bike tours may
 *   coexist only while Σcapacities ≤ totalBikes.
 *
 *   RULE 2 — RECHARGE COOLDOWN. A bike tour's cooldown runs from its END:
 *   `[start, end + bufferMinutes)`. No other bike tour may START inside any
 *   prior bike tour's cooldown band. Symmetric across ANY pair of bike tours.
 *
 * Non-bike tours (`usesBikes=false`) are filtered out upstream — they neither
 * consume bikes nor generate/respect cooldown.
 *
 * Split mirrors availability.ts / agenda.ts:
 *   - PURE CORE (this section): fixed `ymd`, no DB, no `new Date()`. Each instant
 *     comes from `ymdHHMMToCDMXInstant`; the only raw math is adding a known
 *     number of minutes to an instant the helper already produced (offset-safe
 *     because CDMX is a fixed UTC-6 with no DST).
 */

/** One bike-tour occurrence on a single CDMX calendar day. */
export type BikeOccurrence = {
  tourId: number;
  /** Departure time, 24h `HH:MM`. */
  time: string;
  /** Real ride length in minutes. Drives the usage window end + cooldown. */
  durationMinutes: number;
  /** Full slot cupo reserved against the fleet (NOT persons booked). */
  capacity: number;
};

/** Admin-editable fleet policy (BookingSettings global). */
export type FleetConfig = {
  /** Total bikes available to share across overlapping tours. */
  totalBikes: number;
  /** Recharge buffer after a tour ends before another may start. */
  bufferMinutes: number;
};

/**
 * Result of evaluating one candidate against the rest of the day.
 *   - `fleet`         — Σ overlapping capacities + candidate > totalBikes
 *   - `cooldown`      — candidate starts inside (or creates) a violated buffer
 *   - `unevaluatable` — candidate has no positive durationMinutes (hard
 *                       precondition; the system NEVER silently allows it)
 */
export type BikeVerdict = { ok: true } | { ok: false; reason: 'fleet' | 'cooldown' | 'unevaluatable' };

const MINUTE_MS = 60_000;

/** Start/end instants for an occurrence on the given CDMX calendar day. */
function occWindow(occ: BikeOccurrence, ymd: YMD): { start: Date; end: Date } {
  const start = ymdHHMMToCDMXInstant(ymd, occ.time);
  const end = new Date(start.getTime() + occ.durationMinutes * MINUTE_MS);
  return { start, end };
}

/** Same (tour, time) identity — used to exclude a candidate from itself. */
function isSameOccurrence(a: BikeOccurrence, b: BikeOccurrence): boolean {
  return a.tourId === b.tourId && a.time === b.time;
}

/**
 * RULE 1. Returns true when the candidate FITS: the sum of capacities of OTHER
 * bike occurrences whose window overlaps the candidate's, plus the candidate's
 * own capacity, does not exceed `totalBikes`.
 *
 * Overlap is strict half-open: `aStart < bEnd && bStart < aEnd`. Back-to-back
 * windows that merely touch at a boundary (e.g. 09:00-11:00 and 11:00-13:00) do
 * NOT overlap. The candidate is excluded from the sum (self-exclusion).
 */
export function checkFleetCapacity(
  candidate: BikeOccurrence,
  others: BikeOccurrence[],
  cfg: FleetConfig,
  ymd: YMD
): boolean {
  const c = occWindow(candidate, ymd);
  let overlappingCapacity = 0;
  for (const other of others) {
    if (isSameOccurrence(candidate, other)) continue;
    const o = occWindow(other, ymd);
    const overlaps = c.start.getTime() < o.end.getTime() && o.start.getTime() < c.end.getTime();
    if (overlaps) overlappingCapacity += other.capacity;
  }
  return overlappingCapacity + candidate.capacity <= cfg.totalBikes;
}

/**
 * RULE 2. Returns true when the candidate RESPECTS every other tour's recharge
 * buffer, in BOTH directions:
 *   - the candidate must not start before `other.end + buffer`, AND
 *   - the other must not start before `candidate.end + buffer`.
 *
 * The boundary `end + buffer` itself is allowed (half-open band). Applies to any
 * pair of bike tours regardless of type. The candidate is self-excluded.
 */
export function checkRechargeCooldown(
  candidate: BikeOccurrence,
  others: BikeOccurrence[],
  cfg: FleetConfig,
  ymd: YMD
): boolean {
  const bufferMs = cfg.bufferMinutes * MINUTE_MS;
  const c = occWindow(candidate, ymd);
  for (const other of others) {
    if (isSameOccurrence(candidate, other)) continue;
    const o = occWindow(other, ymd);
    // Candidate starts inside the other's cooldown band [otherStart, otherEnd+buffer)?
    if (c.start.getTime() < o.end.getTime() + bufferMs && o.start.getTime() <= c.start.getTime()) {
      return false;
    }
    // Other starts inside the candidate's cooldown band (candidate is earlier)?
    if (o.start.getTime() < c.end.getTime() + bufferMs && c.start.getTime() <= o.start.getTime()) {
      return false;
    }
  }
  return true;
}

/**
 * Combined verdict for one candidate occurrence.
 *
 * FAIL-SAFE precondition: a candidate without a positive `durationMinutes`
 * cannot be evaluated (its window is undefined) and is NEVER silently allowed —
 * it returns `{ ok: false, reason: 'unevaluatable' }`. Capacity is checked
 * before cooldown so the more fundamental "no bike to give" wins the reason.
 *
 * `others` are expected to be already filtered to bike occurrences only.
 */
export function evaluateBikeAvailability({
  candidate,
  others,
  cfg,
  ymd,
}: {
  candidate: BikeOccurrence;
  others: BikeOccurrence[];
  cfg: FleetConfig;
  ymd: YMD;
}): BikeVerdict {
  if (!Number.isFinite(candidate.durationMinutes) || candidate.durationMinutes <= 0) {
    return { ok: false, reason: 'unevaluatable' };
  }
  if (!checkFleetCapacity(candidate, others, cfg, ymd)) {
    return { ok: false, reason: 'fleet' };
  }
  if (!checkRechargeCooldown(candidate, others, cfg, ymd)) {
    return { ok: false, reason: 'cooldown' };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Async layer — DB reads + shared evaluator (mirrors agenda.ts getWeekAgenda)
// ─────────────────────────────────────────────────────────────────────────

/** Minimal tour shape the fleet layer needs (satisfies getTimeSlotsForTour). */
export type FleetTour = Pick<Tour, 'id' | 'timeSlots' | 'usesBikes' | 'durationMinutes'>;

/** The whole day's bike picture: policy + every existing bike occurrence. */
export type BikeFleetState = { cfg: FleetConfig; occurrences: BikeOccurrence[] };

const DEFAULT_TOTAL_BIKES = 8;
const DEFAULT_BUFFER_MINUTES = 120;

/** Resolve the slot capacity for a given time on a tour (0 if no such slot). */
function slotCapacityFor(tour: FleetTour, time: string): number {
  const slot = getTimeSlotsForTour({ timeSlots: tour.timeSlots }).find((s) => s.time === time);
  return slot?.capacity ?? 0;
}

/**
 * Thin async wrapper, two reads only (agenda.ts pattern):
 *   A. `booking-settings` global → totalBikes / bufferMinutes (with defaults).
 *   B. in parallel: all bike tours (`usesBikes=true`) + every booking on the
 *      target CDMX day that still counts (paid, or pending with a live hold).
 *
 * Existing bookings become occurrences using their tour's `durationMinutes` and
 * the slot's full `capacity` — RULE 1 reserves the whole cupo, never persons.
 * Bookings whose tour is missing/non-bike or whose slot/duration is invalid are
 * dropped from the occurrence list (they cannot consume fleet meaningfully).
 */
export async function getBikeFleetState({
  payload,
  date,
  now = new Date(),
}: {
  payload: Payload;
  date: Date;
  now?: Date;
}): Promise<BikeFleetState> {
  const settings = (await payload.findGlobal({ slug: 'booking-settings' })) as {
    totalBikes?: number | null;
    bufferMinutes?: number | null;
  };
  const cfg: FleetConfig = {
    totalBikes: settings?.totalBikes ?? DEFAULT_TOTAL_BIKES,
    bufferMinutes: settings?.bufferMinutes ?? DEFAULT_BUFFER_MINUTES,
  };

  const { startUTC, endUTC } = getCDMXDayRange(date);
  const [toursRes, bookingsRes] = await Promise.all([
    payload.find({
      collection: 'tours',
      pagination: false,
      limit: 0,
      depth: 0,
      overrideAccess: true,
      where: { usesBikes: { equals: true } },
    }),
    payload.find({
      collection: 'bookings',
      pagination: false,
      limit: 0,
      depth: 0,
      overrideAccess: true,
      where: {
        and: [
          { date: { greater_than_equal: startUTC.toISOString() } },
          { date: { less_than: endUTC.toISOString() } },
          {
            or: [
              { status: { equals: 'paid' } },
              {
                and: [
                  { status: { equals: 'pending' } },
                  { holdExpiresAt: { greater_than: now.toISOString() } },
                ],
              },
            ],
          },
        ],
      },
    }),
  ]);

  const bikeTourById = new Map<number, FleetTour>(
    (toursRes.docs as FleetTour[]).map((t) => [t.id, t])
  );

  const occurrences: BikeOccurrence[] = [];
  for (const b of bookingsRes.docs as Booking[]) {
    const tourId = typeof b.tour === 'number' ? b.tour : b.tour?.id;
    if (typeof tourId !== 'number') continue;
    const tour = bikeTourById.get(tourId);
    if (!tour) continue; // not a bike tour → consumes no fleet
    const duration = tour.durationMinutes;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) continue;
    const capacity = slotCapacityFor(tour, b.time);
    if (capacity <= 0) continue;
    occurrences.push({ tourId, time: b.time, durationMinutes: duration, capacity });
  }

  return { cfg, occurrences };
}

/**
 * Single shared evaluator — the ONE place both routes call so the availability
 * GET (advisory) and checkout POST (authoritative) can never drift.
 *
 *   - `usesBikes !== true` → `{ ok: true }` (exempt, invisible to the rules,
 *     no DB read performed).
 *   - otherwise: load the day's fleet state, build the candidate occurrence,
 *     exclude its own (tour, time) from the others, and delegate to the pure
 *     `evaluateBikeAvailability`. A bike tour without a positive duration short-
 *     circuits to `unevaluatable` (fail-safe) before any read.
 */
export async function evaluateBikeSlot({
  payload,
  tour,
  date,
  time,
  now = new Date(),
}: {
  payload: Payload;
  tour: FleetTour;
  date: Date;
  time: string;
  now?: Date;
}): Promise<BikeVerdict> {
  if (tour.usesBikes !== true) return { ok: true };

  const ymd: YMD = getYMDInTourTZ(date);
  const candidate: BikeOccurrence = {
    tourId: tour.id,
    time,
    durationMinutes:
      typeof tour.durationMinutes === 'number' ? tour.durationMinutes : Number.NaN,
    capacity: slotCapacityFor(tour, time),
  };

  // Short-circuit the fail-safe before paying for two DB reads.
  if (!Number.isFinite(candidate.durationMinutes) || candidate.durationMinutes <= 0) {
    return { ok: false, reason: 'unevaluatable' };
  }

  const { cfg, occurrences } = await getBikeFleetState({ payload, date, now });
  const others = occurrences.filter(
    (o) => !(o.tourId === candidate.tourId && o.time === candidate.time)
  );

  return evaluateBikeAvailability({ candidate, others, cfg, ymd });
}
