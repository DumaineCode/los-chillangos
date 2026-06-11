/**
 * Theme primitives shared by the provider, the toggle, and the anti-FOUC
 * inline script.
 *
 * We roll a tiny custom theme system instead of pulling in a dependency: the
 * stylesheet already defines `[data-theme="dark"]` tokens, so all we need is to
 * set `data-theme` on `<html>` and persist the choice. Persistence is written
 * to BOTH localStorage (client reads) and a cookie (so the server could read
 * it later if we ever move resolution server-side).
 */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Runs in the document <head> before first paint. Resolves the stored
 * preference (localStorage → cookie → system) and applies `data-theme` so the
 * page never flashes the wrong theme. Kept dependency-free and defensive
 * because it executes before React hydrates.
 */
export const themeInitScript = `(function(){try{var k='${THEME_STORAGE_KEY}';var t=null;try{t=localStorage.getItem(k);}catch(e){}if(t!=='light'&&t!=='dark'){var m=document.cookie.match(/(?:^|; )${THEME_STORAGE_KEY}=(light|dark)/);if(m){t=m[1];}}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

/** Read the currently applied theme from the DOM (client-only). */
export function getAppliedTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Apply a theme to the DOM and persist it (localStorage + cookie). */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable (private mode) — cookie still covers us */
  }
  document.cookie = `${THEME_STORAGE_KEY}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}
