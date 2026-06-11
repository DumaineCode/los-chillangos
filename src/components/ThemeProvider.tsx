'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { applyTheme, getAppliedTheme, type Theme } from '../lib/theme';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Client provider for the light/dark theme.
 *
 * The actual `data-theme` attribute is already set before paint by the inline
 * script in the layout `<head>` (see `themeInitScript`). This provider simply
 * mirrors that value into React state so the toggle can render the correct
 * pressed state, and updates both the DOM + persistence when the user changes
 * it. It also keeps the UI in sync with OS-level theme changes when the user
 * has not made an explicit choice.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  // Sync state with whatever the pre-paint script applied.
  useEffect(() => {
    setThemeState(getAppliedTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(getAppliedTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
