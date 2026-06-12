'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import { Link } from '../../i18n/navigation';
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
  /** Optional contact shown in the full-screen mobile menu footer. */
  email?: string | null;
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
  email,
  instagram,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

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
          {(email || instagram) && (
            <div className="nav-overlay-footer">
              {email && (
                <a href={`mailto:${email}`} className="nav-overlay-contact">
                  {email}
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
