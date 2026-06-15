import type { Payload } from 'payload';

import type { Booking, Tour } from '../../payload-types';
import {
  computeSlotAvailability,
  getCDMXDayRange,
  getTimeSlotsForTour,
  getTourDayISO,
  getTourWeekDays,
  isDateBookableForTour,
  isSameDayCutoffPassed,
  type TourDay,
} from './availability';

/**
 * Week-agenda model for the admin "Agenda" view.
 *
 * The default Bookings list is a flat table of individual booking rows, which
 * cannot answer the operator's real question — "what departures do I have this
 * week and how full is each one?". A booking is a single party; the unit the
 * operator cares about is the DEPARTURE (tour + day + time), whose capacity
 * lives in `tour.timeSlots[].capacity`. This module reshapes raw bookings into
 * per-day, per-departure cards with fill levels.
 *
 * Split (container/presentational at the data layer):
 *   - `buildWeekAgenda` — PURE. No Payload, no DB, no I/O. Fully unit-testable.
 *   - `getWeekAgenda` — thin async wrapper: two `payload.find` reads, then calls
 *     the pure builder. The two reads (tours + the week's bookings) replace the
 *     N×day calls `getDayAvailability` would make, keeping it to 2 queries total.
 *
 * Timezone: every day boundary goes through the CDMX helpers in `availability`.
 */

/** Visual fill bucket for a departure. Drives the color of its capacity bar. */
export type AgendaFill = 'empty' | 'available' | 'almostFull' | 'full';

/** A single booking (party) inside a departure — shown when a card is expanded. */
export type AgendaBookingRow = {
  reference: string;
  customerName: string;
  persons: number;
  status: Booking['status'];
  privatize: boolean;
};

/** One departure = one (tour, day, time) cell with its occupancy. */
export type AgendaDeparture = {
  /** `${tourId}|${dayISO}|${time}` — stable React key + expand key. */
  key: string;
  tourId: number;
  tourTitle: string;
  /** Departure time, 24h `HH:MM`. */
  time: string;
  /** Slot capacity in persons. `0` for orphan departures (slot no longer exists). */
  capacity: number;
  seatsTaken: number;
  remaining: number;
  /** 0–100, seatsTaken / capacity. `0` when capacity is 0. */
  fillPct: number;
  fill: AgendaFill;
  cutoffPassed: boolean;
  /** True if any booking in this departure is privatized. */
  privatized: boolean;
  /**
   * True when this departure holds bookings whose (tour, day, time) no longer
   * matches a current tour slot (e.g. the slot was edited/removed after the
   * booking was paid). Surfaced so a real booking is never silently hidden.
   */
  orphan: boolean;
  bookings: AgendaBookingRow[];
};

export type AgendaDay = {
  /** `YYYY-MM-DD` in CDMX. */
  iso: string;
  /** 0 (Sunday) … 6 (Saturday) in CDMX. */
  weekday: number;
  isToday: boolean;
  isPast: boolean;
  departures: AgendaDeparture[];
};

export type WeekAgenda = {
  weekStartISO: string;
  weekEndISO: string;
  /** Anchor (`?week=`) that lands on the previous week. */
  prevWeekISO: string;
  /** Anchor (`?week=`) that lands on the next week. */
  nextWeekISO: string;
  todayISO: string;
  days: AgendaDay[];
  totals: { departures: number; bookings: number; seatsTaken: number; capacity: number };
};

/** Minimal tour shape the builder needs (satisfies the availability helpers). */
export type AgendaTour = Pick<
  Tour,
  'id' | 'title' | 'availableDays' | 'timeSlots' | 'isSeasonal' | 'seasonal'
>;

/** Pre-flattened booking the pure builder consumes (no Payload doc shape). */
export type AgendaBookingInput = {
  tour: number;
  /** CDMX day of the booking, `YYYY-MM-DD` (precomputed by the caller). */
  dayISO: string;
  time: string;
  totalPersons: number;
  privatize: boolean;
  status: Booking['status'];
  reference: string;
  customerName: string;
};

