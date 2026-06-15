/**
 * Data migration — legacy per-section globals → the consolidated `landing` global.
 *
 * Copies the live content of the nine legacy globals (hero, marquee, values,
 * about, testimonial, services, faq, team, seasonalFeature) into the matching
 * NAMED tabs of the single `landing` global. The `landing` field definitions
 * are byte-for-byte copies of the legacy ones, so this is a straight value copy
 * — no field remapping.
 *
 * NON-DESTRUCTIVE: the legacy globals are only READ; their data is left intact
 * as the rollback safety net. Re-running is safe (idempotent): each run simply
 * overwrites `landing` with the current legacy content.
 *
 * Localized arrays (hero.stats, values/services/faq/team items) carry localized
 * SUBFIELDS on NON-localized rows, so we use the same 2-pass id-preserving
 * pattern as scripts/seed.ts:
 *   1. Write EN  → Payload creates the array rows and assigns ids.
 *   2. Re-read EN → capture those ids.
 *   3. Write ES  → reuse the ids so localized subfields UPDATE the same rows
 *      instead of duplicating them.
 *
 * Run AFTER deploying the code that registers the `landing` global (so its
 * tables exist), against the SAME database whose legacy globals you want to
 * carry over:
 *
 *   pnpm migrate:landing
 *
 * Verify in /admin → "Landing Page", then load /en and /es.
 */
import 'dotenv/config';

import { getPayload, type Payload } from 'payload';

import config from '../src/payload.config';

type Section = Record<string, unknown>;
type ArrayRow = Record<string, unknown> & { id?: string | null };
type Loc = 'en' | 'es';

// Payload meta keys that must never be written back into a global.
const META_KEYS: readonly string[] = ['id', 'globalType', 'createdAt', 'updatedAt', '_status'];

/** Drop meta keys, keeping only writable content fields. */
function strip(doc: unknown): Section {
  if (!doc || typeof doc !== 'object') return {};
  const out: Section = {};
  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    if (META_KEYS.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

function asRows(value: unknown): ArrayRow[] | undefined {
  return Array.isArray(value) ? (value as ArrayRow[]) : undefined;
}

/**
 * Re-attach the pass-1 (EN) array-row ids onto the pass-2 (ES) rows, matched by
 * index, so Payload UPDATES the existing rows (and only their localized
 * subfields) instead of creating duplicates.
 */
function reattachIds(esValue: unknown, enValue: unknown): ArrayRow[] | undefined {
  const es = asRows(esValue);
  if (!es) return undefined;
  const en = asRows(enValue);
  return es.map((row, i) => {
    const id = en?.[i]?.id;
    return id != null ? { ...row, id } : row;
  });
}

/** Read all nine legacy globals for one locale and map them onto landing tabs. */
async function readSections(payload: Payload, locale: Loc): Promise<Record<string, Section>> {
  const [hero, marquee, values, about, testimonial, services, faq, team, seasonalFeature] =
    await Promise.all([
      payload.findGlobal({ slug: 'hero', locale, depth: 0 }).catch(() => null),
      payload.findGlobal({ slug: 'marquee', locale, depth: 0 }).catch(() => null),
      payload.findGlobal({ slug: 'values', locale, depth: 0 }).catch(() => null),
      payload.findGlobal({ slug: 'about', locale, depth: 0 }).catch(() => null),
      payload.findGlobal({ slug: 'testimonial', locale, depth: 0 }).catch(() => null),
      payload.findGlobal({ slug: 'services', locale, depth: 0 }).catch(() => null),
      payload.findGlobal({ slug: 'faq', locale, depth: 0 }).catch(() => null),
      payload.findGlobal({ slug: 'team', locale, depth: 0 }).catch(() => null),
      payload.findGlobal({ slug: 'seasonalFeature', locale, depth: 0 }).catch(() => null),
    ]);

  return {
    hero: strip(hero),
    marquee: strip(marquee),
    values: strip(values),
    about: strip(about),
    testimonial: strip(testimonial),
    services: strip(services),
    faq: strip(faq),
    team: strip(team),
    // seasonalFeature → the `seasonal` tab (same fields: enabled/eyebrow/featuredSeasonalTour).
    seasonal: strip(seasonalFeature),
  };
}

async function writeLanding(payload: Payload, locale: Loc, data: Record<string, Section>) {
  // The shape is a 1:1 copy of the legacy globals, correct at runtime; the cast
  // satisfies updateGlobal's strict generated data type for `landing`.
  // skipRevalidate: this runs outside a Next request, so the revalidate hook
  // would otherwise throw an Invariant (caught, but noisy in the log).
  return payload.updateGlobal({
    slug: 'landing',
    locale,
    depth: 0,
    data: data as never,
    context: { skipRevalidate: true },
  });
}

async function main(): Promise<void> {
  const payload = await getPayload({ config });

  // ── Pass 1: English (creates array rows + sets non-localized values) ──
  console.log('[migrate:landing] Reading legacy globals (en)…');
  const en = await readSections(payload, 'en');
  await writeLanding(payload, 'en', en);
  console.log('[migrate:landing] Wrote landing (en).');

  // Capture the ids Payload just assigned to the new array rows.
  const landingEn = strip(
    await payload.findGlobal({ slug: 'landing', locale: 'en', depth: 0 })
  );
  const enHero = landingEn.hero as Section | undefined;
  const enValues = landingEn.values as Section | undefined;
  const enServices = landingEn.services as Section | undefined;
  const enFaq = landingEn.faq as Section | undefined;
  const enTeam = landingEn.team as Section | undefined;

  // ── Pass 2: Spanish (updates localized subfields on the SAME rows) ──
  console.log('[migrate:landing] Reading legacy globals (es)…');
  const es = await readSections(payload, 'es');
  es.hero.stats = reattachIds(es.hero.stats, enHero?.stats) ?? es.hero.stats;
  es.values.items = reattachIds(es.values.items, enValues?.items) ?? es.values.items;
  es.services.items = reattachIds(es.services.items, enServices?.items) ?? es.services.items;
  es.faq.items = reattachIds(es.faq.items, enFaq?.items) ?? es.faq.items;
  es.team.items = reattachIds(es.team.items, enTeam?.items) ?? es.team.items;
  await writeLanding(payload, 'es', es);
  console.log('[migrate:landing] Wrote landing (es).');

  console.log(
    '[migrate:landing] Done. Verify in /admin → "Landing Page", then load /en and /es.'
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate:landing] Failed:', err);
  process.exit(1);
});
