import type { EmailLocale } from '../lib/email/format';

/**
 * Fixed UI strings for booking emails (structural labels + section titles).
 *
 * These are intentionally NOT editable in the CMS — they're the email's
 * skeleton. The editable marketing copy lives in the `email-content` global.
 * Keeping labels in code avoids label-sprawl in the admin panel and guarantees
 * the layout can't be broken by a content edit.
 */
export interface EmailStrings {
  detailsTitle: string;
  goodToKnowTitle: string;
  meetingPointTitle: string;
  label: {
    reference: string;
    tour: string;
    date: string;
    time: string;
    guests: string;
    total: string;
  };
  /** Headcount phrasing, e.g. "2 adults · 1 teen". */
  guests: (adults: number, teens: number) => string;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const EMAIL_STRINGS: Record<EmailLocale, EmailStrings> = {
  en: {
    detailsTitle: 'Your booking',
    goodToKnowTitle: 'Good to know',
    meetingPointTitle: 'Meeting point',
    label: {
      reference: 'Reference',
      tour: 'Tour',
      date: 'Date',
      time: 'Time',
      guests: 'Guests',
      total: 'Total paid',
    },
    guests: (adults, teens) => {
      const parts = [plural(adults, 'adult', 'adults')];
      if (teens > 0) parts.push(plural(teens, 'teen', 'teens'));
      return parts.join(' · ');
    },
  },
  es: {
    detailsTitle: 'Tu reserva',
    goodToKnowTitle: 'Qué necesitas saber',
    meetingPointTitle: 'Punto de encuentro',
    label: {
      reference: 'Referencia',
      tour: 'Tour',
      date: 'Fecha',
      time: 'Hora',
      guests: 'Personas',
      total: 'Total pagado',
    },
    guests: (adults, teens) => {
      const parts = [plural(adults, 'adulto', 'adultos')];
      if (teens > 0) parts.push(plural(teens, 'adolescente', 'adolescentes'));
      return parts.join(' · ');
    },
  },
};
