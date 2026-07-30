'use client';

import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useTransition } from 'react';

import { routing, type Locale } from '../../i18n/routing';
import { usePathname, useRouter } from '../../i18n/navigation';

/**
 * Locale toggle (EN ↔ ES) for the top nav.
 *
 * next-intl's `usePathname` returns the pathname WITHOUT search params, so we
 * re-append `useSearchParams()` explicitly before replacing the route.
 * Without this, switching locale on e.g. `/book?tour=x` would drop the query
 * and the booking page would silently fall back to the first published tour.
 *
 * `useSearchParams` needs a Suspense boundary during prerender, so the
 * exported component wraps the interactive toggle in one; the fallback
 * renders the same buttons disabled to avoid layout shift.
 */
export function LocaleSwitcher() {
  const current = useLocale() as Locale;
  return (
    <Suspense fallback={<LocaleToggle current={current} />}>
      <LocaleSwitcherInner />
    </Suspense>
  );
}

function LocaleSwitcherInner() {
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === current) return;
    const query = searchParams.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(target, { locale: next });
    });
  };

  return <LocaleToggle current={current} disabled={isPending} onChange={change} />;
}

function LocaleToggle({
  current,
  disabled = true,
  onChange,
}: {
  current: Locale;
  disabled?: boolean;
  onChange?: (next: Locale) => void;
}) {
  return (
    <div className="lang-toggle" role="group" aria-label="Language" data-testid="locale-switcher">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          className={loc === current ? 'active' : ''}
          aria-pressed={loc === current}
          disabled={disabled}
          onClick={() => onChange?.(loc)}
          data-testid={`locale-switcher-${loc}`}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
