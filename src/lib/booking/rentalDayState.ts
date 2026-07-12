import type { Payload, Where } from 'payload';

import type { Booking, Rental, Tour } from '../../payload-types';
import { getCDMXDayRange } from './availability';
import type { RentalDayState, RentalSettings } from './rentalEvaluator';

/**
 * persons_sold day-state reader (Batch 2 / PR2). The ONLY DB-touching piece of
 * the availability engine — it reads the day's committed fleet picture and hands
 * a plain `RentalDayState` to the pure `evaluateRental`.
 *
 * Distinct from `getBikeFleetState` (which reserves by CUPO and MUST NOT be
 * reused): this reader uses the persons_sold basis for tours.
 *
 * Read budget = 1 `findGlobal` + 3 parallel `find`s (bike tours + counting
 * bookings + counting rentals), all `depth:0, pagination:false,
 * overrideAccess:true`, mirroring fleet.ts.
 *
 * Committed-count predicate (identical to capacity.ts): a booking/rental counts
 * iff `status === 'paid' OR (status === 'pending' AND holdExpiresAt > now)`. A
 * lapsed-but-unswept pending hold is therefore treated as FREE.
 */

const DEFAULT_TOTAL_BIKES = 8;
const DEFAULT_BUFFER_MINUTES = 120;
const DEFAULT_OPEN_TIME = '09:00';
const DEFAULT_CLOSE_TIME = '19:00';
const DEFAULT_GRANULARITY_MINUTES = 30;

/** A rental tier offered in the picker grid. */
export type RentalTier = { durationMinutes: number; price: number };

/**
 * Extends the evaluator `RentalSettings` with the grid-only knobs (tiers +
 * granularity) so the availability route needs no extra `findGlobal`.
 */
export type RentalDayStateResult = {
  day: RentalDayState;
  cfg: RentalSettings;
  tiers: RentalTier[];
  granularityMinutes: number;
};

type CountingPredicateArgs = { startISO: string; endISO: string; nowISO: string };

/** The shared committed-count `where` clause: on the day AND (paid OR live-hold pending). */
function countingWhere({ startISO, endISO, nowISO }: CountingPredicateArgs): Where {
  return {
    and: [
      { date: { greater_than_equal: startISO } },
      { date: { less_than: endISO } },
      {
        or: [
          { status: { equals: 'paid' } },
          {
            and: [
              { status: { equals: 'pending' } },
              { holdExpiresAt: { greater_than: nowISO } },
            ],
          },
        ],
      },
    ],
  };
}

export async function getRentalDayState({
  payload,
  date,
  now = new Date(),
}: {
  payload: Payload;
  date: Date;
  now?: Date;
}): Promise<RentalDayStateResult> {
  const settings = (await payload.findGlobal({ slug: 'booking-settings' })) as {
    totalBikes?: number | null;
    bufferMinutes?: number | null;
    openTime?: string | null;
    closeTime?: string | null;
    rentalGranularityMinutes?: number | null;
    rentalTiers?: Array<{ durationMinutes?: number | null; price?: number | null }> | null;
  };

  const cfg: RentalSettings = {
    totalBikes: settings?.totalBikes ?? DEFAULT_TOTAL_BIKES,
    bufferMinutes: settings?.bufferMinutes ?? DEFAULT_BUFFER_MINUTES,
    openTime: settings?.openTime ?? DEFAULT_OPEN_TIME,
    closeTime: settings?.closeTime ?? DEFAULT_CLOSE_TIME,
  };
  const granularityMinutes = settings?.rentalGranularityMinutes ?? DEFAULT_GRANULARITY_MINUTES;
  const tiers: RentalTier[] = (settings?.rentalTiers ?? [])
    .map((t) => ({
      durationMinutes: typeof t?.durationMinutes === 'number' ? t.durationMinutes : Number.NaN,
      price: typeof t?.price === 'number' ? t.price : Number.NaN,
    }))
    .filter((t) => Number.isFinite(t.durationMinutes) && t.durationMinutes > 0 && Number.isFinite(t.price));

  const { startUTC, endUTC } = getCDMXDayRange(date);
  const startISO = startUTC.toISOString();
  const endISO = endUTC.toISOString();
  const nowISO = now.toISOString();

  const [toursRes, bookingsRes, rentalsRes] = await Promise.all([
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
      where: countingWhere({ startISO, endISO, nowISO }),
    }),
    payload.find({
      collection: 'rentals',
      pagination: false,
      limit: 0,
      depth: 0,
      overrideAccess: true,
      where: countingWhere({ startISO, endISO, nowISO }),
    }),
  ]);

  // Bike tours indexed by id → duration lookup; non-bike tours never appear.
  const bikeTourById = new Map<number, Pick<Tour, 'id' | 'durationMinutes'>>(
    (toursRes.docs as Array<Pick<Tour, 'id' | 'durationMinutes'>>).map((t) => [t.id, t])
  );

  // Group counting bookings by (tourId, time) → personsSold = Σ totalPersons.
  const groups = new Map<string, { startTime: string; durationMinutes: number; personsSold: number }>();
  for (const b of bookingsRes.docs as Booking[]) {
    const tourId = typeof b.tour === 'number' ? b.tour : b.tour?.id;
    if (typeof tourId !== 'number') continue;
    const tour = bikeTourById.get(tourId);
    if (!tour) continue; // missing / non-bike → consumes no fleet
    const duration = tour.durationMinutes;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) continue;
    const persons = typeof b.totalPersons === 'number' && Number.isFinite(b.totalPersons) ? b.totalPersons : 0;

    const key = `${tourId}@${b.time}`;
    const existing = groups.get(key);
    if (existing) {
      existing.personsSold += persons;
    } else {
      groups.set(key, { startTime: b.time, durationMinutes: duration, personsSold: persons });
    }
  }

  const tours = [...groups.values()];

  const rentals = (rentalsRes.docs as Rental[])
    .map((r) => ({
      startTime: r.startTime,
      durationMinutes: r.durationMinutes,
      quantity: r.quantity,
    }))
    .filter(
      (r) =>
        typeof r.startTime === 'string' &&
        typeof r.durationMinutes === 'number' &&
        r.durationMinutes > 0 &&
        typeof r.quantity === 'number' &&
        r.quantity > 0
    );

  return { day: { tours, rentals }, cfg, tiers, granularityMinutes };
}
