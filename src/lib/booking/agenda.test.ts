import { describe, expect, it } from 'vitest';

import { buildWeekAgenda, type AgendaBookingInput, type AgendaRentalInput, type AgendaTour } from './agenda';
import { getTourWeekDays } from './availability';

/**
 * `buildWeekAgenda` is pure — fixed `now`/`todayISO` keep it timezone-stable on
 * any CI runner. The week anchor 2026-06-15 is a Monday in CDMX.
 */

const WEEK = getTourWeekDays(new Date('2026-06-15T12:00:00Z')); // Mon 06-15 … Sun 06-21
const TODAY_ISO = '2026-06-15';
const NOW = new Date('2026-06-15T13:00:00Z'); // 07:00 CDMX, Monday

function makeTour(overrides: Partial<AgendaTour> = {}): AgendaTour {
  return {
    id: 42,
    title: 'E-bike classic',
    availableDays: ['1', '3', '5'], // Mon, Wed, Fri
    timeSlots: [
      { time: '09:00', capacity: 8 },
      { time: '14:00', capacity: 6 },
    ],
    isSeasonal: false,
    seasonal: undefined,
    ...overrides,
  };
}

function booking(overrides: Partial<AgendaBookingInput>): AgendaBookingInput {
  return {
    tour: 42,
    dayISO: '2026-06-15',
    time: '09:00',
    totalPersons: 2,
    privatize: false,
    status: 'paid',
    reference: 'LC-0001',
    customerName: 'Ana',
    ...overrides,
  };
}

function findDep(
  agenda: ReturnType<typeof buildWeekAgenda>,
  iso: string,
  time: string,
  orphan = false
) {
  const day = agenda.days.find((d) => d.iso === iso);
  return day?.departures.find((dep) => dep.time === time && dep.orphan === orphan);
}

