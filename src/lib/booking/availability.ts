import type { Tour } from '../../payload-types';

/**
 * Pure availability helpers for the booking flow (Sub-etapa B).
 *
 * Scope:
 *   - Time-zone-aware date math anchored to CDMX (UTC-6, no DST since 2022).
 *   - Defensive normalization of `tour.timeSlots` (Payload's array shape).
 *   - Weekday gating against `tour.availableDays` (Payload select stores strings).
 *   - A pure per-slot availability calculator used by both client + server.
 *
 * Anti-scope:
 *   - No Payload reads, no DB, no fetch. Capacity.ts handles I/O.
 */

/** Pending bookings hold a seat for this many minutes before lapsing. */
export const HOLD_TTL_MINUTES = 15;

/**
 * Stripe Checkout Session expiry, in minutes from creation.
 * Stripe's own minimum is 30 minutes; we sit at the floor.
 *
 * Intentionally LONGER than HOLD_TTL_MINUTES — a customer may complete
 * Stripe Checkout after our hold has expired. The webhook auto-refunds
 * such late payments (the seat may have been taken by someone else).
 */
export const STRIPE_SESSION_TTL_MINUTES = 30;

/** A slot starting in less than this many hours from "now" is closed for same-day bookings. */
export const SAME_DAY_CUTOFF_HOURS = 2;

/**
 * Bike-ticket cutoff: how many CDMX calendar days BEFORE the tour the ticket
 * window closes. `1` = the day before. Applies ONLY to bike tours (usesBikes),
 * gated at the call site (mirrors how `isSameDayCutoffPassed` is type-agnostic).
 */
export const BIKE_TICKET_CUTOFF_DAYS_BEFORE = 1;

/** Bike-ticket cutoff hour (CDMX wall clock, 24h). `12` = noon. */
export const BIKE_TICKET_CUTOFF_HOUR = 12;

/** CDMX has not observed DST since 2022 — fixed offset UTC-6 effectively. */
export const TOUR_TIMEZONE = 'America/Mexico_City';

export type YMD = { year: number; month: number; day: number };

/**
 * Return the Y/M/D of `now` interpreted in CDMX. `month` is 1-12 (not 0-indexed)
 * because that's what `Intl.DateTimeFormat` parts give us and the only callers
 * use this for display/comparison, never for `new Date(y, m, d)`.
 */
export function getTodayInTourTZ(now: Date = new Date()): YMD {
  return getYMDInTourTZ(now);
}

/**
 * Return true if `date` is strictly before today in CDMX, comparing calendar
 * days only (the time-of-day component is intentionally ignored).
 */
export function isDateBeforeTodayInTourTZ(date: Date, now: Date = new Date()): boolean {
  const today = getYMDInTourTZ(now);
  const candidate = getYMDInTourTZ(date);
  return compareYMD(candidate, today) < 0;
}

/**
 * Same-day cutoff: a slot is blocked if it is "today" in CDMX AND less than
 * `SAME_DAY_CUTOFF_HOURS` away from `now`. Other days always return false —
 * future days don't have a cutoff, past days are blocked by `isDateBeforeTodayInTourTZ`.
 */
export function isSameDayCutoffPassed(
  date: Date,
  timeHHMM: string,
  now: Date = new Date()
): boolean {
  const today = getYMDInTourTZ(now);
  const slotDay = getYMDInTourTZ(date);
  if (compareYMD(slotDay, today) !== 0) return false;

  const slotInstant = ymdHHMMToCDMXInstant(slotDay, timeHHMM);
  const diffMs = slotInstant.getTime() - now.getTime();
  const diffHours = diffMs / 3_600_000;
  return diffHours < SAME_DAY_CUTOFF_HOURS;
}

const DAY_MS = 24 * 3_600_000;

