import type { GlobalConfig } from 'payload';

import { revalidateGlobalAfterChange } from '../hooks/revalidateGlobals';
import { NAV_GROUPS } from '../admin/navGroups';

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
  ],
};
