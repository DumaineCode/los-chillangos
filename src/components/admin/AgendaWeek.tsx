'use client';

import { useState } from 'react';

import { TOUR_TIMEZONE } from '../../lib/booking/availability';
import type { AgendaBookingRow, AgendaDeparture, WeekAgenda } from '../../lib/booking/agenda';

/**
 * Presentational client component for the admin Agenda view.
 *
 * Receives a fully-computed `WeekAgenda` (see `lib/booking/agenda.ts`) and only
 * renders it: a 7-day week grid where each departure is a card with a capacity
 * fill bar, color-coded by how full it is, plus inline expand to reveal the
 * individual bookings. The only client state is which cards are expanded; week
 * navigation is plain links (`?week=YYYY-MM-DD`) so it works without a router.
 *
 * Styling lives in `app/(payload)/custom.scss` under `.lc-agenda`, scoped so it
 * never fights Payload's theme and leans on its CSS variables for light/dark.
 */

type Language = 'es' | 'en';

const COPY: Record<Language, Record<string, string>> = {
  es: {
    title: 'Agenda de la semana',
    sub: 'Tus salidas, con cuánto cupo llevas en cada una. Tocá una salida para ver quién viene.',
    prev: 'Semana anterior',
    next: 'Semana siguiente',
    today: 'Esta semana',
    weekEmpty: 'No hay salidas configuradas esta semana.',
    dayEmpty: 'Sin salidas',
    noBookings: 'Sin reservas todavía',
    full: 'Lleno',
    privatized: 'Privatizado',
    orphan: 'Fuera de horario',
    seatsOf: 'de',
    persons: 'pers.',
    departures: 'salidas',
    booked: 'reservadas',
  },
  en: {
    title: 'This week’s agenda',
    sub: 'Your departures and how full each one is. Tap a departure to see who’s coming.',
    prev: 'Previous week',
    next: 'Next week',
    today: 'This week',
    weekEmpty: 'No departures scheduled this week.',
    dayEmpty: 'No departures',
    noBookings: 'No bookings yet',
    full: 'Full',
    privatized: 'Privatized',
    orphan: 'Off-schedule',
    seatsOf: 'of',
    persons: 'ppl',
    departures: 'departures',
    booked: 'booked',
  },
};

const STATUS_LABELS: Record<Language, Record<AgendaBookingRow['status'], string>> = {
  es: {
    pending: 'Pendiente',
    paid: 'Pagada',
    expired: 'Expirada',
    cancelled: 'Cancelada',
    refunded: 'Reembolsada',
  },
  en: {
    pending: 'Pending',
    paid: 'Paid',
    expired: 'Expired',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  },
};

function isoToNoonUTC(iso: string): Date {
  // Noon UTC = 06:00 CDMX, same calendar day — no day drift when formatting.
  return new Date(`${iso}T12:00:00.000Z`);
}

function makeDayFormatter(language: Language) {
  return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    timeZone: TOUR_TIMEZONE,
  });
}

function makeRangeFormatter(language: Language) {
  return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: TOUR_TIMEZONE,
  });
}

