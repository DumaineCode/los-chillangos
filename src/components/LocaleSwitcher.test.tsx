import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../../messages/en.json';
import { LocaleSwitcher } from './LocaleSwitcher';

/**
 * Regression tests for the locale switch dropping search params.
 *
 * next-intl's `usePathname` returns the pathname WITHOUT the query string, so
 * `router.replace(pathname, { locale })` on `/book?tour=x` used to land on
 * `/book` — silently swapping the selected tour for the first published one.
 * The switcher must re-append `useSearchParams()` to the replace target.
 */

const replace = vi.fn();
let currentSearch = '';

vi.mock('../../i18n/navigation', () => ({
  usePathname: () => '/book',
  useRouter: () => ({ replace }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

function renderSwitcher() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LocaleSwitcher />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  replace.mockClear();
  currentSearch = '';
});

describe('LocaleSwitcher', () => {
  it('keeps the query string when switching locale', () => {
    currentSearch = 'tour=dia-de-muertos';
    renderSwitcher();

    fireEvent.click(screen.getByTestId('locale-switcher-es'));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/book?tour=dia-de-muertos', { locale: 'es' });
  });

  it('replaces with the bare pathname when there are no search params', () => {
    renderSwitcher();

    fireEvent.click(screen.getByTestId('locale-switcher-es'));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/book', { locale: 'es' });
  });

  it('does not navigate when clicking the already-active locale', () => {
    currentSearch = 'tour=dia-de-muertos';
    renderSwitcher();

    fireEvent.click(screen.getByTestId('locale-switcher-en'));

    expect(replace).not.toHaveBeenCalled();
  });
});
