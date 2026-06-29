import type { CollectionConfig } from 'payload';

import { NAV_GROUPS } from '../admin/navGroups';

/**
 * ContactMessages collection — submissions from the public "Contáctanos"
 * form on the landing page.
 *
 * Deliberately minimal (the client asked for the fewest possible fields):
 * we store ONLY what the visitor types — name, email, message — plus an
 * operational `status` so the owner can mark a message as handled, and an
 * optional `phone` (the form's only optional channel).
 *
 * Notification: the public API route (`/api/contact`) emails the owner on
 * create (Resend). This row is the durable record so nothing is lost if an
 * email bounces or the inbox is missed.
 *
 * Access mirrors `Bookings`:
 *   - `create` is permissive — the server route validates the payload itself
 *     and calls `payload.create` with `overrideAccess: true`; we must not let
 *     Payload's access layer reject server-side creates that have no req.user.
 *   - everything else requires an authenticated admin.
 *
 * Versioning OFF — operational data, not editable content.
 */
export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  labels: {
    singular: { en: 'Message', es: 'Mensaje' },
    plural: { en: 'Messages', es: 'Mensajes' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'phone', 'status', 'createdAt'],
    group: NAV_GROUPS.operations,
    description: {
      en: 'Messages sent through the contact form on the home page.',
      es: 'Mensajes enviados desde el formulario de contacto de la página de inicio.',
    },
  },
  versions: false,
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', es: 'Nombre' },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      label: { en: 'Email', es: 'Correo electrónico' },
    },
    {
      name: 'phone',
      type: 'text',
      label: { en: 'Phone', es: 'Teléfono' },
      admin: {
        description: {
          en: 'Optional — only present if the visitor left a number.',
          es: 'Opcional — solo aparece si la persona dejó un número.',
        },
      },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      label: { en: 'Message', es: 'Mensaje' },
    },
    {
      // Read-only record of the rental (bike slug) an inquiry referenced.
      // Populated by the /api/contact route from the InquiryCta submission;
      // the owner reads it but never edits it (rentals-inquiry-cta seam, R7).
      name: 'rental',
      type: 'text',
      label: { en: 'Rental (bike)', es: 'Renta (bicicleta)' },
      admin: {
        readOnly: true,
        description: {
          en: 'Bike slug this inquiry referenced. Only present for rental inquiries.',
          es: 'Slug de la bicicleta a la que se refiere esta consulta. Solo aparece en consultas de renta.',
        },
      },
    },
    {
      // Read-only, human-readable join of the accessory references submitted
      // with a rental inquiry. Stored as text for admin readability per the
      // resolved design default (no booking-engine coupling).
      name: 'accessories',
      type: 'text',
      label: { en: 'Accessories', es: 'Accesorios' },
      admin: {
        readOnly: true,
        description: {
          en: 'Accessories referenced in this inquiry. Only present for rental inquiries.',
          es: 'Accesorios referidos en esta consulta. Solo aparece en consultas de renta.',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'new',
      label: { en: 'Status', es: 'Estado' },
      options: [
        { label: { en: 'New', es: 'Nuevo' }, value: 'new' },
        { label: { en: 'Read', es: 'Leído' }, value: 'read' },
        { label: { en: 'Replied', es: 'Respondido' }, value: 'replied' },
        { label: { en: 'Archived', es: 'Archivado' }, value: 'archived' },
      ],
      admin: {
        description: {
          en: 'Mark messages as you handle them.',
          es: 'Marca los mensajes a medida que los atiendes.',
        },
      },
    },
  ],
};
