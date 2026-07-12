import type { CollectionConfig, FieldHook } from 'payload';

import { generateBookingReference } from '../lib/booking/reference';
import { BOOKING_CURRENCY } from '../lib/booking/currency';
import { getCDMXDayRange } from '../lib/booking/availability';
import { validateHHMM, validateInteger, validateCurrency } from '../lib/booking/fieldValidators';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Rentals collection — standalone bike rental record (rental-system §6).
 *
 * A rental is a bike (or several) rented WITHOUT a tour, after the §5
 * day-before-noon ticket cutoff has passed, when a tour's unsold bikes become
 * pure surplus. It is intentionally a DISTINCT domain from `Bookings` (no tour,
 * no adults/teens) but mirrors its operational shape: the same reservation
 * lifecycle enum, `holdExpiresAt` hold, `reference`, Stripe id columns, and the
 * expired-hold sweep.
 *
 * Money: `totalAmount = quantity × unitPrice`, computed server-side and never
 * trusted from the client. `unitPrice`/`durationMinutes` are snapshots of the
 * chosen tier at checkout time.
 *
 * Versioning is OFF — operational data, not editable content.
 *
 * Access mirrors `Bookings`:
 *   - `read/update/delete` require an authenticated admin.
 *   - `create` is permissive because the public rental checkout route calls
 *     `payload.create` from a server route (no `req.user`) that does its own
 *     authoritative validation.
 */

/** Field-level compute for `totalAmount` = quantity × unitPrice. */
const computeTotalAmount: FieldHook = ({ siblingData }) => {
  const quantity = typeof siblingData?.quantity === 'number' ? siblingData.quantity : 0;
  const unitPrice = typeof siblingData?.unitPrice === 'number' ? siblingData.unitPrice : 0;
  return quantity * unitPrice;
};

