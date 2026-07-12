import {
  type YMD,
  getYMDInTourTZ,
  isBikeTicketCutoffPassed,
  ymdHHMMToCDMXInstant,
} from './availability';

/**
 * Pure standalone-rental evaluator (Batch 2 / PR2 of the rental-system SDD).
 *
 * Design principles (mirror fleet.ts / agenda.ts):
 *   - PURE CORE: no DB, no `new Date()`. `now` is always a caller-supplied param;
 *     every instant comes from `ymdHHMMToCDMXInstant` (fixed UTC-6, no DST).
 *   - SINGLE SOURCE OF TRUTH: the advisory availability GET and the authoritative
 *     checkout POST both call this evaluator, so they can never drift.
 *   - persons_sold BASIS, not cupo. Tour occupancy is committed = personsSold.
 *   - HALF-OPEN overlap semantics — a busy window whose end instant equals a tour
 *     occupancy start does NOT overlap (boundary touch is ALLOWED).
 *
 * GENERAL by construction: the fleet check sums persons/quantities over ALL
 * occupancy intervals with no rental-only branch, so §7 private-group gating can
 * consume the same timeline later (see design obs 132 §8).
 */

/** A concrete rental request under evaluation. */
export type RentalRequest = {
  /** Any instant on the target CDMX calendar day (typically a noon-UTC anchor). */
  date: Date;
  /** Start time, 24h `HH:MM`, CDMX wall clock. */
  startTime: string;
  /** Requested ride length in minutes. */
  durationMinutes: number;
  /** Number of bikes requested. */
  quantity: number;
};

/** A rental request minus its quantity — the grid helper's input. */
export type RentalRequestNoQty = Omit<RentalRequest, 'quantity'>;

/** One bike-tour occurrence on the target day (persons_sold basis). */
export type TourOccupancy = {
  startTime: string;
  durationMinutes: number;
  /** Persons actually sold (NOT slot cupo). */
  personsSold: number;
};

/** One live standalone rental on the target day. */
export type RentalOccupancy = {
  startTime: string;
  durationMinutes: number;
  quantity: number;
};

/** The day's committed fleet picture handed to the evaluator. */
export type RentalDayState = {
  tours: TourOccupancy[];
  rentals: RentalOccupancy[];
};

/** Admin-editable policy needed by the evaluator. */
export type RentalSettings = {
  totalBikes: number;
  bufferMinutes: number;
  /** Earliest rental start (HH:MM, CDMX). */
  openTime: string;
  /** Latest instant a ride may END (HH:MM, CDMX). */
  closeTime: string;
};

export type RentalReason = 'unevaluatable' | 'closed_day' | 'after_close' | 'fleet';

export type RentalVerdict = { valid: true } | { valid: false; reason: RentalReason };

const MINUTE_MS = 60_000;

/** UTC-instant (ms) for a wall-clock `HH:MM` on the given CDMX calendar day. */
function instantMs(ymd: YMD, hhmm: string): number {
  return ymdHHMMToCDMXInstant(ymd, hhmm).getTime();
}

/**
 * Evaluate the time gates (rentable-day + close-time ceiling) for a request that
 * already has a positive duration. Returns the blocking reason or null.
 *
 * Order (fail-safe): rentable-day gate BEFORE the close-time ceiling, and the
 * open-time gate (part of `after_close`) BEFORE the fleet check at the call site.
 */
function checkTimeGates(
  req: RentalRequestNoQty,
  cfg: RentalSettings,
  now: Date,
  ymd: YMD
): Extract<RentalReason, 'closed_day' | 'after_close'> | null {
  const startMs = instantMs(ymd, req.startTime);

  // Rentable-day gate: §5 day-before-noon cutoff must have passed, and the start
  // block must not already be in the past.
  if (!isBikeTicketCutoffPassed(req.date, now) || startMs < now.getTime()) {
    return 'closed_day';
  }

  // Close-time ceiling: ride END must be <= closeTime (INCLUSIVE); the open-time
  // gate (start >= openTime) runs here too, before any fleet math.
  const openMs = instantMs(ymd, cfg.openTime);
  const closeMs = instantMs(ymd, cfg.closeTime);
  if (startMs < openMs || startMs + req.durationMinutes * MINUTE_MS > closeMs) {
    return 'after_close';
  }

  return null;
}

