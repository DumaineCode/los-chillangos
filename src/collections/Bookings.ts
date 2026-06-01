import type { CollectionConfig, FieldHook } from 'payload';

import {
  revalidateBookingsAfterChange,
  revalidateBookingsAfterDelete,
} from '../hooks/revalidateBookings';
import { generateBookingReference } from '../lib/booking/reference';
import { computeBookingTotals } from '../lib/booking/totals';

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
    privatize: siblingData?.privatize as boolean | undefined,
    privatizeFee: siblingData?.privatizeFee as number | undefined,
  });
  return totalPersons;
};

/** Computes `totalAmount` from sibling headcount + per-person + privatize. */
const computeTotalAmount: FieldHook = ({ siblingData }) => {
  const { totalAmount } = computeBookingTotals({
    adults: siblingData?.adults as number | undefined,
    teens: siblingData?.teens as number | undefined,
    pricePerPerson: siblingData?.pricePerPerson as number | undefined,
    privatize: siblingData?.privatize as boolean | undefined,
    privatizeFee: siblingData?.privatizeFee as number | undefined,
  });
  return totalAmount;
};

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'tour', 'date', 'time', 'status', 'totalPersons', 'createdAt'],
    group: 'Operations',
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
        // creates that bypass field hooks (e.g. the API route in C) still
        // produce consistent rows.
        const { totalPersons, totalAmount } = computeBookingTotals({
          adults: data.adults as number | undefined,
          teens: data.teens as number | undefined,
          pricePerPerson: data.pricePerPerson as number | undefined,
          privatize: data.privatize as boolean | undefined,
          privatizeFee: data.privatizeFee as number | undefined,
        });
        data.totalPersons = totalPersons;
        data.totalAmount = totalAmount;
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
      admin: {
        readOnly: true,
        description: 'Auto-generated public booking reference.',
      },
    },
    {
      name: 'tour',
      type: 'relationship',
      relationTo: 'tours',
      required: true,
      hasMany: false,
      index: true,
      admin: {
        description: 'Which tour was booked.',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      // Note: Payload v3 stores dates as timestamps regardless. We use the
      // `dayOnly` picker for UX; the booking API in Sub-etapa C normalizes
      // the value to the tour's local-calendar midnight before persisting,
      // so a single canonical instant represents the calendar day.
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'Local calendar date of the departure (no time component).',
      },
    },
    {
      name: 'time',
      type: 'text',
      required: true,
      admin: {
        description:
          'Departure time in HH:MM. Must match one of the tour timeSlots at booking time.',
      },
      validate: validateHHMM,
    },
    {
      name: 'adults',
      type: 'number',
      required: true,
      min: 1,
      validate: validateInteger(1),
    },
    {
      name: 'teens',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      validate: validateInteger(0),
    },
    {
      name: 'totalPersons',
      type: 'number',
      required: true,
      admin: {
        readOnly: true,
        description: 'adults + teens — stored for fast capacity queries.',
      },
      hooks: {
        beforeValidate: [computeTotalPersons],
      },
    },
    {
      name: 'privatize',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'pricePerPerson',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'USD per person at the time of booking (snapshot — not linked).',
      },
    },
    {
      name: 'privatizeFee',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      admin: {
        description:
          'Snapshot of the privatize flat fee at booking time (matches the legacy +USD 140 constant; not enforced here).',
      },
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: 'USD',
      validate: (value: string | null | undefined) => {
        if (!value) return 'Currency is required.';
        if (!/^[A-Z]{3}$/.test(value)) {
          return 'Currency must be a 3-letter uppercase ISO code (e.g. "USD").';
        }
        return true;
      },
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        readOnly: true,
        description: 'Cached total. Stripe charges this amount.',
      },
      hooks: {
        beforeValidate: [computeTotalAmount],
      },
    },
    {
      name: 'customer',
      type: 'group',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          validate: (value: string | null | undefined) => {
            if (!value || value.trim().length < 2) {
              return 'Name must be at least 2 characters.';
            }
            return true;
          },
        },
        {
          name: 'email',
          type: 'email',
          required: true,
        },
        {
          name: 'whatsapp',
          type: 'text',
          // Optional. Empty string is allowed; if present, must look phone-ish.
          validate: (value: string | null | undefined) => {
            if (!value) return true;
            if (!/^\+?[0-9\s\-()]{7,20}$/.test(value)) {
              return 'WhatsApp must be 7–20 digits, optionally prefixed by + (spaces/dashes/parens ok).';
            }
            return true;
          },
        },
        {
          name: 'locale',
          type: 'select',
          required: true,
          defaultValue: 'en',
          options: [
            { label: 'English', value: 'en' },
            { label: 'Spanish', value: 'es' },
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
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Expired', value: 'expired' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Refunded', value: 'refunded' },
      ],
      admin: {
        description:
          'pending: hold active; counts against capacity until holdExpiresAt. ' +
          'paid: confirmed; counts against capacity permanently. ' +
          'expired: hold expired without payment; does NOT count. ' +
          'cancelled: customer or admin cancelled; does NOT count. ' +
          'refunded: paid then refunded; does NOT count.',
      },
    },
    {
      name: 'holdExpiresAt',
      type: 'date',
      index: true,
      admin: {
        description:
          'When the pending hold lapses. Only meaningful while status = pending. Sub-etapa B will sweep expired holds.',
      },
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      index: true,
      admin: {
        description:
          'Stripe Checkout Session ID (cs_test_… in test mode). Filled when the checkout session is created in Sub-etapa C.',
      },
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      index: true,
      admin: {
        description:
          'Stripe PaymentIntent ID. Filled by the Stripe webhook in Sub-etapa C when payment succeeds.',
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal admin notes (not sent to the customer).',
      },
    },
  ],
};