/**
 * The exact instant a bike tour's ticket window CLOSES: `BIKE_TICKET_CUTOFF_HOUR`
 * (noon) on the CDMX calendar day that is `BIKE_TICKET_CUTOFF_DAYS_BEFORE` days
 * before the tour's own CDMX day. For a Sunday tour that is Saturday 12:00 CDMX.
 *
 * TZ discipline: `date` may be ANY instant on the tour's CDMX day. We anchor to
 * that day's CDMX-midnight (`getCDMXDayRange`), step back whole days (CDMX has a
 * fixed offset year-round, so subtracting 24h always lands on the previous
 * CDMX-midnight), re-read the resulting calendar day, and build noon from it via
 * `ymdHHMMToCDMXInstant`. Month/year boundaries are handled by the calendar
 * re-read, never by raw arithmetic on the components.
 */
export function getBikeTicketCutoffInstant(date: Date): Date {
  const tourDayMidnightUTC = getCDMXDayRange(date).startUTC;
  const cutoffDayInstant = new Date(
    tourDayMidnightUTC.getTime() - BIKE_TICKET_CUTOFF_DAYS_BEFORE * DAY_MS
  );
  const cutoffYMD = getYMDInTourTZ(cutoffDayInstant);
  const hh = String(BIKE_TICKET_CUTOFF_HOUR).padStart(2, '0');
  return ymdHHMMToCDMXInstant(cutoffYMD, `${hh}:00`);
}

/**
 * Bike-ticket cutoff gate. Returns true once `now` has reached (or passed) the
 * day-before-noon cutoff for a tour on `date`. The boundary instant itself is
 * CLOSED (`>=`): at Saturday 12:00:00 sharp, Sunday's bike tickets are shut.
 *
 * CALLER RESPONSIBILITY: only invoke for bike tours (`usesBikes === true`).
 * Non-bike tours are exempt and must not be passed through here.
 */
export function isBikeTicketCutoffPassed(date: Date, now: Date = new Date()): boolean {
  return now.getTime() >= getBikeTicketCutoffInstant(date).getTime();
}

/**
 * Returns true if `date.getDay()` (interpreted in CDMX) is in `availableDays`.
 * Accepts both string and number values because Payload's `select` field
 * stores them as strings (e.g. `'0'..'6'`) while ad-hoc callers may pass numbers.
 *
 * Empty list → false (paused tour: no bookable days).
 */
export function isWeekdayAvailable(
  date: Date,
  availableDays: ReadonlyArray<string | number>
): boolean {
  if (availableDays.length === 0) return false;
  const normalized = new Set(
    availableDays.map((d) => (typeof d === 'string' ? Number.parseInt(d, 10) : d))
  );
  const cdmxDow = getWeekdayInTourTZ(date);
  return normalized.has(cdmxDow);
}

/**
 * Minimal structural shape needed to gate bookable dates. Deliberately loose
 * so BOTH the trimmed UI tour (booking page projection) and the full Payload
 * doc (server checkout route) satisfy it without casting.
 */
export type BookableDateTour = {
  isSeasonal?: boolean | null;
  availableDays?: ReadonlyArray<string | number | null> | null;
  seasonal?: {
    seasonWindow?: { start?: string | null; end?: string | null } | null;
  } | null;
};

/**
 * Single source of truth for "can the user book THIS calendar day on THIS
 * tour?". Two regimes:
 *
 *   - Seasonal tours (`isSeasonal === true`): bookable only when `date` falls
 *     within `seasonal.seasonWindow` [start..end], INCLUSIVE, compared as CDMX
 *     calendar days. `availableDays` is intentionally IGNORED here — a seasonal
 *     event is window-driven, not a recurring weekday schedule. If either bound
 *     is missing the tour is treated as closed (mirrors empty `availableDays`).
 *
 *   - Standard tours: delegate to the recurring `isWeekdayAvailable` model.
 *
 * Timezone discipline: `seasonWindow.start/end` are Payload `date` fields that
 * serialize as midnight UTC (e.g. `2026-08-14T00:00:00.000Z` reads as Aug 13 in
 * CDMX). We funnel the candidate AND both bounds through `getYMDInTourTZ` and
 * compare via `compareYMD`, so the Aug-14 boundary never shifts a day. Comparing
 * raw `Date` timestamps would be wrong.
 */
