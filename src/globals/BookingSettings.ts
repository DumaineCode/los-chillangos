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
  ],
};