const DAY_MS = 24 * 3_600_000;

/**
 * Map occupancy to a color bucket:
 *   - empty:      nobody booked yet (neutral / muted)
 *   - available:  room to spare (green)
 *   - almostFull: within the last ~20% (min 1 seat) of capacity (amber)
 *   - full:       no seats left (red)
 */
function fillBucket(capacity: number, seatsTaken: number): AgendaFill {
  if (seatsTaken <= 0) return 'empty';
  const remaining = Math.max(0, capacity - seatsTaken);
  if (remaining <= 0) return 'full';
  const threshold = Math.max(1, Math.ceil(capacity * 0.2));
  return remaining <= threshold ? 'almostFull' : 'available';
}

function sortByTime(departures: AgendaDeparture[]): AgendaDeparture[] {
  // `HH:MM` zero-padded 24h sorts correctly as a plain string.
  return departures.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

/**
 * PURE. Reshapes the week's bookings + tour schedules into a per-day, per-
 * departure agenda. Renders every bookable departure of the week (including
 * empty ones, so the operator sees both booked and open slots), and recovers
 * any booking whose slot no longer exists as an `orphan` departure.
 */
export function buildWeekAgenda({
  tours,
  bookings,
  weekDays,
  now,
  todayISO,
}: {
  tours: AgendaTour[];
  bookings: AgendaBookingInput[];
  weekDays: TourDay[];
  now: Date;
  todayISO: string;
}): WeekAgenda {
  // Bucket bookings by (tour, day, time).
  const groups = new Map<
    string,
    { seatsTaken: number; privatized: boolean; rows: AgendaBookingRow[] }
  >();
  for (const b of bookings) {
    const key = `${b.tour}|${b.dayISO}|${b.time}`;
    let g = groups.get(key);
    if (!g) {
      g = { seatsTaken: 0, privatized: false, rows: [] };
      groups.set(key, g);
    }
    g.seatsTaken += Number.isFinite(b.totalPersons) ? b.totalPersons : 0;
    g.privatized = g.privatized || b.privatize;
    g.rows.push({
      reference: b.reference,
      customerName: b.customerName,
      persons: b.totalPersons,
      status: b.status,
      privatize: b.privatize,
    });
  }

  const tourById = new Map(tours.map((t) => [t.id, t]));
  const consumed = new Set<string>();

  const days: AgendaDay[] = weekDays.map((d) => {
    const departures: AgendaDeparture[] = [];
    for (const tour of tours) {
      if (!isDateBookableForTour(d.date, tour)) continue;
      for (const slot of getTimeSlotsForTour(tour)) {
        const key = `${tour.id}|${d.iso}|${slot.time}`;
        const g = groups.get(key);
        if (g) consumed.add(key);
        const seatsTaken = g?.seatsTaken ?? 0;
        const { remaining } = computeSlotAvailability({
          slotCapacity: slot.capacity,
          seatsTaken,
          requestedPersons: 1,
        });
        departures.push({
          key,
          tourId: tour.id,
          tourTitle: tourTitle(tour),
          time: slot.time,
          capacity: slot.capacity,
          seatsTaken,
          remaining,
          fillPct: slot.capacity > 0 ? Math.min(100, Math.round((seatsTaken / slot.capacity) * 100)) : 0,
          fill: fillBucket(slot.capacity, seatsTaken),
          cutoffPassed: isSameDayCutoffPassed(d.date, slot.time, now),
          privatized: g?.privatized ?? false,
          orphan: false,
          bookings: g?.rows ?? [],
        });
      }
    }
    return {
      iso: d.iso,
      weekday: d.weekday,
      isToday: d.iso === todayISO,
      isPast: d.iso < todayISO,
      departures: sortByTime(departures),
    };
  });

  // Orphan recovery: any booking group not matched to a rendered slot but whose
  // day is in this week still gets surfaced, so a paid reservation is never lost.
  const dayByISO = new Map(days.map((d) => [d.iso, d]));
  for (const [key, g] of groups) {
    if (consumed.has(key)) continue;
    const [tourIdStr, dayISO, time] = key.split('|');
    const day = dayByISO.get(dayISO);
    if (!day) continue;
    const tourId = Number(tourIdStr);
    const tour = tourById.get(tourId);
    day.departures.push({
      key,
      tourId,
      tourTitle: tour ? tourTitle(tour) : `Tour #${tourId}`,
      time,
      capacity: 0,
      seatsTaken: g.seatsTaken,
      remaining: 0,
      fillPct: 100,
      fill: 'full',
      cutoffPassed: false,
      privatized: g.privatized,
      orphan: true,
      bookings: g.rows,
    });
    day.departures = sortByTime(day.departures);
  }

  const totals = days.reduce(
    (acc, d) => {
      for (const dep of d.departures) {
        acc.departures += 1;
        acc.bookings += dep.bookings.length;
        acc.seatsTaken += dep.seatsTaken;
        acc.capacity += dep.capacity;
      }
      return acc;
    },
    { departures: 0, bookings: 0, seatsTaken: 0, capacity: 0 }
  );

  const first = weekDays[0].date;
  const last = weekDays[weekDays.length - 1].date;

  return {
    weekStartISO: weekDays[0].iso,
    weekEndISO: weekDays[weekDays.length - 1].iso,
    prevWeekISO: getTourDayISO(new Date(first.getTime() - 7 * DAY_MS)),
    nextWeekISO: getTourDayISO(new Date(last.getTime() + DAY_MS)),
    todayISO,
    days,
    totals,
  };
}

function tourTitle(tour: AgendaTour): string {
  return typeof tour.title === 'string' && tour.title.trim() ? tour.title : `Tour #${tour.id}`;
}

/**
 * Loads the week's agenda for the admin view. Two reads only:
 *   1. all tours (for schedules + capacities), at the given content `locale`;
 *   2. every booking whose `date` falls in the week window AND counts against
 *      capacity (paid, or pending with a still-live hold).
 *
 * Then delegates to the pure `buildWeekAgenda`.
 */
export async function getWeekAgenda({
  payload,
  anchor,
  now = new Date(),
  locale = 'es',
  weekStartsOn = 1,
}: {
  payload: Payload;
  anchor: Date;
  now?: Date;
  locale?: 'en' | 'es';
  weekStartsOn?: 0 | 1;
}): Promise<WeekAgenda> {
  const weekDays = getTourWeekDays(anchor, weekStartsOn);
  const todayISO = getTourDayISO(now);

  const startUTC = getCDMXDayRange(weekDays[0].date).startUTC;
  const endUTC = getCDMXDayRange(weekDays[weekDays.length - 1].date).endUTC;

  const [toursRes, bookingsRes] = await Promise.all([
    payload.find({
      collection: 'tours',
      pagination: false,
      limit: 0,
      depth: 0,
      overrideAccess: true,
      locale,
      fallbackLocale: false,
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

  const tours: AgendaTour[] = (toursRes.docs as Tour[]).map((t) => ({
    id: t.id,
    title: t.title,
    availableDays: t.availableDays,
    timeSlots: t.timeSlots,
    isSeasonal: t.isSeasonal,
    seasonal: t.seasonal,
  }));

  const bookings: AgendaBookingInput[] = (bookingsRes.docs as Booking[]).map((b) => ({
    tour: typeof b.tour === 'number' ? b.tour : b.tour.id,
    dayISO: getTourDayISO(new Date(b.date)),
    time: b.time,
    totalPersons: typeof b.totalPersons === 'number' ? b.totalPersons : 0,
    privatize: Boolean(b.privatize),
    status: b.status,
    reference: b.reference,
    customerName: b.customer?.name ?? '',
  }));

  return buildWeekAgenda({ tours, bookings, weekDays, now, todayISO });
}
