/**
 * Vitest setup — runs before every test file.
 *
 * Loads `@testing-library/jest-dom` matchers so we can use `toBeInTheDocument`,
 * `toHaveAttribute`, etc. from `expect(...)`.
 */
import '@testing-library/jest-dom/vitest';