export function isDateBookableForTour(date: Date, tour: BookableDateTour): boolean {
  if (tour.isSeasonal === true) {
    const window = tour.seasonal?.seasonWindow;
    const start = window?.start;
    const end = window?.end;
    if (!start || !end) return false; // closed: incomplete window

    const candidate = getYMDInTourTZ(date);
    const startYMD = getYMDInTourTZ(new Date(start));
    const endYMD = getYMDInTourTZ(new Date(end));
    return compareYMD(candidate, startYMD) >= 0 && compareYMD(candidate, endYMD) <= 0;
  }

  const availableDays = (tour.availableDays ?? []).filter(
    (d): d is string | number => d !== null
  );
  return isWeekdayAvailable(date, availableDays);
}

/**
 * Returns the tour's time slots, defensively cleaned up:
 *   - `time` trimmed
 *   - `capacity` coerced to integer
 *   - dropped if either is invalid (empty string, non-numeric, capacity < 1)
 */
export function getTimeSlotsForTour(
  tour: Pick<Tour, 'timeSlots'>
): Array<{ time: string; capacity: number }> {
  const raw = tour.timeSlots ?? [];
  const out: Array<{ time: string; capacity: number }> = [];
  for (const slot of raw) {
    if (!slot) continue;
    const time = typeof slot.time === 'string' ? slot.time.trim() : '';
    if (!time) continue;
    const capacityRaw = slot.capacity;
    const capacityNum =
      typeof capacityRaw === 'number' ? capacityRaw : Number.parseFloat(String(capacityRaw));
    if (!Number.isFinite(capacityNum)) continue;
    const capacity = Math.trunc(capacityNum);
    if (capacity < 1) continue;
    out.push({ time, capacity });
  }
  return out;
}

/**
 * Per-slot availability calculator. Pure: no time math, no DB.
 *   - `remaining` is clamped at 0 (overbooking should never produce a negative).
 *   - `canFit` requires at least one person AND room for the whole party.
 */
export function computeSlotAvailability({
  slotCapacity,
  seatsTaken,
  requestedPersons,
}: {
  slotCapacity: number;
  seatsTaken: number;
  requestedPersons: number;
}): { remaining: number; canFit: boolean } {
  const remaining = Math.max(0, slotCapacity - seatsTaken);
  const canFit = requestedPersons > 0 && requestedPersons <= remaining;
  return { remaining, canFit };
}

/**
 * Returns the UTC instants that bracket the CDMX calendar day containing
 * `date`. Use with Payload's `greater_than_equal` + `less_than` to match a
 * `date` column on the right calendar day regardless of server TZ.
 *
 * Example: anyInstantOnThatDay = 2026-06-15T20:00:00Z → CDMX day = 2026-06-15
 *   startUTC = 2026-06-15T06:00:00.000Z
 *   endUTC   = 2026-06-16T06:00:00.000Z
 */
export function getCDMXDayRange(date: Date): { startUTC: Date; endUTC: Date } {
  const ymd = getYMDInTourTZ(date);
  const startUTC = ymdHHMMToCDMXInstant(ymd, '00:00');
  const endUTC = new Date(startUTC.getTime() + 24 * 3_600_000);
  return { startUTC, endUTC };
}

/**
 * One calendar day of the booking timezone (CDMX), carrying everything the
 * agenda/week views need without re-deriving timezone math downstream:
 *   - `date`: the UTC instant at CDMX-midnight of that day. Safe to pass to
 *     `isDateBookableForTour`, `getCDMXDayRange`, `isSameDayCutoffPassed`.
 *   - `iso`: the `YYYY-MM-DD` label of that CDMX day.
 *   - `weekday`: 0 (Sunday) … 6 (Saturday), interpreted in CDMX.
 */
export type TourDay = { date: Date; iso: string; weekday: number };

/**
 * `YYYY-MM-DD` for the CDMX calendar day containing `date`. Same TZ discipline
 * as `getCDMXDayRange`, but yields a stable string key — used to bucket bookings
 * by day and to label/navigate the agenda week.
 */