/**
 * Event-sweep core: the maximum bikes committed by OTHER tours/rentals at any
 * critical instant inside this request's busy window `[S, S+(dur+buffer))`.
 *
 * `committed(t)` is piecewise-constant and only jumps UP at interval starts, so
 * its max over the half-open window is attained at S or at some interval start
 * strictly inside the window. We therefore sample only:
 *   T = { S } ∪ { interval starts t : S < t < end_req }
 * Interval ENDS never raise committed, so they need not be sampled.
 *
 * Tour occupancy and rental busy windows are buffer-INCLUSIVE
 * `[start_i, start_i + (dur_i + buffer))` (ride + recharge; charging bikes are
 * not rentable). This is computed FRESH here — it is NOT the fleet.ts `occWindow`.
 */
function maxCommitted(
  req: RentalRequestNoQty,
  day: RentalDayState,
  cfg: RentalSettings,
  ymd: YMD
): number {
  const startMs = instantMs(ymd, req.startTime);
  const endReqMs = startMs + (req.durationMinutes + cfg.bufferMinutes) * MINUTE_MS;

  type Interval = { start: number; end: number; weight: number };
  const intervals: Interval[] = [];
  for (const t of day.tours) {
    const s = instantMs(ymd, t.startTime);
    intervals.push({
      start: s,
      end: s + (t.durationMinutes + cfg.bufferMinutes) * MINUTE_MS,
      weight: t.personsSold,
    });
  }
  for (const r of day.rentals) {
    const s = instantMs(ymd, r.startTime);
    intervals.push({
      start: s,
      end: s + (r.durationMinutes + cfg.bufferMinutes) * MINUTE_MS,
      weight: r.quantity,
    });
  }

  // Critical instants: S plus any interval start strictly inside (S, end_req).
  const critical = new Set<number>([startMs]);
  for (const iv of intervals) {
    if (iv.start > startMs && iv.start < endReqMs) critical.add(iv.start);
  }

  let max = 0;
  for (const t of critical) {
    let committed = 0;
    for (const iv of intervals) {
      if (iv.start <= t && t < iv.end) committed += iv.weight;
    }
    if (committed > max) max = committed;
  }
  return max;
}

/**
 * Authoritative single-request verdict. Check order (fail-safe first):
 *   1. unevaluatable — non-positive/non-finite quantity or duration
 *   2. closed_day    — §5 cutoff not passed OR start already in the past
 *   3. after_close   — start < openTime OR ride-end > closeTime (inclusive)
 *   4. fleet         — per-instant committed + quantity > totalBikes
 */
export function evaluateRental(
  req: RentalRequest,
  day: RentalDayState,
  cfg: RentalSettings,
  now: Date
): RentalVerdict {
  if (
    !Number.isFinite(req.quantity) ||
    !Number.isInteger(req.quantity) ||
    req.quantity <= 0 ||
    !Number.isFinite(req.durationMinutes) ||
    req.durationMinutes <= 0
  ) {
    return { valid: false, reason: 'unevaluatable' };
  }

  const ymd = getYMDInTourTZ(req.date);
  const gate = checkTimeGates(req, cfg, now, ymd);
  if (gate) return { valid: false, reason: gate };

  const committed = maxCommitted(req, day, cfg, ymd);
  if (req.quantity + committed > cfg.totalBikes) {
    return { valid: false, reason: 'fleet' };
  }
  return { valid: true };
}

/**
 * Grid helper: the largest quantity that would still pass `evaluateRental` at
 * this window. Returns 0 when any gate (unevaluatable/closed_day/after_close)
 * fails, else `max(0, totalBikes - maxCommitted)`.
 *
 * Because it shares the SAME event-sweep as `evaluateRental`, the availability
 * grid can never drift from the authoritative gate (AC24).
 */
export function computeMaxRentalQuantity(
  reqNoQty: RentalRequestNoQty,
  day: RentalDayState,
  cfg: RentalSettings,
  now: Date
): number {
  if (!Number.isFinite(reqNoQty.durationMinutes) || reqNoQty.durationMinutes <= 0) {
    return 0;
  }

  const ymd = getYMDInTourTZ(reqNoQty.date);
  if (checkTimeGates(reqNoQty, cfg, now, ymd)) return 0;

  const committed = maxCommitted(reqNoQty, day, cfg, ymd);
  return Math.max(0, cfg.totalBikes - committed);
}
