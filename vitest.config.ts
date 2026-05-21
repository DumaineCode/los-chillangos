import { fileURLToPath } from 'node:url';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest baseline (PR 5).
 *
 * Scope:
 *   - jsdom environment for React Testing Library
 *   - JSX/TSX via @vitejs/plugin-react
 *   - Path aliases mirror tsconfig.json (`@/*` → `./src/*`)
 *   - Coverage via v8 provider, text + html reports
 *   - Test discovery: `src/**\/*.test.{ts,tsx}` and `app/**\/*.test.{ts,tsx}`
 *
 * Anything Payload / Next-runtime specific is OUT of scope here — those
 * surfaces will be exercised by Playwright in PR 6.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(here, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'coverage', 'components', 'media'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/booking/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/node_modules/**'],
    },
  },
});
