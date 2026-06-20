/**
 * Content seed — Tours + 5 globals from the legacy `data.js`.
 *
 * Idempotent:
 *   - Tours: skip if a tour with the same slug already exists (logs "skip").
 *   - Globals: upsert with `updateGlobal` (last seed wins — fine, the content
 *     is static and version-controlled in `data.js`).
 *
 * Tours are created as DRAFTS (`_status: 'draft'`) because `heroImage` is
 * required for publish and we don't seed real images. The client uploads each
 * tour's photo in /admin and publishes from there.
 *
 * `data.js` is a browser-style script (assigns to `window.I18N` / `window.TOURS`).
 * We read it as a string and evaluate it in a `vm` sandbox with a fake `window`
 * to avoid polluting the Node global. This keeps `data.js` untouched (legacy
 * cleanup happens in PR 6).
 *
 * Run: `pnpm seed` (after `pnpm seed:admin`).
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

import { getPayload } from 'payload';

import config from '../src/payload.config';

const filename = fileURLToPath(import.meta.url);
const here = dirname(filename);

// ---- Types matching the legacy data.js shape ----

type Locale = 'en' | 'es';

interface I18nNav {
  tours: string;
  about: string;
  services: string;
  journal: string;
  book: string;
}

interface I18nHero {
  eyebrow: string;
  h1a: string;
  h1b: string;
  h1c: string;
  h1d: string;
  lede: string;
  ctaPrimary: string;
  ctaGhost: string;
}

interface I18nFooter {
  tease: string;
  teaseEm: string;
  cta: string;
  colTour: string;
  colCompany: string;
  colHelp: string;
  copyright: string;
  address: string;
}

interface I18nDetail {
  groupVal: string;
  langVal: string;
  levelVal: string;
  meetVal: string;
  aboutP1: string;
  aboutP2: string;
  meetText: string;
  itin: Array<{ t: string; h: string; d: string }>;
  includes: string[];
}

interface I18nBlock {
  nav: I18nNav;
  hero: I18nHero;
  footer: I18nFooter;
  detail: I18nDetail;
}

type I18N = Record<Locale, I18nBlock>;

interface RawTour {
  id: string;
  cat: 'ebike' | 'walking' | 'daytrip' | 'food';
  duration: string;
  distance: string;
  price: number;
  tagEN: string | null;
  tagES: string | null;
  tagColor: string;
  photo: string;
  photoTone: string;
  titleEN: string;
  titleES: string;
  descEN: string;
  descES: string;
}

// ---- Load legacy data.js via vm sandbox ----

function loadLegacyData(): { I18N: I18N; TOURS: RawTour[] } | null {
  // `data.js` was the original (browser-style) content source. It has since
  // been removed during legacy cleanup; the live content now lives in the DB
  // (globals) and in `messages/*.json` (content globals). When it's absent we
  // skip the legacy seed entirely and only (re)seed the content globals.
  const dataPath = resolve(here, '..', 'data.js');
  if (!existsSync(dataPath)) {
    console.log('[seed] data.js not found — skipping legacy tours/globals seed.');
    return null;
  }
  const source = readFileSync(dataPath, 'utf8');

  const sandbox: { window: { I18N?: I18N; TOURS?: RawTour[] } } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'data.js' });

  if (!sandbox.window.I18N || !sandbox.window.TOURS) {
    throw new Error('[seed] data.js did not assign window.I18N and window.TOURS as expected.');
  }
  return { I18N: sandbox.window.I18N, TOURS: sandbox.window.TOURS };
}

// ---- Load next-intl message bundles (source for the content globals) ----

interface HeroStat {
  num: string;
  label: string;
}

interface Messages {
  hero: {
    live: string;
    estLabel: string;
    neighborhoods: string;
    scroll: string;
    stats: {
      routesNum: string;
      routesLbl: string;
      perTourNum: string;
      perTourLbl: string;
      groupNum: string;
      groupLbl: string;
      ratingNum: string;
      ratingLbl: string;
    };
  };
  marquee: string;
  values: {
    eyebrow: string;
    title: string;
    sub: string;
    items: Array<{ t: string; d: string }>;
  };
  editorial: {
    eyebrow: string;
    title: string;
    p1: string;
    p2: string;
    imageLabel: string;
    meetCta: string;
  };
  services: {
    eyebrow: string;
    title: string;
    sub: string;
    inquireCta: string;
    items: Array<{ t: string; d: string }>;
  };
  testimonial: {
    eyebrow: string;
    items: Array<{ quote: string; name: string; loc: string }>;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  footer: {
    address2: string;
    geoLabel: string;
  };
}

function loadMessages(locale: Locale): Messages {
  const msgPath = resolve(here, '..', 'messages', `${locale}.json`);
  return JSON.parse(readFileSync(msgPath, 'utf8')) as Messages;
}

function heroStatsFrom(m: Messages): HeroStat[] {
  const s = m.hero.stats;
  return [
    { num: s.routesNum, label: s.routesLbl },
    { num: s.perTourNum, label: s.perTourLbl },
    { num: s.groupNum, label: s.groupLbl },
    { num: s.ratingNum, label: s.ratingLbl },
  ];
}

// ---- Map tagColor: data.js uses "default" for unset; map to undefined ----

const VALID_TAG_COLORS = new Set(['terra', 'maya', 'profundo', 'crema']);

function normalizeTagColor(raw: string): 'terra' | 'maya' | 'profundo' | 'crema' | undefined {
  return VALID_TAG_COLORS.has(raw) ? (raw as 'terra' | 'maya' | 'profundo' | 'crema') : undefined;
}

function normalizeDistance(raw: string): string | undefined {
  // data.js uses "—" as "no distance"; map to undefined so the field stays empty.
  if (!raw || raw === '—') return undefined;
  return raw;
}

// ---- Seed: tours ----

async function seedTours(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tours: RawTour[],
  i18n: I18N
): Promise<void> {
  // Only tour with rich detail in data.js is "ebike-classic" (under I18N.<locale>.detail).
  // For other tours we seed empty/short values; the client fills the rest in /admin.
  const detailEN = i18n.en.detail;
  const detailES = i18n.es.detail;

  for (const tour of tours) {
    const existing = await payload.find({
      collection: 'tours',
      where: { slug: { equals: tour.id } },
      limit: 1,
      pagination: false,
      // We want to see drafts too so we don't create duplicates if seed re-runs
      // before publish.
      draft: true,
    });

    if (existing.docs.length > 0) {
      console.log(`[seed] tour "${tour.id}" already exists — skipping.`);
      continue;
    }

    const isFlagship = tour.id === 'ebike-classic';

    // Base (default locale = en) values. Localized fields then get an explicit
    // `update` per locale below.
    const created = await payload.create({
      collection: 'tours',
      locale: 'en',
      draft: true,
      data: {
        slug: tour.id,
        title: tour.titleEN,
        category: tour.cat,
        duration: tour.duration,
        distance: normalizeDistance(tour.distance),
        price: tour.price,
        tag: tour.tagEN ?? undefined,
        tagColor: normalizeTagColor(tour.tagColor),
        shortDescription: tour.descEN,
        photoDescription: tour.photo,
        languages: isFlagship ? detailEN.langVal : 'EN · ES',
        // Detail copy — only the flagship has rich data.js content; others
        // start blank and the client fills them in /admin.
        aboutP1: isFlagship ? detailEN.aboutP1 : undefined,
        aboutP2: isFlagship ? detailEN.aboutP2 : undefined,
        meetingPoint: isFlagship ? detailEN.meetVal : undefined,
        meetingPointText: isFlagship ? detailEN.meetText : undefined,
        groupSize: isFlagship ? detailEN.groupVal : undefined,
        level: isFlagship ? detailEN.levelVal : undefined,
        itinerary: isFlagship
          ? detailEN.itin.map((stop) => ({
              time: stop.t,
              heading: stop.h,
              description: stop.d,
            }))
          : undefined,
        includes: isFlagship ? detailEN.includes.map((text) => ({ text })) : undefined,
        // heroImage intentionally omitted — required for publish, not draft.
        _status: 'draft',
      },
    });

    // Now layer in the Spanish localized values. Non-localized fields
    // (category, price, slug, languages, itinerary[].time...) stay as-is.
    await payload.update({
      collection: 'tours',
      id: created.id,
      locale: 'es',
      draft: true,
      data: {
        title: tour.titleES,
        tag: tour.tagES ?? undefined,
        shortDescription: tour.descES,
        photoDescription: tour.photo, // same hint string in both locales
        aboutP1: isFlagship ? detailES.aboutP1 : undefined,
        aboutP2: isFlagship ? detailES.aboutP2 : undefined,
        meetingPoint: isFlagship ? detailES.meetVal : undefined,
        meetingPointText: isFlagship ? detailES.meetText : undefined,
        groupSize: isFlagship ? detailES.groupVal : undefined,
        level: isFlagship ? detailES.levelVal : undefined,
        itinerary: isFlagship
          ? detailES.itin.map((stop) => ({
              time: stop.t,
              heading: stop.h,
              description: stop.d,
            }))
          : undefined,
        includes: isFlagship ? detailES.includes.map((text) => ({ text })) : undefined,
      },
    });

    console.log(`[seed] tour "${tour.id}" created as draft.`);
  }
}

// ---- Seed: globals ----

async function seedGlobals(
  payload: Awaited<ReturnType<typeof getPayload>>,
  i18n: I18N
): Promise<void> {
  // --- Navigation ---
  // Arrays with localized fields require a 2-pass write: pass 1 creates the
  // rows (Payload assigns each item an `id`), pass 2 updates the same rows
  // by `id` to set the ES labels. Without the `id` on pass 2, Payload would
  // treat them as new items and overwrite the EN data.
  const navEn = await payload.updateGlobal({
    slug: 'navigation',
    locale: 'en',
    data: {
      links: [
        { label: i18n.en.nav.tours, href: 'tours' },
        { label: i18n.en.nav.about, href: 'about' },
        { label: i18n.en.nav.services, href: 'services' },
        { label: i18n.en.nav.journal, href: 'journal' },
        { label: i18n.en.nav.book, href: 'book' },
      ],
      bookCtaLabel: i18n.en.nav.book,
    },
  });
  const navEsLabels = [
    i18n.es.nav.tours,
    i18n.es.nav.about,
    i18n.es.nav.services,
    i18n.es.nav.journal,
    i18n.es.nav.book,
  ];
  await payload.updateGlobal({
    slug: 'navigation',
    locale: 'es',
    data: {
      links: (navEn.links ?? []).map((link, i) => ({
        id: link.id,
        label: navEsLabels[i],
        href: link.href,
      })),
      bookCtaLabel: i18n.es.nav.book,
    },
  });
  console.log('[seed] global "navigation" upserted (en + es).');

  // --- ContactInfo ---
  // `address` is non-localized — only set on the default (en) locale and it
  // applies to both. `addressLabel` is localized.
  await payload.updateGlobal({
    slug: 'contact-info',
    locale: 'en',
    data: {
      whatsapp: '+525555555555',
      email: 'hola@loschillangos.com',
      phone: '',
      address: i18n.en.footer.address,
      addressLabel: 'Studio',
    },
  });
  await payload.updateGlobal({
    slug: 'contact-info',
    locale: 'es',
    data: {
      addressLabel: 'Estudio',
    },
  });
  console.log('[seed] global "contact-info" upserted (en + es).');

  // --- Hero ---
  await payload.updateGlobal({
    slug: 'hero',
    locale: 'en',
    data: {
      eyebrow: i18n.en.hero.eyebrow,
      h1a: i18n.en.hero.h1a,
      h1b: i18n.en.hero.h1b,
      h1c: i18n.en.hero.h1c,
      h1d: i18n.en.hero.h1d,
      lede: i18n.en.hero.lede,
      ctaPrimary: i18n.en.hero.ctaPrimary,
      ctaGhost: i18n.en.hero.ctaGhost,
    },
  });
  await payload.updateGlobal({
    slug: 'hero',
    locale: 'es',
    data: {
      eyebrow: i18n.es.hero.eyebrow,
      h1a: i18n.es.hero.h1a,
      h1b: i18n.es.hero.h1b,
      h1c: i18n.es.hero.h1c,
      h1d: i18n.es.hero.h1d,
      lede: i18n.es.hero.lede,
      ctaPrimary: i18n.es.hero.ctaPrimary,
      ctaGhost: i18n.es.hero.ctaGhost,
    },
  });
  console.log('[seed] global "hero" upserted (en + es).');

  // --- Footer ---
  // Same 2-pass pattern as Navigation (columns[].title and columns[].links[].label
  // are both localized; we must reuse the ids Payload assigns on pass 1).
  const footerEn = await payload.updateGlobal({
    slug: 'footer',
    locale: 'en',
    data: {
      tease: i18n.en.footer.tease,
      teaseEm: i18n.en.footer.teaseEm,
      cta: i18n.en.footer.cta,
      copyright: i18n.en.footer.copyright,
      columns: [
        {
          title: i18n.en.footer.colTour,
          links: [
            { label: 'Classic CDMX e-bike', href: 'tours/ebike-classic' },
            { label: 'Contemporary art ride', href: 'tours/ebike-art' },
            { label: 'Teotihuacán day trip', href: 'tours/teotihuacan' },
          ],
        },
        {
          title: i18n.en.footer.colCompany,
          links: [
            { label: 'About', href: 'about' },
            { label: 'Services', href: 'services' },
            { label: 'Journal', href: 'journal' },
          ],
        },
        {
          title: i18n.en.footer.colHelp,
          links: [
            { label: 'FAQ', href: '#faq' },
            { label: 'Cancellation', href: '#faq' },
            { label: 'Contact', href: 'book' },
          ],
        },
      ],
    },
  });

  const esColumnTitles = [
    i18n.es.footer.colTour,
    i18n.es.footer.colCompany,
    i18n.es.footer.colHelp,
  ];
  const esColumnLinks: Array<Array<string>> = [
    ['CDMX clásica en bici', 'Arte contemporáneo', 'Excursión a Teotihuacán'],
    ['Nosotros', 'Servicios', 'Diario'],
    ['FAQ', 'Cancelación', 'Contacto'],
  ];
  await payload.updateGlobal({
    slug: 'footer',
    locale: 'es',
    data: {
      tease: i18n.es.footer.tease,
      teaseEm: i18n.es.footer.teaseEm,
      cta: i18n.es.footer.cta,
      copyright: i18n.es.footer.copyright,
      columns: (footerEn.columns ?? []).map((col, colIdx) => ({
        id: col.id,
        title: esColumnTitles[colIdx],
        links: (col.links ?? []).map((link, linkIdx) => ({
          id: link.id,
          label: esColumnLinks[colIdx][linkIdx],
          href: link.href,
        })),
      })),
    },
  });
  console.log('[seed] global "footer" upserted (en + es).');

  // --- SocialLinks (placeholders) ---
  await payload.updateGlobal({
    slug: 'social-links',
    data: {
      instagram: '',
      tiktok: '',
      youtube: '',
      facebook: '',
    },
  });
  console.log('[seed] global "social-links" upserted (placeholders).');
}

// ---- Seed: content globals (sourced from messages/*.json) ----
//
// These globals were migrated out of the next-intl JSON so the owner can edit
// every homepage section from /admin. They do NOT depend on the legacy
// `data.js`, so they always seed (even after legacy cleanup). All writes are
// partial upserts — fields not listed here (e.g. uploaded images) are kept.

async function seedContentGlobals(
  payload: Awaited<ReturnType<typeof getPayload>>,
  msgEn: Messages,
  msgEs: Messages
): Promise<void> {
  // --- Hero (new fields only; legacy text seeded in seedGlobals or already in DB) ---
  // `stats` is an array with a localized `label` + non-localized `num`, so it
  // needs the 2-pass id-preserving pattern.
  const heroEn = await payload.updateGlobal({
    slug: 'hero',
    locale: 'en',
    data: {
      live: msgEn.hero.live,
      estLabel: msgEn.hero.estLabel,
      neighborhoods: msgEn.hero.neighborhoods,
      scroll: msgEn.hero.scroll,
      stats: heroStatsFrom(msgEn),
    },
  });
  const heroEsStats = heroStatsFrom(msgEs);
  await payload.updateGlobal({
    slug: 'hero',
    locale: 'es',
    data: {
      live: msgEs.hero.live,
      estLabel: msgEs.hero.estLabel,
      neighborhoods: msgEs.hero.neighborhoods,
      scroll: msgEs.hero.scroll,
      stats: (heroEn.stats ?? []).map((stat, i) => ({
        id: stat.id,
        num: stat.num,
        label: heroEsStats[i]?.label,
      })),
    },
  });
  console.log('[seed] global "hero" content fields upserted (en + es).');

  // --- Marquee ---
  await payload.updateGlobal({ slug: 'marquee', locale: 'en', data: { text: msgEn.marquee } });
  await payload.updateGlobal({ slug: 'marquee', locale: 'es', data: { text: msgEs.marquee } });
  console.log('[seed] global "marquee" upserted (en + es).');

  // --- Values ---
  const valuesEn = await payload.updateGlobal({
    slug: 'values',
    locale: 'en',
    data: {
      eyebrow: msgEn.values.eyebrow,
      title: msgEn.values.title,
      sub: msgEn.values.sub,
      items: msgEn.values.items.map((it) => ({ title: it.t, description: it.d })),
    },
  });
  await payload.updateGlobal({
    slug: 'values',
    locale: 'es',
    data: {
      eyebrow: msgEs.values.eyebrow,
      title: msgEs.values.title,
      sub: msgEs.values.sub,
      items: (valuesEn.items ?? []).map((it, i) => ({
        id: it.id,
        title: msgEs.values.items[i]?.t,
        description: msgEs.values.items[i]?.d,
      })),
    },
  });
  console.log('[seed] global "values" upserted (en + es).');

  // --- About (editorial) ---
  await payload.updateGlobal({
    slug: 'about',
    locale: 'en',
    data: {
      eyebrow: msgEn.editorial.eyebrow,
      title: msgEn.editorial.title,
      p1: msgEn.editorial.p1,
      p2: msgEn.editorial.p2,
      meetCta: msgEn.editorial.meetCta,
      imageLabel: msgEn.editorial.imageLabel,
    },
  });
  await payload.updateGlobal({
    slug: 'about',
    locale: 'es',
    data: {
      eyebrow: msgEs.editorial.eyebrow,
      title: msgEs.editorial.title,
      p1: msgEs.editorial.p1,
      p2: msgEs.editorial.p2,
      meetCta: msgEs.editorial.meetCta,
      imageLabel: msgEs.editorial.imageLabel,
    },
  });
  console.log('[seed] global "about" upserted (en + es).');

  // --- Testimonial ---
  // `name` is non-localized; set it on en (applies to both). quote/loc localized.
  const testimonialEn = await payload.updateGlobal({
    slug: 'testimonial',
    locale: 'en',
    data: {
      eyebrow: msgEn.testimonial.eyebrow,
      items: msgEn.testimonial.items.map((it) => ({
        quote: it.quote,
        name: it.name,
        loc: it.loc,
      })),
    },
  });
  await payload.updateGlobal({
    slug: 'testimonial',
    locale: 'es',
    data: {
      eyebrow: msgEs.testimonial.eyebrow,
      items: (testimonialEn.items ?? []).map((it, i) => ({
        id: it.id,
        quote: msgEs.testimonial.items[i]?.quote,
        loc: msgEs.testimonial.items[i]?.loc,
      })),
    },
  });
  console.log('[seed] global "testimonial" upserted (en + es).');

  // --- Services ---
  const servicesEn = await payload.updateGlobal({
    slug: 'services',
    locale: 'en',
    data: {
      eyebrow: msgEn.services.eyebrow,
      title: msgEn.services.title,
      sub: msgEn.services.sub,
      inquireCta: msgEn.services.inquireCta,
      items: msgEn.services.items.map((it) => ({ title: it.t, description: it.d })),
    },
  });
  await payload.updateGlobal({
    slug: 'services',
    locale: 'es',
    data: {
      eyebrow: msgEs.services.eyebrow,
      title: msgEs.services.title,
      sub: msgEs.services.sub,
      inquireCta: msgEs.services.inquireCta,
      items: (servicesEn.items ?? []).map((it, i) => ({
        id: it.id,
        title: msgEs.services.items[i]?.t,
        description: msgEs.services.items[i]?.d,
      })),
    },
  });
  console.log('[seed] global "services" upserted (en + es).');

  // --- Faq ---
  const faqEn = await payload.updateGlobal({
    slug: 'faq',
    locale: 'en',
    data: {
      eyebrow: msgEn.faq.eyebrow,
      title: msgEn.faq.title,
      items: msgEn.faq.items.map((it) => ({ question: it.q, answer: it.a })),
    },
  });
  await payload.updateGlobal({
    slug: 'faq',
    locale: 'es',
    data: {
      eyebrow: msgEs.faq.eyebrow,
      title: msgEs.faq.title,
      items: (faqEn.items ?? []).map((it, i) => ({
        id: it.id,
        question: msgEs.faq.items[i]?.q,
        answer: msgEs.faq.items[i]?.a,
      })),
    },
  });
  console.log('[seed] global "faq" upserted (en + es).');

  // --- ContactInfo.address2 (partial upsert; non-localized) ---
  await payload.updateGlobal({
    slug: 'contact-info',
    locale: 'en',
    data: { address2: msgEn.footer.address2 },
  });
  console.log('[seed] global "contact-info" address2 upserted.');

  // --- Footer.geoLabel (partial upsert; non-localized) ---
  await payload.updateGlobal({
    slug: 'footer',
    locale: 'en',
    data: { geoLabel: msgEn.footer.geoLabel },
  });
  console.log('[seed] global "footer" geoLabel upserted.');
}

// ---- Main ----

async function main(): Promise<void> {
  const legacy = loadLegacyData();
  const msgEn = loadMessages('en');
  const msgEs = loadMessages('es');
  const payload = await getPayload({ config });

  if (legacy) {
    console.log('[seed] Seeding legacy globals…');
    await seedGlobals(payload, legacy.I18N);

    console.log('[seed] Seeding tours…');
    await seedTours(payload, legacy.TOURS, legacy.I18N);
  }

  console.log('[seed] Seeding content globals (homepage sections)…');
  await seedContentGlobals(payload, msgEn, msgEs);

  console.log('[seed] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
