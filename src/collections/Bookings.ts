import type { CollectionConfig, FieldHook } from 'payload';

import {
  revalidateBookingsAfterChange,
  revalidateBookingsAfterDelete,
} from '../hooks/revalidateBookings';
import { generateBookingReference } from '../lib/booking/reference';
import type { SelectedExtra } from '../lib/booking/pricing';
import { computeBookingTotals } from '../lib/booking/totals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Map the persisted `selectedExtras` snapshot rows to the pricing contract.
 *
 * The snapshot stores the full extra (extraId, name, unitPrice, priceType,
 * computedAmount); the pricing math only needs `price` (= unitPrice) and
 * `priceType`. Non-array / partial inputs collapse to an empty selection so a
 * fresh admin create (or a legacy row with no extras) recomputes to base.
 */
function toSelectedExtras(raw: unknown): SelectedExtra[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      price: typeof r.unitPrice === 'number' ? r.unitPrice : 0,
      priceType: r.priceType === 'perPerson' ? 'perPerson' : 'total',
    }));
}

/**
 * Bookings collection — persistent booking record (Sub-etapa A scope).
 *
 * What this stage stores:
 *   - The booking facts (tour, date, time, headcount, customer).
 *   - A snapshot of the price the customer agreed to (so later tour price
 *     changes don't retroactively rewrite past charges).
 *   - A status enum that the availability layer (Sub-etapa B) will read to
 *     count occupied seats: `pending` and `paid` count, the rest don't.
 *   - Stripe ID columns are present but empty — Sub-etapa C fills them.
 *   - `holdExpiresAt` is just stored here; the sweep job lives in B.
 *
 * Versioning is OFF — this is operational data, not editable content.
 *
 * Access:
 *   - `read/update/delete` require an authenticated admin.
 *   - `create` is permissive because the public booking API route in
 *     Sub-etapa C will call `payload.create` from a server route that does
 *     its own validation. We don't want Payload's local-API access layer to
 *     reject server-side creates that have no `req.user`.
 */

/** HH:MM 24h validator, mirrors `Tours.timeSlots[].time`. */
function validateHHMM(value: string | null | undefined): true | string {
  if (!value) return 'Time is required.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return 'Time must be HH:MM in 24h format.';
  }
  return true;
}

/** Integer headcount validator (Payload allows decimals on number fields). */
function validateInteger(min: number) {
  return (value: number | null | undefined): true | string => {
    if (value === null || value === undefined) return 'Required.';
    if (!Number.isInteger(value)) return 'Must be a whole number.';
    if (value < min) return `Must be at least ${min}.`;
    return true;
  };
}

/** Computes `totalPersons` from sibling adults+teens at field-write time. */
const computeTotalPersons: FieldHook = ({ siblingData }) => {
  const { totalPersons } = computeBookingTotals({
    adults: siblingData?.adults as number | undefined,
    teens: siblingData?.teens as number | undefined,
    pricePerPerson: siblingData?.pricePerPerson as number | undefined,
    selectedExtras: toSelectedExtras(siblingData?.selectedExtras),
  });
  return totalPersons;
};

