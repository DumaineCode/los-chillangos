import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { validateHHMM, validateInteger } from '../lib/booking/fieldValidators';
import { NAV_GROUPS } from '../admin/navGroups';

/** Minutes-since-midnight for an HH:MM wall-clock string. */
function hhmmToMinutes(value: string): number {
  const [hh, mm] = value.split(':');
  return Number.parseInt(hh ?? '0', 10) * 60 + Number.parseInt(mm ?? '0', 10);
}

/**
 * BookingSettings global — editable booking policy values.
 *
 * Holds the free-cancellation window (in days) shown in the booking sidebar.
 * The value is a NUMBER, not a sentence: the surrounding copy lives in i18n
 * (`detail.freeCancel` with a `{days}` placeholder) so wording stays
 * translatable while the client controls the number from admin.
 */
export const BookingSettings: GlobalConfig = {
  slug: 'booking-settings',
  label: { en: 'Booking settings', es: 'Ajustes de reserva' },
  admin: {
    group: NAV_GROUPS.settings,
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateGlobalAfterChange],
    // Cross-field rule: rentals must open before they close. HH:MM shape is
    // validated per-field; this enforces the ORDER (openTime < closeTime).
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;
        const open = typeof data.openTime === 'string' ? data.openTime : undefined;
        const close = typeof data.closeTime === 'string' ? data.closeTime : undefined;
        const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (open && close && hhmm.test(open) && hhmm.test(close)) {
          if (hhmmToMinutes(close) <= hhmmToMinutes(open)) {
            throw new Error('La hora de cierre debe ser posterior a la hora de apertura.');
          }
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: 'freeCancellationDays',
      type: 'number',
      required: true,
      defaultValue: 3,
      min: 0,
      label: {
        en: 'Free cancellation window (days)',
        es: 'Ventana de cancelación gratis (días)',
      },
      admin: {
        description: {
          en: 'How many days before the tour a customer can cancel for free. Shown in the booking sidebar.',
          es: 'Cuántos días antes del tour el cliente puede cancelar sin costo. Se muestra en el bloque de reserva.',
        },
      },
    },
    {
      // Size of the shared e-bike fleet. Overlapping bike tours reserve bikes
      // by full slot cupo; the booking flow blocks a slot once Σ capacities of
      // overlapping bike tours would exceed this number. Admin-editable.
      name: 'totalBikes',
      type: 'number',
      required: true,
      defaultValue: 8,
      min: 1,
      label: {
        en: 'Total bikes (fleet size)',
        es: 'Total de bicicletas (tamaño de flota)',
      },
      admin: {
        description: {
          en: 'How many bikes exist in total. Overlapping bike tours share this fleet — a slot is blocked when their combined capacity would exceed it.',
          es: 'Cuántas bicicletas hay en total. Los tours en bici que se solapan comparten esta flota — un horario se bloquea cuando la suma de sus cupos la supera.',
        },
      },
    },
    {
      // Recharge cooldown after a bike tour ENDS before another may start.
      // Measured from end-of-ride (start + durationMinutes), not from start.
      name: 'bufferMinutes',
      type: 'number',
      required: true,
      defaultValue: 120,
      min: 0,
      label: {
        en: 'Recharge buffer (minutes)',
        es: 'Tiempo de recarga (minutos)',
      },
      admin: {
        description: {
          en: 'Minutes the bikes need to recharge after a tour ends before the next bike tour can start. Default 120 (2h).',
          es: 'Minutos que las bicis necesitan para recargar después de que termina un tour antes de que pueda iniciar el siguiente. Por defecto 120 (2h).',
        },
      },
    },
    // rental configuration (rental-system section 6). booking-settings has NO
    // seed in scripts/seed.ts, so every default below lives in defaultValue.
    {
      name: 'rentalTiers',
      type: 'array',
      required: true,
      label: { en: 'Rental tiers', es: 'Niveles de renta' },
      labels: {
        singular: { en: 'Rental tier', es: 'Nivel de renta' },
        plural: { en: 'Rental tiers', es: 'Niveles de renta' },
      },
      defaultValue: [
        { durationMinutes: 60, price: 200 },
        { durationMinutes: 120, price: 300 },
        { durationMinutes: 240, price: 450 },
        { durationMinutes: 360, price: 600 },
      ],
      admin: {
        description: {
          en: 'Duration to per-bike price options offered for standalone rentals (MXN).',
          es: 'Opciones de duracion a precio por bici para rentas sueltas (MXN).',
        },
      },
      fields: [
        {
          name: 'durationMinutes',
          type: 'number',
          required: true,
          min: 1,
          label: { en: 'Duration (minutes)', es: 'Duracion (minutos)' },
          validate: validateInteger(1),
        },
        {
          name: 'price',
          type: 'number',
          required: true,
          min: 1,
          label: { en: 'Price (MXN)', es: 'Precio (MXN)' },
          validate: (value: number | null | undefined) => {
            if (value === null || value === undefined) return 'Required.';
            if (!(value > 0)) return 'Must be greater than 0.';
            return true;
          },
        },
      ],
    },
    {
      name: 'openTime',
      type: 'text',
      required: true,
      defaultValue: '09:00',
      label: { en: 'Rental open time', es: 'Hora de apertura de rentas' },
      admin: {
        description: {
          en: 'Earliest rental start time (HH:MM, CDMX wall clock).',
          es: 'Hora mas temprana para iniciar una renta (HH:MM, hora local CDMX).',
        },
      },
      validate: validateHHMM,
    },
    {
      name: 'closeTime',
      type: 'text',
      required: true,
      defaultValue: '19:00',
      label: { en: 'Rental close time', es: 'Hora de cierre de rentas' },
      admin: {
        description: {
          en: 'Latest instant a rental ride may end (HH:MM, CDMX wall clock). Must be after open time.',
          es: 'Instante mas tarde en que puede terminar una renta (HH:MM, hora local CDMX). Debe ser posterior a la apertura.',
        },
      },
      validate: validateHHMM,
    },
    {
      name: 'rentalGranularityMinutes',
      type: 'number',
      required: true,
      defaultValue: 30,
      min: 1,
      label: { en: 'Rental granularity (minutes)', es: 'Granularidad de renta (minutos)' },
      admin: {
        description: {
          en: 'Step between rental start blocks in the picker grid. Default 30.',
          es: 'Paso entre bloques de inicio de renta en la grilla. Por defecto 30.',
        },
      },
      validate: validateInteger(1),
    },
  ],
};
