import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Locale-aware navigation primitives.
 *
 * Use these everywhere instead of the bare `next/link` / `next/navigation`
 * so the active locale prefix is preserved automatically on every link and
 * programmatic navigation.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
