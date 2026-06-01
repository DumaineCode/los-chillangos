import type { Payload } from 'payload';

import type { Tour } from '../../payload-types';
import {
  computeSlotAvailability,
  getCDMXDayRange,
  getTimeSlotsForTour,
  isSameDayCutoffPassed,
  isWeekdayAvailable,
} from './availability';
import { sweepExpiredHolds } from './sweep';

/**
 * Booking capacity reads (Sub-etapa B).
 *
 * Capacity unit = persons (adults + teens). Seats taken for a (tour, date, time)
 * are the sum of `totalPersons` over `bookings` rows where:
 *   - tour matches
 *   - date falls inside the CDMX calendar day of `date`
 *   - time matches the slot
 *   - status is `paid` OR (status is `pending` AND `holdExpiresAt > now`)
 *
 * NO caching: bookings change too fast. The route handler that calls this
 * sets `Cache-Control: no-store`.
 */

export type SlotAvailability = {
  time: string;
  capacity: number;
  seatsTaken: number;
  remaining: number;
  cutoffPassed: boolean;
};

export async function countSeatsTaken({
  payload,
  tourId,
  date,
  time,
  now = new Date(),
}: {
  payload: Payload;
  tourId: number;
  date: Date;
  time: string;
  now?: Date;
}): Promise<number> {
  // Lazy sweep before reading. If it fails (e.g. transient DB hiccup) we
  // still want the read to resolve — an expired-pending counted once is
  // a strictly conservative outcome (overstates seatsTaken, never under).
  // TODO Sub-etapa C: replace this lazy sweep with a Vercel cron at
  // /api/cron/sweep-bookings so reads stop paying for sweeps.
  try {
    await sweepExpiredHolds(payload, now);
  } catch {
    /* swallow — see comment above */
  }

  const { startUTC, endUTC } = getCDMXDayRange(date);
  const result = await payload.find({
    collection: 'bookings',
    pagination: false,
    limit: 0,
    depth: 0,
    overrideAccess: true,
    where: {
      and: [
        { tour: { equals: tourId } },
        { date: { greater_than_equal: startUTC.toISOString() } },
        { date: { less_than: endUTC.toISOString() } },
        { time: { equals: time } },
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
  });

  const docs = (result as { docs?: Array<{ totalPersons?: unknown }> }).docs ?? [];
  let total = 0;
  for (const doc of docs) {
    const tp = doc?.totalPersons;
    if (typeof tp === 'number' && Number.isFinite(tp)) {
      total += tp;
    }
  }
  return total;
}

export async function getDayAvailability({
  payload,
  tour,
  date,
  now = new Date(),
}: {
  payload: Payload;
  tour: Tour;
  date: Date;
  now?: Date;
}): Promise<SlotAvailability[]> {
  const availableDays = tour.availableDays ?? [];
  if (!isWeekdayAvailable(date, availableDays)) return [];

  const slots = getTimeSlotsForTour(tour);
  if (slots.length === 0) return [];

  // Run per-slot capacity reads in parallel — they are independent.
  const seatsTakenPerSlot = await Promise.all(
    slots.map((slot) =>
      countSeatsTaken({ payload, tourId: tour.id, date, time: slot.time, now })
    )
  );

  return slots.map((slot, i) => {
    const seatsTaken = seatsTakenPerSlot[i] ?? 0;
    const { remaining } = computeSlotAvailability({
      slotCapacity: slot.capacity,
      seatsTaken,
      requestedPersons: 1, // remaining is request-agnostic; we just want the count
    });
    return {
      time: slot.time,
      capacity: slot.capacity,
      seatsTaken,
      remaining,
      cutoffPassed: isSameDayCutoffPassed(date, slot.time, now),
    };
  });
}