const ChevronIcon = (
  <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
    <path
      d="m9 6 6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

export function AgendaWeek({ agenda, language }: { agenda: WeekAgenda; language: Language }) {
  const t = COPY[language];
  const dayFmt = makeDayFormatter(language);
  const rangeFmt = makeRangeFormatter(language);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const rangeLabel = `${rangeFmt.format(isoToNoonUTC(agenda.weekStartISO))} – ${rangeFmt.format(
    isoToNoonUTC(agenda.weekEndISO)
  )}`;

  const hasAnyDeparture = agenda.totals.departures > 0;

  return (
    <div className="lc-agenda">
      <div className="lc-agenda__head">
        <div>
          <h1 className="lc-agenda__title">{t.title}</h1>
          <p className="lc-agenda__sub">{t.sub}</p>
        </div>
        <div className="lc-agenda__summary">
          <span className="lc-agenda__summary-num">{agenda.totals.seatsTaken}</span>
          <span className="lc-agenda__summary-label">
            {t.persons} {t.booked}
          </span>
        </div>
      </div>

      <nav className="lc-agenda__nav" aria-label={t.title}>
        <a className="lc-agenda__navbtn" href={`?week=${agenda.prevWeekISO}`} aria-label={t.prev}>
          <span className="lc-agenda__navbtn-icon lc-agenda__navbtn-icon--prev">{ChevronIcon}</span>
        </a>
        <span className="lc-agenda__range">{rangeLabel}</span>
        <a className="lc-agenda__navbtn" href={`?week=${agenda.nextWeekISO}`} aria-label={t.next}>
          <span className="lc-agenda__navbtn-icon">{ChevronIcon}</span>
        </a>
        <a className="lc-agenda__today" href="?">
          {t.today}
        </a>
      </nav>

      {!hasAnyDeparture && <p className="lc-agenda__weekempty">{t.weekEmpty}</p>}

      <div className="lc-agenda__grid">
        {agenda.days.map((day) => {
          const dayClasses = [
            'lc-agenda__day',
            day.isToday ? 'is-today' : '',
            day.isPast ? 'is-past' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <section className={dayClasses} key={day.iso}>
              <header className="lc-agenda__day-head">
                <span className="lc-agenda__day-name">{dayFmt.format(isoToNoonUTC(day.iso))}</span>
                {day.isToday && <span className="lc-agenda__day-badge">●</span>}
              </header>

              {day.departures.length === 0 ? (
                <p className="lc-agenda__empty">{t.dayEmpty}</p>
              ) : (
                <ul className="lc-agenda__deps">
                  {day.departures.map((dep) => (
                    <li key={dep.key}>
                      <DepartureCard
                        dep={dep}
                        language={language}
                        expanded={Boolean(expanded[dep.key])}
                        onToggle={() => toggle(dep.key)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DepartureCard({
  dep,
  language,
  expanded,
  onToggle,
}: {
  dep: AgendaDeparture;
  language: Language;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = COPY[language];
  const canExpand = dep.bookings.length > 0;

  const cardClasses = [
    'lc-agenda__dep',
    `is-${dep.fill}`,
    dep.orphan ? 'is-orphan' : '',
    canExpand ? 'is-expandable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const head = (
    <>
      <span className="lc-agenda__dep-time">{dep.time}</span>
      <span className="lc-agenda__dep-title">{dep.tourTitle}</span>
      <span className="lc-agenda__dep-count">
        {dep.orphan ? (
          <span className="lc-agenda__dep-persons">
            {dep.seatsTaken} {t.persons}
          </span>
        ) : (
          <>
            <strong>{dep.seatsTaken}</strong>
            <span className="lc-agenda__dep-cap">
              {' '}
              {t.seatsOf} {dep.capacity}
            </span>
          </>
        )}
        {canExpand && (
          <span
            className={`lc-agenda__dep-chevron${expanded ? ' is-open' : ''}`}
            aria-hidden="true"
          >
            {ChevronIcon}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div className={cardClasses}>
      {canExpand ? (
        <button
          className="lc-agenda__dep-head"
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {head}
        </button>
      ) : (
        <div className="lc-agenda__dep-head">{head}</div>
      )}

      {!dep.orphan && (
        <div className="lc-agenda__bar" role="presentation">
          <span className="lc-agenda__bar-fill" style={{ width: `${dep.fillPct}%` }} />
        </div>
      )}

      {(dep.privatized || dep.orphan || dep.fill === 'full') && (
        <div className="lc-agenda__tags">
          {dep.fill === 'full' && !dep.orphan && (
            <span className="lc-agenda__tag lc-agenda__tag--full">{t.full}</span>
          )}
          {dep.privatized && (
            <span className="lc-agenda__tag lc-agenda__tag--priv">{t.privatized}</span>
          )}
          {dep.orphan && (
            <span className="lc-agenda__tag lc-agenda__tag--orphan">{t.orphan}</span>
          )}
        </div>
      )}

      {canExpand && expanded && (
        <ul className="lc-agenda__bookings">
          {dep.bookings.map((b) => (
            <li className="lc-agenda__booking" key={b.reference}>
              <span className="lc-agenda__booking-name">{b.customerName || b.reference}</span>
              <span className="lc-agenda__booking-persons">
                {b.persons} {t.persons}
              </span>
              <span className={`lc-agenda__status is-${b.status}`}>
                {STATUS_LABELS[language][b.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
