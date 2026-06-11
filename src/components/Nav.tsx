'use client';

import { useEffect } from 'react';

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
}: Props) {
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
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="logo" aria-label="Los Chillangos — home">
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
        </div>
      </div>
    </nav>
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