export function getTourDayISO(date: Date): string {
  const { year, month, day } = getYMDInTourTZ(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The seven CDMX days of the week that contains `anchor`.
 *
 * `weekStartsOn`: 1 = Monday (default, business week), 0 = Sunday.
 *
 * Each returned `date` is the exact UTC instant of CDMX-midnight for that day.
 * Because CDMX has a fixed offset year-round (no DST since 2022), stepping by
 * 24h from the week's first midnight always lands on the next CDMX midnight, so
 * the labels never drift across a day boundary.
 */
export function getTourWeekDays(anchor: Date, weekStartsOn: 0 | 1 = 1): TourDay[] {
  const DAY_MS = 24 * 3_600_000;
  const anchorMidnight = getCDMXDayRange(anchor).startUTC;
  const anchorWeekday = getWeekdayInTourTZ(anchor);
  // Days to step back from `anchor` to reach the chosen week start.
  const offset = weekStartsOn === 1 ? (anchorWeekday + 6) % 7 : anchorWeekday;
  const weekStart = new Date(anchorMidnight.getTime() - offset * DAY_MS);

  const days: TourDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(weekStart.getTime() + i * DAY_MS);
    days.push({ date, iso: getTourDayISO(date), weekday: getWeekdayInTourTZ(date) });
  }
  return days;
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

const cdmxYMDFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TOUR_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const cdmxWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TOUR_TIMEZONE,
  weekday: 'short',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getYMDInTourTZ(date: Date): YMD {
  const parts = cdmxYMDFormatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  for (const part of parts) {
    if (part.type === 'year') year = Number.parseInt(part.value, 10);
    else if (part.type === 'month') month = Number.parseInt(part.value, 10);
    else if (part.type === 'day') day = Number.parseInt(part.value, 10);
  }
  return { year, month, day };
}

function getWeekdayInTourTZ(date: Date): number {
  const short = cdmxWeekdayFormatter.format(date);
  return WEEKDAY_INDEX[short] ?? date.getDay();
}

function compareYMD(a: YMD, b: YMD): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Build the UTC instant that corresponds to a wall-clock time on a calendar
 * day in CDMX. We need the actual offset CDMX uses for that wall-clock — we
 * derive it via `Intl` so we don't hardcode UTC-6 (even though CDMX has been
 * UTC-6 year-round since 2022, this stays correct if Mexico ever changes).
 */
export function ymdHHMMToCDMXInstant(ymd: YMD, timeHHMM: string): Date {
  const [hhRaw, mmRaw] = timeHHMM.split(':');
  const hh = Number.parseInt(hhRaw ?? '0', 10) || 0;
  const mm = Number.parseInt(mmRaw ?? '0', 10) || 0;

  // First guess: treat the wall-clock as if it were UTC, then correct by the
  // CDMX offset at that instant. One iteration is enough because CDMX has a
  // fixed offset year-round.
  const utcGuess = Date.UTC(ymd.year, ymd.month - 1, ymd.day, hh, mm, 0, 0);
  const offsetMs = getTZOffsetMs(new Date(utcGuess));
  return new Date(utcGuess - offsetMs);
}

/**
 * Returns the CDMX offset in milliseconds for a given UTC instant.
 * Positive when CDMX is behind UTC (which it always is). Currently -360 min.
 */
function getTZOffsetMs(utcInstant: Date): number {
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TOUR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = tzFormatter.formatToParts(utcInstant);
  let y = 0;
  let mo = 0;
  let d = 0;
  let h = 0;
  let mi = 0;
  let s = 0;
  for (const p of parts) {
    if (p.type === 'year') y = Number.parseInt(p.value, 10);
    else if (p.type === 'month') mo = Number.parseInt(p.value, 10);
    else if (p.type === 'day') d = Number.parseInt(p.value, 10);
    else if (p.type === 'hour') h = Number.parseInt(p.value, 10) % 24; // some locales give "24"
    else if (p.type === 'minute') mi = Number.parseInt(p.value, 10);
    else if (p.type === 'second') s = Number.parseInt(p.value, 10);
  }
  const asUTC = Date.UTC(y, mo - 1, d, h, mi, s);
  return asUTC - utcInstant.getTime();
}
