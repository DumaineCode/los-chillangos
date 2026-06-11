'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTheme } from './ThemeProvider';

/**
 * Light/dark theme toggle for the top nav.
 *
 * Modeled on `LocaleSwitcher`. Renders a single button that flips the theme.
 * Until mounted we render a neutral placeholder to avoid a hydration mismatch,
 * since the server has no knowledge of the visitor's resolved theme.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      data-testid="theme-toggle"
    >
      {/* Show the icon of the theme you'd switch TO; render Moon until mounted
          so SSR and first client paint match (no hydration mismatch). */}
      {mounted && isDark ? (
        <Sun size={18} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Moon size={18} strokeWidth={2} aria-hidden="true" />
      )}
    </button>
  );
}
