import { getTranslations } from 'next-intl/server';

import { Link } from '../../i18n/navigation';
import type { Locale } from '../../i18n/routing';
import { getPayload } from '../lib/payload';
import type { Media } from '../payload-types';
import { Logo } from './Logo';

function resolveMediaUrl(value: number | Media | null | undefined): string | null {
  if (!value || typeof value === 'number') return null;
  return value.url ?? null;
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
  const t = await getTranslations({ locale, namespace: 'footer' });

  const [footer, contact, social, navigation, branding] = await Promise.all([
    payload.findGlobal({ slug: 'footer', locale, fallbackLocale: 'en' }),
    payload.findGlobal({ slug: 'contact-info', locale, fallbackLocale: 'en' }),
    payload.findGlobal({ slug: 'social-links', locale, fallbackLocale: 'en' }),
    payload.findGlobal({ slug: 'navigation', locale, fallbackLocale: 'en' }),
    payload.findGlobal({ slug: 'branding', locale, fallbackLocale: 'en' }).catch(() => null),
  ]);

  const columns = footer?.columns ?? [];
  const ctaLabel = footer?.cta ?? navigation?.bookCtaLabel ?? 'Book a tour';
  // Footer sits on a dark surface: prefer the dark logo, fall back to the
  // primary (light) one, then to the bundled PNG inside <Logo>.
  const footerLogoSrc = resolveMediaUrl(branding?.logoDark) ?? resolveMediaUrl(branding?.logoLight);
  const footerLogoAlt = branding?.logoAltText ?? 'Los Chillangos';

  return (
    <footer className="footer">
      <div className="container">
        <h2 className="footer-headline">
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
              <Logo src={footerLogoSrc} alt={footerLogoAlt} variant="dark" height={56} />
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
              {t('address2')}
              <br />
              {contact?.email}
            </p>
          </div>
          {columns.map((col, ci) => (
            <div key={`col-${ci}`}>
              <h5>{col.title}</h5>
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
            <h5>·</h5>
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
            {t('geoLabel')}
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