/** Computes `totalAmount` from sibling headcount + per-person + selected extras. */
const computeTotalAmount: FieldHook = ({ siblingData }) => {
  const { totalAmount } = computeBookingTotals({
    adults: siblingData?.adults as number | undefined,
    teens: siblingData?.teens as number | undefined,
    pricePerPerson: siblingData?.pricePerPerson as number | undefined,
    selectedExtras: toSelectedExtras(siblingData?.selectedExtras),
  });
  return totalAmount;
};

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  labels: {
    singular: { en: 'Booking', es: 'Reserva' },
    plural: { en: 'Bookings', es: 'Reservas' },
  },
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'tour', 'date', 'time', 'status', 'totalPersons', 'createdAt'],
    group: NAV_GROUPS.operations,
    components: {
      // Tab bar above the native list so it reads as the "All" tab of the same
      // "Reservas" surface as the custom week calendar (/admin/agenda).
      beforeList: ['/components/admin/BookingsBeforeList'],
    },
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
      ({ data }) => {
        if (!data) return data;
        // Auto-fill reference if missing (admin manual creates, programmatic
        // `payload.create` from internal jobs).
        if (!data.reference) {
          data.reference = generateBookingReference();
        }
        // Recompute snapshot totals at the collection level so programmatic
        // creates that bypass field hooks (e.g. the checkout API route) still
        // produce consistent rows from the unified `selectedExtras` contract.
        const selectedExtras = toSelectedExtras(data.selectedExtras);
        const { totalPersons, totalAmount } = computeBookingTotals({
          adults: data.adults as number | undefined,
          teens: data.teens as number | undefined,
          pricePerPerson: data.pricePerPerson as number | undefined,
          selectedExtras,
        });
        data.totalPersons = totalPersons;

        // Historical-row guard: legacy bookings created before the extras
        // system have NO selectedExtras but may carry a privatize fee folded
        // into their stored totalAmount. Recomputing from an empty extras set
        // would silently drop that fee, rewriting a past charge. So only
        // overwrite totalAmount when this row actually has extras OR has no
        // prior total to preserve. New bookings always pass selectedExtras
        // (even an empty array means "no extras, base only") via the checkout
        // route, and historical rows keep their snapshot untouched.
        const hasPriorTotal =
          typeof data.totalAmount === 'number' && Number.isFinite(data.totalAmount);
        if (selectedExtras.length > 0 || !hasPriorTotal) {
          data.totalAmount = totalAmount;
        }
        return data;
      },
    ],
    afterChange: [revalidateBookingsAfterChange],
    afterDelete: [revalidateBookingsAfterDelete],
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
          en: 'Auto-generated public booking reference.',
          es: 'Referencia pública de la reserva (se genera sola).',
        },
      },
    },
    {
      name: 'tour',
      type: 'relationship',
      relationTo: 'tours',
      required: true,
      hasMany: false,
      index: true,
      label: { en: 'Tour', es: 'Tour' },
      admin: {
        description: { en: 'Which tour was booked.', es: 'Qué tour se reservó.' },
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      label: { en: 'Date', es: 'Fecha' },
      // Note: Payload v3 stores dates as timestamps regardless. We use the
      // `dayOnly` picker for UX; the booking API in Sub-etapa C normalizes
      // the value to the tour's local-calendar midnight before persisting,
      // so a single canonical instant represents the calendar day.
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: {
          en: 'Local calendar date of the departure (no time component).',
          es: 'Fecha de salida (sin hora).',
        },
      },
    },
    {
      name: 'time',
      type: 'text',
      required: true,
      label: { en: 'Time', es: 'Hora' },
      admin: {
        description: {
          en: 'Departure time in HH:MM. Must match one of the tour timeSlots at booking time.',
          es: 'Hora de salida en HH:MM. Debe coincidir con un horario del tour al momento de reservar.',
        },
      },
      validate: validateHHMM,
    },
    {
      name: 'adults',
      type: 'number',
      required: true,
      min: 1,
      label: { en: 'Adults', es: 'Adultos' },
      validate: validateInteger(1),
    },
    {
      name: 'teens',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      label: { en: 'Teens', es: 'Adolescentes' },
      validate: validateInteger(0),
    },
    {
      name: 'totalPersons',
      type: 'number',
      required: true,
      label: { en: 'Total persons', es: 'Total de personas' },
      admin: {
        readOnly: true,
        description: {
          en: 'adults + teens — stored for fast capacity queries.',
          es: 'adultos + adolescentes — se guarda para consultar el cupo rápido.',
        },
      },
      hooks: {
        beforeValidate: [computeTotalPersons],
      },
    },
    {
      name: 'privatize',
      type: 'checkbox',
      defaultValue: false,
      label: { en: 'Private booking', es: 'Reserva privada' },
    },
    {
      name: 'pricePerPerson',
      type: 'number',
      required: true,
      min: 0,
      label: { en: 'Price per person', es: 'Precio por persona' },
      admin: {
        description: {
          en: 'USD per person at the time of booking (snapshot — not linked).',
          es: 'USD por persona al momento de reservar (foto fija — no se actualiza después).',
        },
      },
    },
    {
      name: 'privatizeFee',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      label: { en: 'Private booking fee', es: 'Cargo por reserva privada' },
      admin: {
        description: {
          en: 'Snapshot of the privatize flat fee at booking time (matches the legacy +USD 140 constant; not enforced here).',
          es: 'Foto fija del cargo por tour privado al momento de reservar (equivale al +USD 140 anterior; aquí no se aplica automáticamente).',
        },
      },
    },
    {
      // Snapshot of the extras the customer selected AT booking time. Like
      // `pricePerPerson`, these are frozen copies (not foreign keys) so a later
      // price/name edit on the Extras collection never rewrites a historical
      // charge. Optional + additive: legacy rows (pre-extras) simply have an
      // empty array, and the active pricing path reads this to recompute totals.
      name: 'selectedExtras',
      type: 'array',
      label: { en: 'Selected extras', es: 'Extras seleccionados' },
      labels: {
        singular: { en: 'Selected extra', es: 'Extra seleccionado' },
        plural: { en: 'Selected extras', es: 'Extras seleccionados' },
      },
      admin: {
        readOnly: true,
        description: {
          en: 'Frozen snapshot of the extras chosen at booking time. Read-only — set by the checkout flow.',
          es: 'Copia fija de los extras elegidos al momento de reservar. Solo lectura — la define el flujo de pago.',
        },
      },
      fields: [
        {
          name: 'extraId',
          type: 'number',
          required: true,
          label: { en: 'Extra ID', es: 'ID del extra' },
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          label: { en: 'Name', es: 'Nombre' },
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
          label: { en: 'Unit price (USD)', es: 'Precio unitario (USD)' },
        },
        {
          name: 'priceType',
          type: 'select',
          required: true,
          label: { en: 'Price type', es: 'Tipo de precio' },
          options: [
            { label: { en: 'Flat', es: 'Fijo' }, value: 'total' },
            { label: { en: 'Per person', es: 'Por persona' }, value: 'perPerson' },
          ],
        },
        {
          name: 'computedAmount',
          type: 'number',
          required: true,
          min: 0,
          label: { en: 'Computed amount (USD)', es: 'Importe calculado (USD)' },
        },
      ],
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: 'USD',
      label: { en: 'Currency', es: 'Moneda' },
      validate: (value: string | null | undefined) => {
        if (!value) return 'La moneda es obligatoria.';
        if (!/^[A-Z]{3}$/.test(value)) {
          return 'La moneda debe ser un código ISO de 3 letras en mayúsculas (ej.: "USD").';
        }
        return true;
      },
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
          en: 'Cached total. Stripe charges this amount.',
          es: 'Total guardado. Stripe cobra este importe.',
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
          // Optional. Empty string is allowed; if present, must look phone-ish.
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
            'pending: hold active; counts against capacity until holdExpiresAt. ' +
            'paid: confirmed; counts against capacity permanently. ' +
            'expired: hold expired without payment; does NOT count. ' +
            'cancelled: customer or admin cancelled; does NOT count. ' +
            'refunded: paid then refunded; does NOT count.',
          es:
            'pendiente: apartado activo; ocupa cupo hasta que vence. ' +
            'pagada: confirmada; ocupa cupo de forma permanente. ' +
            'expirada: el apartado venció sin pago; NO ocupa cupo. ' +
            'cancelada: la canceló el cliente o el equipo; NO ocupa cupo. ' +
            'reembolsada: se pagó y luego se reembolsó; NO ocupa cupo.',
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
          en: 'When the pending hold lapses. Only meaningful while status = pending. Sub-etapa B will sweep expired holds.',
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
          en: 'Stripe Checkout Session ID (cs_test_… in test mode). Filled when the checkout session is created in Sub-etapa C.',
          es: 'ID de la sesión de Stripe Checkout (cs_test_… en modo prueba). Se llena solo al iniciar el pago.',
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
          en: 'Stripe PaymentIntent ID. Filled by the Stripe webhook in Sub-etapa C when payment succeeds.',
          es: 'ID del pago en Stripe. Se llena solo cuando el pago se completa.',
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
