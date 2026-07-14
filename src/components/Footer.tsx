import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Image from 'next/image';

import { Link } from '../../i18n/navigation';
import type { Locale } from '../../i18n/routing';
import { resolveGoogleFont } from '../lib/fonts/googleFont';
import { resolveMediaImage, type ResolvedImage } from '../lib/media';
import { getPayload } from '../lib/payload';
import type { Media } from '../payload-types';
import { Logo } from './Logo';

function resolveMediaUrl(value: number | Media | null | undefined): string | null {
  if (!value || typeof value === 'number') return null;
  return value.url ?? null;
}

/** Interim wall photo bundled with the repo until the owner uploads one. */
const INTERIM_WALL_SRC = '/brand/calle-mural.png';
const INTERIM_WALL_ALT = 'Los Chillangos mural — Calle Chilanga, CDMX';

/**
 * Wall background fallback chain: CMS `backgroundImage` upload → interim
 * bundled mural (only while the asset actually ships in `public/`) → null,
 * which leaves the flat `#000` CSS base — never a broken image.
 */
function resolveFooterWall(cmsImage: ResolvedImage | null): ResolvedImage | null {
  if (cmsImage) return cmsImage;
  // Derive the FS path from the URL constant so the two can never diverge.
  const interimExists = existsSync(join(process.cwd(), 'public', INTERIM_WALL_SRC));
  if (interimExists) {
    return { url: INTERIM_WALL_SRC, objectPosition: '50% 50%', alt: INTERIM_WALL_ALT };
  }
  return null;
}

type Props = {
  locale: Locale;
};

/**
 * Site footer (Server Component).
 *
 * Reads four globals in parallel via Payload Local API:
 *   - footer       — tease, CTA, columns, copyright
 *   - contact-info — address + email + whatsapp
 *   - social-links — instagram / tiktok / youtube / facebook
 *   - navigation   — fallback for the bookCtaLabel
 *
 * Any global that the client hasn't filled in yet renders sensibly empty —
 * we never crash on missing data.
 */
export async function Footer({ locale }: Props) {
  const payload = await getPayload();

  const [footer, contact, social, navigation, branding] = await Promise.all([
    payload.findGlobal({ slug: 'footer', locale, fallbackLocale: 'en' }),
    payload.findGlobal({ slug: 'contact-info', locale, fallbackLocale: 'en' }),
    payload.findGlobal({ slug: 'social-links', locale, fallbackLocale: 'en' }),
    payload.findGlobal({ slug: 'navigation', locale, fallbackLocale: 'en' }),
    payload.findGlobal({ slug: 'branding', locale, fallbackLocale: 'en' }).catch(() => null),
  ]);

  const columns = footer?.columns ?? [];
  const ctaLabel = footer?.cta ?? navigation?.bookCtaLabel ?? 'Book a tour';
  // Use the same logo as the header: the primary (light) logo, falling back
  // to the bundled PNG inside <Logo>.
  const footerLogoSrc = resolveMediaUrl(branding?.logoLight);
  const footerLogoAlt = branding?.logoAltText ?? 'Los Chillangos';
  const wall = resolveFooterWall(resolveMediaImage(footer?.backgroundImage));
  // Optional CMS-chosen Google Font for the tease headline. Footer default is
  // the serif face at clamp(48px, 7vw, 112px), so mirror that ramp + fallback.
  const headlineFont = resolveGoogleFont(footer?.headingFont, {
    sizeRamp: { floorPx: 48, vw: 7 },
    fallbackVar: '--serif',
  });

  return (
    <footer className="footer">
      {wall ? (
        <>
          <Image
            className="footer-wall"
            src={wall.url}
            alt={wall.alt}
            fill
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: wall.objectPosition }}
          />
          <div className="footer-overlay" aria-hidden="true" />
        </>
      ) : null}
      <div className="container">
        {/* Runtime Google Font load for the tease headline. React hoists
            this stylesheet <link> into <head>; only when a custom family was
            picked in the admin. */}
        {headlineFont.linkHref ? <link rel="stylesheet" href={headlineFont.linkHref} /> : null}
        <h2 className="footer-headline" style={headlineFont.style}>
          {footer?.tease}
          <br />
          <em>{footer?.teaseEm}</em>
        </h2>
        <Link href="/book" className="btn btn-terra btn-lg">
          {ctaLabel} →
        </Link>
        <div className="footer-grid">
          <div>
            <div className="logo" style={{ marginBottom: 16 }}>
              <Logo src={footerLogoSrc} alt={footerLogoAlt} variant="light" height={56} />
            </div>
            <p
              style={{
                fontSize: 14,
                color: '#ffffffAA',
                maxWidth: 320,
                lineHeight: 1.5,
              }}
            >
              {contact?.address}
              <br />
              {contact?.address2}
              <br />
              {contact?.email}
            </p>
          </div>
          {columns.map((col, ci) => (
            <div key={`col-${ci}`}>
              <p className="footer-col-title">{col.title}</p>
              <ul>
                {(col.links ?? []).map((link, li) => (
                  <li key={`col-${ci}-link-${li}`}>
                    <Link href={normalizeHref(link.href)}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="footer-col-title" aria-hidden="true">·</p>
            <ul>
              {contact?.email ? (
                <li>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
              ) : null}
              {contact?.whatsapp ? (
                <li>
                  <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}>WhatsApp</a>
                </li>
              ) : null}
              {social?.instagram ? (
                <li>
                  <a href={social.instagram}>Instagram</a>
                </li>
              ) : null}
              {social?.tiktok ? (
                <li>
                  <a href={social.tiktok}>TikTok</a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: '#ffffff88',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {footer?.copyright}
          </span>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: '#ffffff88',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {footer?.geoLabel}
          </span>
        </div>
      </div>
    </footer>
  );
}

function normalizeHref(href: string): string {
  if (!href) return '/';
  if (href.startsWith('#')) return href;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return href;
  return `/${href}`;
}
