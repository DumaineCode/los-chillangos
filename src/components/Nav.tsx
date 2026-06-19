'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import { Link } from '../../i18n/navigation';
import { buildWhatsAppLink, formatWhatsAppDisplay } from '../lib/contact/whatsapp';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

type NavLink = {
  label: string;
  href: string;
};

type Props = {
  links: NavLink[];
  /**
   * Logo image resolved from the `Branding` global. When undefined the Logo
   * component falls back to the bundled brand PNG. The same image is used
   * regardless of scroll position — there is no over-hero logo swap.
   */
  logoSrc?: string | null;
  logoAlt?: string;
  logoHeight?: number;
  /**
   * When true (the home page), the nav switches into "over hero" mode on
   * initial render and toggles back once the user scrolls past the cinematic
   * hero. On other pages this stays false and the nav uses its default light
   * background.
   */
  overHero?: boolean;
  /**
   * WhatsApp number in E.164-ish format from the `ContactInfo` global. When
   * present, the header shows a click-to-chat button with the number visible.
   * The link and the displayed number are both derived from this single value.
   */
  whatsapp?: string | null;
  /** Optional Instagram URL/handle shown in the mobile menu footer. */
  instagram?: string | null;
};

/**
 * Top navigation.
 *
 * Marked `'use client'` because we need a scroll listener to mirror the
 * legacy `over-hero` chrome change. Nav data (labels) is fetched server-side
 * and passed in as props by the locale layout — that keeps the Payload Local
 * API call on the server and the bundle minimal.
 */
export function Nav({
  links,
  logoSrc,
  logoAlt,
  logoHeight = 40,
  overHero = false,
  whatsapp,
  instagram,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const whatsappLink = buildWhatsAppLink(whatsapp);
  const whatsappDisplay = formatWhatsAppDisplay(whatsapp);

  // Close the mobile menu on Escape and lock body scroll while it's open.
  // Also close it if the viewport grows past the mobile breakpoint, otherwise
  // the overlay + burger hide via CSS but `menuOpen` stays true, leaving the
  // body scroll-locked with no visible way to close it.
  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 901px)');
    const onDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!overHero) return;

    const navEl = document.querySelector('.nav');
    if (!navEl) return;

    const heroEl = document.querySelector('.hero-cine');

    const apply = () => {
      if (!heroEl) {
        navEl.classList.remove('over-hero');
        return;
      }
      const heroBottom = heroEl.getBoundingClientRect().bottom;
      if (heroBottom > 96) navEl.classList.add('over-hero');
      else navEl.classList.remove('over-hero');
    };

    apply();
    const raf = requestAnimationFrame(apply);
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      navEl.classList.remove('over-hero');
    };
  }, [overHero]);

  return (
    <>
    <nav className={menuOpen ? 'nav nav-menu-open' : 'nav'}>
      <div className="container nav-inner">
        <Link
          href="/"
          className="logo"
          aria-label="Los Chillangos — home"
          onClick={() => setMenuOpen(false)}
        >
          <Logo src={logoSrc} alt={logoAlt} height={logoHeight} />
        </Link>
        <div className="nav-links">
          {links.map((link, i) => (
            <Link key={`${link.href}-${i}`} href={normalizeHref(link.href)}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="nav-right">
          {whatsappLink && (
            <a
              href={whatsappLink}
              className="nav-whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp ${whatsappDisplay}`}
            >
              <svg
                className="nav-whatsapp-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.82 9.82 0 0 0 1.523 5.273l-.999 3.648 3.965-1.04zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span className="nav-whatsapp-number">{whatsappDisplay}</span>
            </a>
          )}
          <ThemeToggle />
          <LocaleSwitcher />
          <button
            type="button"
            className="nav-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="nav-burger-bar" />
            <span className="nav-burger-bar" />
            <span className="nav-burger-bar" />
          </button>
        </div>
      </div>
    </nav>

      <div
        id="mobile-menu"
        className="nav-overlay"
        hidden={!menuOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="container nav-overlay-inner">
          <nav className="nav-overlay-links">
            {links.map((link, i) => (
              <Link
                key={`mobile-${link.href}-${i}`}
                href={normalizeHref(link.href)}
                onClick={() => setMenuOpen(false)}
                style={{ '--i': i } as CSSProperties}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {(whatsappLink || instagram) && (
            <div className="nav-overlay-footer">
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-overlay-whatsapp"
                  aria-label={`WhatsApp ${whatsappDisplay}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <svg
                    className="nav-overlay-whatsapp-icon"
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="currentColor"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.82 9.82 0 0 0 1.523 5.273l-.999 3.648 3.965-1.04zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                  <span>{whatsappDisplay}</span>
                </a>
              )}
              {instagram && (
                <a
                  href={
                    instagram.startsWith('http')
                      ? instagram
                      : `https://instagram.com/${instagram.replace(/^@/, '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-overlay-social"
                >
                  Instagram
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Payload `Navigation.links[].href` stores short keys like `"tours"` or full
 * paths like `"/tours"`. Anchor links like `"#about"` stay as-is. We coerce
 * everything else to a leading slash so next-intl's `Link` can prefix the
 * locale.
 */
function normalizeHref(href: string): string {
  if (!href) return '/';
  if (href.startsWith('#')) return href;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return href;
  return `/${href}`;
}
