/**
 * Seasonal seed — "La Noche que Nadie Duerme" (The Night Nobody Sleeps).
 *
 * Creates ONE seasonal tour for the Feria de Huamantla (Huamantla, Tlaxcala),
 * the night of Aug 14→15 when the town covers ~18 km of streets in sawdust-and-
 * flower carpets and processes the Virgen de la Caridad at midnight. Facts are
 * sourced from Wikipedia and kept deliberately conservative — no embellishment
 * beyond the verified record. The Huamantlada (running of the bulls) is a
 * DIFFERENT day of the fair and is intentionally NOT referenced here.
 *
 * Patterns mirror `scripts/seed.ts`:
 *   - `import 'dotenv/config'`, `getPayload({ config })`.
 *   - Idempotent: skip if a tour with this slug already exists (drafts included).
 *   - 2-pass write: create(en) then update(es) for localized fields; localized
 *     arrays (storytelling, includes) reuse the ids Payload assigns on pass 1.
 *   - Created as DRAFT: no heroImage / seasonalHero.image is uploaded, so the
 *     owner uploads imagery and publishes from /admin. The seed must NOT
 *     reference media ids that don't exist.
 *   - The seasonalFeature global is pointed at this tour (enabled + eyebrow) so
 *     the landing highlight surfaces it once the owner publishes — guarded so a
 *     re-run never breaks (we resolve the id whether the tour was just created
 *     or already existed).
 *
 * Run: `pnpm seed:seasonal`
 */
import 'dotenv/config';

import { getPayload } from 'payload';

import config from '../src/payload.config';

const SLUG = 'noche-que-nadie-duerme';

// Localized storytelling blocks. NO image — none is uploaded yet; the owner
// adds imagery in /admin. Three blocks: (1) origin/tradition & the Virgin,
// (2) the 18 km of sawdust-and-flower carpets as ephemeral art, (3) the
// midnight procession and the all-night vigil until dawn.
const STORYTELLING_EN = [
  {
    heading: 'A century-old vow to the Virgin of Caridad',
    body: 'Every August, the Pueblo Mágico of Huamantla, in Tlaxcala, honors the Virgen de la Caridad with the Feria de Huamantla. For more than a hundred years the town has kept the same promise: on the night of the 14th, nobody sleeps. What began as devotion has grown into one of Mexico\u2019s most singular celebrations.',
  },
  {
    heading: 'Eighteen kilometers of carpets made of sawdust and flowers',
    body: 'Through the night, families and neighbors lay down roughly 18 km of \u201Ctapetes\u201D \u2014 carpets of dyed sawdust, flowers and seeds, drawn by hand directly onto the streets. The craft was declared Intangible Cultural Heritage of Mexico in 2023. Each design lives only for hours: ephemeral art made to be walked over and then gone.',
  },
  {
    heading: 'Midnight procession, then a vigil until dawn',
    body: 'At midnight the image of the Virgin is carried in procession over the carpets, and the whole town keeps watch. The streets stay awake \u2014 lit, fragrant, and full \u2014 until the first light of the 15th. It is a night you stay up for on purpose, shoulder to shoulder with a town that refuses to sleep.',
  },
];

const STORYTELLING_ES = [
  {
    heading: 'Una promesa centenaria a la Virgen de la Caridad',
    body: 'Cada agosto, el Pueblo Mágico de Huamantla, en Tlaxcala, honra a la Virgen de la Caridad con la Feria de Huamantla. Desde hace más de cien años el pueblo mantiene la misma promesa: la noche del 14, nadie duerme. Lo que empezó como devoción se volvió una de las celebraciones más singulares de México.',
  },
  {
    heading: 'Dieciocho kilómetros de tapetes de aserrín y flores',
    body: 'Durante toda la noche, familias y vecinos tienden cerca de 18 km de tapetes \u2014 alfombras de aserrín teñido, flores y semillas, dibujadas a mano sobre las calles. El oficio fue declarado Patrimonio Cultural Inmaterial de México en 2023. Cada diseño dura solo unas horas: arte efímero hecho para ser pisado y luego desaparecer.',
  },
  {
    heading: 'Procesión a medianoche y vigilia hasta el amanecer',
    body: 'A la medianoche la imagen de la Virgen recorre en procesión los tapetes, y el pueblo entero vela. Las calles siguen despiertas \u2014 iluminadas, perfumadas y llenas \u2014 hasta la primera luz del 15. Es una noche que se desvela a propósito, hombro con hombro con un pueblo que se niega a dormir.',
  },
];

// Localized "includes" — what the booking covers.
const INCLUDES_EN = [
  { text: 'Round-trip transport from CDMX (overnight)' },
  { text: 'Local guide for the Feria de Huamantla' },
  { text: 'Vantage points along the carpet route' },
  { text: 'Accompaniment through the midnight procession' },
];

const INCLUDES_ES = [
  { text: 'Transporte redondo desde CDMX (durante la noche)' },
  { text: 'Guía local para la Feria de Huamantla' },
  { text: 'Puntos de observación a lo largo de la ruta de tapetes' },
  { text: 'Acompañamiento durante la procesión de medianoche' },
];

