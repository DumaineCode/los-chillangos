'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';

import { routing, type Locale } from '../../i18n/routing';
import { usePathname, useRouter } from '../../i18n/navigation';

/**
 * Locale toggle (EN ↔ ES) for the top nav.
 *
 * Uses next-intl's locale-aware router so switching preserves the current
 * pathname and any search params. While the route transition is pending we
 * dim the inactive button to give optimistic feedback.
 */
export function LocaleSwitcher() {
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === current) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          className={loc === current ? 'active' : ''}
          aria-pressed={loc === current}
          disabled={isPending}
          onClick={() => change(loc)}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