export const Rentals: CollectionConfig = {
  slug: 'rentals',
  labels: {
    singular: { en: 'Rental', es: 'Renta' },
    plural: { en: 'Rentals', es: 'Rentas' },
  },
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'date', 'startTime', 'durationMinutes', 'quantity', 'status', 'createdAt'],
    group: NAV_GROUPS.operations,
  },
  versions: false,
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    beforeValidate: [
      ({ data, req, operation, context }) => {
        if (!data) return data;
        // B1 security gate — anonymous-create privileged-field lockdown.
        //
        // `create` access is permissive so the server checkout route can call
        // `payload.create` without a `req.user`. That also exposes a raw
        // anonymous `POST /api/rentals`, which could otherwise set privileged
        // fields directly (status:'paid' to bypass Stripe, a far-future
        // holdExpiresAt, paidAt/stripePaymentIntentId). For an untrusted
        // anonymous create we force a safe state.
        //
        // TRUSTED SERVER CONTRACT: the B3b rental checkout route MUST create
        // rentals with `context: { trustedRentalCreate: true }` (and set its
        // own server-controlled `holdExpiresAt` + `status: 'pending'`). That
        // flag is how a trusted server create is distinguished from raw
        // anonymous REST; do NOT expose it to public request bodies.
        const trusted =
          (req as { context?: { trustedRentalCreate?: unknown } })?.context?.trustedRentalCreate === true ||
          (context as { trustedRentalCreate?: unknown } | undefined)?.trustedRentalCreate === true;
        const isAnonymousCreate =
          operation === 'create' && !(req as { user?: unknown } | undefined)?.user && !trusted;
        if (isAnonymousCreate) {
          data.status = 'pending';
          data.paidAt = null;
          data.stripePaymentIntentId = null;
          // Server-controlled: only the trusted checkout route sets the hold.
          data.holdExpiresAt = null;
        }
        // Auto-fill reference if missing (admin manual creates, programmatic
        // `payload.create` from the checkout route where the caller didn't
        // pre-generate one).
        if (!data.reference) {
          data.reference = generateBookingReference();
        }
        // Recompute the total at the collection level so programmatic creates
        // that bypass field hooks (the checkout API route) still produce a
        // consistent, non-client-trusted total (AC1).
        const quantity = typeof data.quantity === 'number' ? data.quantity : 0;
        const unitPrice = typeof data.unitPrice === 'number' ? data.unitPrice : 0;
        data.totalAmount = quantity * unitPrice;
        // Normalize `date` to the CDMX calendar-day midnight so a single
        // canonical instant represents the rental day (mirrors the tour flow).
        if (data.date) {
          data.date = getCDMXDayRange(new Date(data.date as string)).startUTC;
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: 'reference',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: { en: 'Reference', es: 'Referencia' },
      admin: {
        readOnly: true,
        description: {
          en: 'Auto-generated public rental reference.',
          es: 'Referencia pública de la renta (se genera sola).',
        },
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      label: { en: 'Date', es: 'Fecha' },
      // Payload v3 stores dates as timestamps; the `dayOnly` picker is UX only.
      // The beforeValidate hook normalizes the value to CDMX-calendar midnight.
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: {
          en: 'Local calendar date of the rental (no time component).',
          es: 'Fecha de la renta (sin hora).',
        },
      },
    },
    {
      name: 'startTime',
      type: 'text',
      required: true,
      label: { en: 'Start time', es: 'Hora de inicio' },
      admin: {
        description: {
          en: 'Rental start time in HH:MM (CDMX wall clock).',
          es: 'Hora de inicio de la renta en HH:MM (hora local CDMX).',
        },
      },
      validate: validateHHMM,
    },
    {
      name: 'durationMinutes',
      type: 'number',
      required: true,
      min: 1,
      label: { en: 'Duration (minutes)', es: 'Duración (minutos)' },
      admin: {
        description: {
          en: 'Rental duration in minutes — snapshot from the chosen tier.',
          es: 'Duración de la renta en minutos — foto fija del nivel elegido.',
        },
      },
      validate: validateInteger(1),
    },
    {
      name: 'unitPrice',
      type: 'number',
      required: true,
      min: 0,
      label: { en: 'Unit price (MXN)', es: 'Precio unitario (MXN)' },
      admin: {
        description: {
          en: 'MXN per-bike price at rental time (snapshot from the chosen tier).',
          es: 'Precio MXN por bici al momento de rentar (foto fija del nivel elegido).',
        },
      },
    },
    {
      name: 'quantity',
      type: 'number',
      required: true,
      min: 1,
      label: { en: 'Quantity (bikes)', es: 'Cantidad (bicis)' },
      admin: {
        description: {
          en: 'How many bikes are rented.',
          es: 'Cuántas bicicletas se rentan.',
        },
      },
      validate: validateInteger(1),
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: BOOKING_CURRENCY,
      label: { en: 'Currency', es: 'Moneda' },
      validate: validateCurrency,
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      min: 0,
      label: { en: 'Total amount', es: 'Importe total' },
      admin: {
        readOnly: true,
        description: {
          en: 'Cached total = quantity × unit price. Stripe charges this amount.',
          es: 'Total guardado = cantidad × precio unitario. Stripe cobra este importe.',
        },
      },
      hooks: {
        beforeValidate: [computeTotalAmount],
      },
    },
    {
      name: 'customer',
      type: 'group',
      label: { en: 'Customer', es: 'Cliente' },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: { en: 'Name', es: 'Nombre' },
          validate: (value: string | null | undefined) => {
            if (!value || value.trim().length < 2) {
              return 'El nombre debe tener al menos 2 caracteres.';
            }
            return true;
          },
        },
        {
          name: 'email',
          type: 'email',
          required: true,
          label: { en: 'Email', es: 'Correo electrónico' },
        },
        {
          name: 'whatsapp',
          type: 'text',
          label: { en: 'WhatsApp', es: 'WhatsApp' },
          validate: (value: string | null | undefined) => {
            if (!value) return true;
            if (!/^\+?[0-9\s\-()]{7,20}$/.test(value)) {
              return 'El WhatsApp debe tener entre 7 y 20 dígitos, con + opcional (se permiten espacios, guiones y paréntesis).';
            }
            return true;
          },
        },
        {
          name: 'country',
          type: 'text',
          required: true,
          label: { en: 'Country', es: 'País' },
          admin: { description: 'ISO 3166-1 alpha-2 code (e.g. MX, US, AR).' },
        },
        {
          name: 'locale',
          type: 'select',
          required: true,
          defaultValue: 'en',
          label: { en: 'Language', es: 'Idioma' },
          options: [
            { label: { en: 'English', es: 'Inglés' }, value: 'en' },
            { label: { en: 'Spanish', es: 'Español' }, value: 'es' },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'pending',
      label: { en: 'Status', es: 'Estado' },
      options: [
        { label: { en: 'Pending', es: 'Pendiente' }, value: 'pending' },
        { label: { en: 'Paid', es: 'Pagada' }, value: 'paid' },
        { label: { en: 'Expired', es: 'Expirada' }, value: 'expired' },
        { label: { en: 'Cancelled', es: 'Cancelada' }, value: 'cancelled' },
        { label: { en: 'Refunded', es: 'Reembolsada' }, value: 'refunded' },
      ],
      admin: {
        description: {
          en:
            'pending: hold active; counts against the fleet until holdExpiresAt. ' +
            'paid: confirmed; counts permanently. ' +
            'expired: hold lapsed without payment; does NOT count. ' +
            'cancelled: cancelled; does NOT count. ' +
            'refunded: paid then refunded; does NOT count.',
          es:
            'pendiente: apartado activo; ocupa flota hasta que vence. ' +
            'pagada: confirmada; ocupa flota de forma permanente. ' +
            'expirada: el apartado venció sin pago; NO ocupa flota. ' +
            'cancelada: cancelada; NO ocupa flota. ' +
            'reembolsada: se pagó y luego se reembolsó; NO ocupa flota.',
        },
      },
    },
    {
      name: 'holdExpiresAt',
      type: 'date',
      index: true,
      label: { en: 'Hold expires at', es: 'El apartado vence' },
      admin: {
        description: {
          en: 'When the pending hold lapses. Only meaningful while status = pending.',
          es: 'Cuándo vence el apartado pendiente. Solo aplica mientras el estado es "pendiente".',
        },
      },
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      index: true,
      label: { en: 'Stripe Checkout session ID', es: 'ID de sesión de Stripe Checkout' },
      admin: {
        description: {
          en: 'Stripe Checkout Session ID. Filled when the checkout session is created.',
          es: 'ID de la sesión de Stripe Checkout. Se llena al iniciar el pago.',
        },
      },
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      index: true,
      label: { en: 'Stripe PaymentIntent ID', es: 'ID de pago de Stripe (PaymentIntent)' },
      admin: {
        description: {
          en: 'Stripe PaymentIntent ID. Filled by the Stripe webhook when payment succeeds.',
          es: 'ID del pago en Stripe. Se llena cuando el pago se completa.',
        },
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      label: { en: 'Paid at', es: 'Pagada el' },
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: { en: 'Internal notes', es: 'Notas internas' },
      admin: {
        description: {
          en: 'Internal admin notes (not sent to the customer).',
          es: 'Notas internas del equipo (no se le envían al cliente).',
        },
      },
    },
  ],
};