async function main(): Promise<void> {
  const payload = await getPayload({ config });

  // --- Idempotency: skip the tour create if the slug already exists ---
  // `draft: true` so we also match an unpublished prior seed and avoid dupes.
  const existing = await payload.find({
    collection: 'tours',
    where: { slug: { equals: SLUG } },
    limit: 1,
    pagination: false,
    draft: true,
  });

  let tourId: number;

  if (existing.docs.length > 0) {
    tourId = existing.docs[0].id;
    console.log(`[seed:seasonal] tour "${SLUG}" already exists (id ${tourId}) — skipping create.`);
  } else {
    // Pass 1 — create with the default (en) locale. Non-localized fields are
    // set once here; localized fields get their ES values in pass 2.
    const created = await payload.create({
      collection: 'tours',
      locale: 'en',
      draft: true,
      data: {
        slug: SLUG,
        title: 'The Night Nobody Sleeps',
        category: 'daytrip', // out-of-CDMX trip; best-fit existing enum value.
        duration: '16h', // overnight CDMX round trip.
        price: 89,
        shortDescription:
          'Huamantla stays awake: 18 km of sawdust-and-flower carpets and a midnight procession for the Virgin.',
        languages: 'EN · ES',
        groupSize: 'Up to 14',
        meetingPoint: 'CDMX — pickup point TBD',
        // SEASONAL TOURS ARE WINDOW-DRIVEN, NOT WEEKDAY-DRIVEN.
        // For seasonal tours, bookable dates come from `seasonal.seasonWindow`
        // (see `isDateBookableForTour` in src/lib/booking/availability.ts), so
        // `availableDays` is IRRELEVANT here. We set it to [] to make that
        // explicit: leaving ['5'] (Friday) historically caused the calendar to
        // open EVERY Friday of the year for this single-night Aug-14 event.
        availableDays: [],
        timeSlots: [{ time: '18:00', capacity: 14 }],
        includes: INCLUDES_EN,
        isSeasonal: true,
        seasonal: {
          eventDate: '2026-08-14',
          seasonWindow: { start: '2026-08-14', end: '2026-08-15' },
          // mediaType 'image', but NO image id — none is uploaded yet. The
          // owner adds the seasonal hero in /admin before publishing.
          seasonalHero: { mediaType: 'image' },
          eventLocation: 'Huamantla, Tlaxcala',
          tagline: 'The night an entire town refuses to sleep.',
          storytelling: STORYTELLING_EN,
        },
        // DRAFT: no heroImage and no seasonalHero.image are uploaded. The owner
        // uploads imagery and publishes from /admin. Matches scripts/seed.ts.
        _status: 'draft',
      },
    });
    tourId = created.id;

    // Pass 2 — layer in the Spanish localized values. Localized arrays
    // (storytelling, includes) reuse the ids Payload assigned in pass 1 so the
    // rows are UPDATED rather than overwritten as new items.
    await payload.update({
      collection: 'tours',
      id: tourId,
      locale: 'es',
      draft: true,
      data: {
        title: 'La Noche que Nadie Duerme',
        shortDescription:
          'Huamantla se desvela: 18 km de tapetes de aserrín y flores y una procesión de medianoche para la Virgen.',
        groupSize: 'Hasta 14',
        meetingPoint: 'CDMX — punto de encuentro por confirmar',
        includes: (created.includes ?? []).map((item, i) => ({
          id: item.id,
          text: INCLUDES_ES[i]?.text ?? item.text,
        })),
        seasonal: {
          eventLocation: 'Huamantla, Tlaxcala',
          tagline: 'La noche en que un pueblo entero se niega a dormir.',
          storytelling: (created.seasonal?.storytelling ?? []).map((block, i) => ({
            id: block.id,
            heading: STORYTELLING_ES[i]?.heading ?? block.heading,
            body: STORYTELLING_ES[i]?.body ?? block.body,
          })),
        },
      },
    });

    console.log(`[seed:seasonal] tour "${SLUG}" created as draft (id ${tourId}).`);
  }

  // --- Point the seasonalFeature global at this tour ---
  // Guarded: runs whether the tour was just created or already existed, so a
  // re-run is safe. The highlight only renders once the tour is PUBLISHED (the
  // landing query enforces _status: published + isSeasonal), so enabling here
  // never surfaces a draft — it just pre-wires the pointer for the owner.
  await payload.updateGlobal({
    slug: 'seasonalFeature',
    locale: 'en',
    data: {
      enabled: true,
      eyebrow: 'Seasonal event',
      featuredSeasonalTour: tourId,
    },
  });
  await payload.updateGlobal({
    slug: 'seasonalFeature',
    locale: 'es',
    data: { eyebrow: 'Evento de temporada' },
  });
  console.log(`[seed:seasonal] seasonalFeature → tour ${tourId} (enabled, en + es eyebrow).`);

  console.log('[seed:seasonal] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed:seasonal] Failed:', err);
  process.exit(1);
});