describe('buildWeekAgenda', () => {
  it('renders one departure per (bookable day, time slot)', () => {
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [],
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });

    expect(agenda.days).toHaveLength(7);

    // Monday is bookable → both slots show, each empty.
    const monday = agenda.days.find((d) => d.iso === '2026-06-15')!;
    expect(monday.departures.map((d) => d.time)).toEqual(['09:00', '14:00']);
    expect(monday.departures.every((d) => d.fill === 'empty')).toBe(true);
    expect(monday.isToday).toBe(true);

    // Tuesday is NOT in availableDays → no departures at all.
    const tuesday = agenda.days.find((d) => d.iso === '2026-06-16')!;
    expect(tuesday.departures).toHaveLength(0);
  });

  it('computes fill buckets from seats taken vs capacity', () => {
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [
        // 7 / 8 on Mon 09:00 → almostFull (remaining 1, threshold 2)
        booking({ totalPersons: 2, reference: 'LC-1' }),
        booking({ totalPersons: 5, reference: 'LC-2' }),
        // 6 / 6 on Wed 14:00 → full
        booking({ dayISO: '2026-06-17', time: '14:00', totalPersons: 6, reference: 'LC-3' }),
      ],
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });

    const mon0900 = findDep(agenda, '2026-06-15', '09:00')!;
    expect(mon0900.seatsTaken).toBe(7);
    expect(mon0900.remaining).toBe(1);
    expect(mon0900.fill).toBe('almostFull');
    expect(mon0900.fillPct).toBe(88);
    expect(mon0900.bookings).toHaveLength(2);

    const wed1400 = findDep(agenda, '2026-06-17', '14:00')!;
    expect(wed1400.fill).toBe('full');
    expect(wed1400.remaining).toBe(0);

    // Untouched slot stays available/empty.
    const mon1400 = findDep(agenda, '2026-06-15', '14:00')!;
    expect(mon1400.fill).toBe('empty');
  });

  it('reports a departure as available when there is comfortable room', () => {
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [booking({ totalPersons: 2 })], // 2 / 8 → remaining 6 > threshold 2
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });
    expect(findDep(agenda, '2026-06-15', '09:00')!.fill).toBe('available');
  });

  it('flags privatized departures when any booking is privatized', () => {
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [
        booking({ reference: 'LC-A', privatize: false }),
        booking({ reference: 'LC-B', privatize: true }),
      ],
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });
    expect(findDep(agenda, '2026-06-15', '09:00')!.privatized).toBe(true);
  });

  it('recovers bookings whose slot no longer exists as orphan departures', () => {
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [
        // time 11:00 is not a tour slot → orphan on Monday
        booking({ time: '11:00', totalPersons: 3, reference: 'LC-ORPHAN-1' }),
        // Tuesday is not bookable for this tour → orphan on Tuesday
        booking({ dayISO: '2026-06-16', time: '10:00', totalPersons: 4, reference: 'LC-ORPHAN-2' }),
      ],
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });

    const monOrphan = findDep(agenda, '2026-06-15', '11:00', true)!;
    expect(monOrphan.orphan).toBe(true);
    expect(monOrphan.capacity).toBe(0);
    expect(monOrphan.seatsTaken).toBe(3);
    expect(monOrphan.fill).toBe('full');

    const tueOrphan = findDep(agenda, '2026-06-16', '10:00', true)!;
    expect(tueOrphan.orphan).toBe(true);
    expect(tueOrphan.seatsTaken).toBe(4);
    // The orphan is the only thing on an otherwise non-bookable day.
    expect(agenda.days.find((d) => d.iso === '2026-06-16')!.departures).toHaveLength(1);
  });

  it('falls back to a synthetic title for orphans of an unknown tour', () => {
    const agenda = buildWeekAgenda({
      tours: [], // no tours loaded
      bookings: [booking({ tour: 99, time: '11:00', reference: 'LC-X' })],
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });
    expect(findDep(agenda, '2026-06-15', '11:00', true)!.tourTitle).toBe('Tour #99');
  });

  it('aggregates weekly totals and computes prev/next anchors', () => {
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [
        booking({ totalPersons: 2, reference: 'LC-1' }),
        booking({ totalPersons: 5, reference: 'LC-2' }),
        booking({ dayISO: '2026-06-17', time: '14:00', totalPersons: 6, reference: 'LC-3' }),
      ],
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });

    expect(agenda.weekStartISO).toBe('2026-06-15');
    expect(agenda.weekEndISO).toBe('2026-06-21');
    expect(agenda.prevWeekISO).toBe('2026-06-08');
    expect(agenda.nextWeekISO).toBe('2026-06-22');
    expect(agenda.totals.bookings).toBe(3);
    expect(agenda.totals.seatsTaken).toBe(13);
  });

  it('surfaces a live rental as a bikes-out block over [start, start+dur+buffer) (AC29)', () => {
    const rental: AgendaRentalInput = {
      dayISO: '2026-06-15',
      startTime: '10:00',
      durationMinutes: 120,
      quantity: 2,
      reference: 'LC-RENT29',
      status: 'paid',
    };
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [],
      rentals: [rental],
      bufferMinutes: 120,
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });

    const monday = agenda.days.find((d) => d.iso === '2026-06-15')!;
    expect(monday.rentalBlocks).toHaveLength(1);
    const block = monday.rentalBlocks[0]!;
    expect(block.startTime).toBe('10:00');
    // ride 120 + recharge buffer 120 → ends 14:00.
    expect(block.endTime).toBe('14:00');
    expect(block.quantity).toBe(2);
    expect(block.reference).toBe('LC-RENT29');

    // Other days carry an empty rentalBlocks array (no crash, no bleed).
    const tuesday = agenda.days.find((d) => d.iso === '2026-06-16')!;
    expect(tuesday.rentalBlocks).toEqual([]);
    // An in-day block does not spill past midnight.
    expect(block.endsNextDay).toBe(false);
  });

  it('flags a rental whose buffer-inclusive window spills past midnight (L2 next-day indicator)', () => {
    const rental: AgendaRentalInput = {
      dayISO: '2026-06-15',
      startTime: '22:00',
      durationMinutes: 120, // ride ends 00:00, + 120 buffer → 02:00 next day
      quantity: 1,
      reference: 'LC-RENTLATE',
      status: 'paid',
    };
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [],
      rentals: [rental],
      bufferMinutes: 120,
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });

    const monday = agenda.days.find((d) => d.iso === '2026-06-15')!;
    const block = monday.rentalBlocks[0]!;
    // Display end is still clamped to a valid wall-clock time…
    expect(block.endTime).toBe('23:59');
    // …but the block is explicitly marked as ending on the next day.
    expect(block.endsNextDay).toBe(true);
  });

  it('defaults rentalBlocks to an empty array when no rentals are passed', () => {
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [],
      weekDays: WEEK,
      now: NOW,
      todayISO: TODAY_ISO,
    });
    expect(agenda.days.every((d) => Array.isArray(d.rentalBlocks) && d.rentalBlocks.length === 0)).toBe(true);
  });

  it('marks days before today as past', () => {
    const agenda = buildWeekAgenda({
      tours: [makeTour()],
      bookings: [],
      weekDays: WEEK,
      now: NOW,
      todayISO: '2026-06-17', // pretend today is Wednesday
    });
    expect(agenda.days.find((d) => d.iso === '2026-06-15')!.isPast).toBe(true);
    expect(agenda.days.find((d) => d.iso === '2026-06-17')!.isToday).toBe(true);
    expect(agenda.days.find((d) => d.iso === '2026-06-19')!.isPast).toBe(false);
  });
});
