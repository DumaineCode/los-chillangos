import type { CollectionConfig } from 'payload';

import { revalidateExtrasAfterChange, revalidateExtrasAfterDelete } from '../hooks/revalidateExtras';
import { populateExtraTitle } from './extrasTitle';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Extras collection — global, reusable booking add-ons.
 *
 * An "extra" is an optional service a customer can add to a booking (e.g. a
 * private departure, an airport transfer). Extras are defined ONCE here and
 * assigned per tour via the `extras` relationship on Tours. The price is
 * GLOBAL — there is intentionally no per-tour override (locked decision): an
 * extra costs the same everywhere it is offered.
 *
 * Pricing model:
 *   - `price`: whole-dollar USD amount (min 0).
 *   - `priceType`:
 *       * `total`     → flat: charged once per booking regardless of headcount.
 *       * `perPerson` → charged × (adults + teens).
 *     The actual math lives in `src/lib/booking/pricing.ts` (`extrasAmount`) and
 *     is applied identically by the wizard preview and the persisted snapshot.
 *
 * Localization:
 *   - `name` and `disclaimer` are `localized: true` (client authors en/es).
 *
 * Access:
 *   - Public read so RSC tour pages can resolve assigned extras.
 *   - Create/update/delete require an authenticated admin.
 *
 * Revalidation:
 *   - afterChange/afterDelete invalidate the `tours` cache tag because an
 *     extra's copy/price appears on every tour that references it.
 */
export const Extras: CollectionConfig = {
  slug: 'extras',
  labels: {
    singular: { en: 'Extra', es: 'Extra' },
    plural: { en: 'Extras', es: 'Extras' },
  },
  admin: {
    // `useAsTitle` points at the NON-localized `title` field, NOT the localized
    // `name`. A localized title is resolved per-locale when Payload builds
    // relationship options, which made each extra appear twice (es + en) in the
    // Tours → extras `hasMany` dropdown. `title` holds one value per row, so the
    // dropdown lists each extra exactly once. See `./extrasTitle.ts`.
    useAsTitle: 'title',
    group: NAV_GROUPS.site,
    defaultColumns: ['name', 'price', 'priceType', 'active', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidateExtrasAfterChange],
    afterDelete: [revalidateExtrasAfterDelete],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
      label: { en: 'Name', es: 'Nombre' },
      admin: {
        description: {
          en: 'Customer-facing name of the extra (e.g. "Private tour").',
          es: 'Nombre del extra que ve el cliente (ej.: "Tour privado").',
        },
      },
    },
    {
      // NON-localized admin display title, derived from the localized `name`.
      // This is the field `admin.useAsTitle` reads so the Tours → extras
      // relationship dropdown lists each extra ONCE instead of once per locale.
      // Additive + non-destructive: `name` stays localized/required and remains
      // the customer-facing value. Populated on every write via the
      // `beforeChange` hook in `./extrasTitle.ts`.
      name: 'title',
      type: 'text',
      hooks: {
        beforeChange: [populateExtraTitle],
      },
      admin: {
        hidden: true,
        readOnly: true,
        disableListColumn: true,
      },
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      label: { en: 'Price (MXN)', es: 'Precio (MXN)' },
      admin: {
        description: {
          en: 'Whole-peso MXN price. Global — applies to every tour that offers this extra.',
          es: 'Precio en MXN (pesos enteros). Global — aplica a todos los tours que ofrecen este extra.',
        },
      },
    },
    {
      name: 'priceType',
      type: 'select',
      required: true,
      defaultValue: 'total',
      label: { en: 'Price type', es: 'Tipo de precio' },
      options: [
        { label: { en: 'Flat (once per booking)', es: 'Fijo (una vez por reserva)' }, value: 'total' },
        { label: { en: 'Per person', es: 'Por persona' }, value: 'perPerson' },
      ],
      admin: {
        description: {
          en: 'Flat = charged once regardless of headcount. Per person = price × (adults + teens).',
          es: 'Fijo = se cobra una sola vez sin importar el número de personas. Por persona = precio × (adultos + adolescentes).',
        },
      },
    },
    {
      name: 'disclaimer',
      type: 'textarea',
      localized: true,
      label: { en: 'Disclaimer', es: 'Aclaración' },
      admin: {
        description: {
          en: 'Fine print shown in the ⓘ tooltip next to the extra on the tour page.',
          es: 'Texto aclaratorio que aparece en el tooltip ⓘ junto al extra en la página del tour.',
        },
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: { en: 'Active', es: 'Activo' },
      admin: {
        description: {
          en: 'Only active extras are offered in the booking wizard.',
          es: 'Solo los extras activos se ofrecen en el flujo de reserva.',
        },
      },
    },
  ],
};
