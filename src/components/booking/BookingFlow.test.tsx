import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import enMessages from '../../../messages/en.json';
import { BookingFlow } from './BookingFlow';

/**
 * Smoke tests for the 4-step booking wizard.
 *
 * Per PR 5 prompt:
 *   - Step 1 renders initially
 *   - Cannot advance past step 1 without selecting date + time
 *   - After completing all 4 steps, the confirm link's href is the expected
 *     wa.me deep link
 *
 * We render with `NextIntlClientProvider` using the actual `messages/en.json`
 * so the translator behaves like production (no mock divergence).
 */

const baseProps = {
  tour: {
    slug: 'coyoacan-classic',
    title: 'Coyoacán Classic E-Bike',
    category: 'ebike' as const,
    price: 89,
  },
  contact: {
    whatsapp: '+525555555555',
    email: 'hola@loschillangos.com',
  },
  siteUrl: 'https://loschillangos.com',
  locale: 'en' as const,
};

function renderFlow(props = baseProps) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BookingFlow {...props} />
    </NextIntlClientProvider>
  );
}

describe('BookingFlow', () => {
  it('renders step 1 (Pick a date) initially', () => {
    renderFlow();

    expect(screen.getByRole('heading', { name: /pick a date/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
  });

  it('does not advance past step 1 when no date or time is selected', () => {
    renderFlow();

    const next = screen.getByTestId('booking-next');
    fireEvent.click(next);

    // Still on step 1
    expect(screen.getByRole('heading', { name: /pick a date/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
  });

  it('advances through all 4 steps when each step receives valid input', () => {
    renderFlow();

    // Step 1 — pick a non-Monday future day from the calendar + a time slot.
    selectAFutureNonMondayDay();
    fireEvent.click(screen.getByRole('button', { name: /09:00/ }));
    fireEvent.click(screen.getByTestId('booking-next'));

    // Step 2 — defaults are adults=2, teens=0, privatize=false (valid).
    expect(screen.getByRole('heading', { name: /how many riders/i })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('booking-next'));

    // Step 3 — fill the details form.
    expect(screen.getByRole('heading', { name: /your details/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Hana Kobayashi' },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'hana@example.com' },
    });
    fireEvent.click(screen.getByTestId('booking-next'));

    // Step 4 — confirmation link is rendered with the wa.me URL.
    expect(screen.getByRole('heading', { name: /ready to confirm/i })).toBeInTheDocument();
    const link = screen.getByTestId('booking-confirm-link') as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/525555555555\?text=/);
  });

  it('falls back to mailto: when WhatsApp is empty', () => {
    renderFlow({ ...baseProps, contact: { whatsapp: '', email: 'hola@loschillangos.com' } });
    selectAFutureNonMondayDay();
    fireEvent.click(screen.getByRole('button', { name: /09:00/ }));
    fireEvent.click(screen.getByTestId('booking-next'));
    fireEvent.click(screen.getByTestId('booking-next'));
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Hana Kobayashi' },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'hana@example.com' },
    });
    fireEvent.click(screen.getByTestId('booking-next'));

    const link = screen.getByTestId('booking-confirm-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toMatch(/^mailto:hola@loschillangos\.com\?/);
  });

  it('shows the config-missing alert when both channels are empty', () => {
    renderFlow({ ...baseProps, contact: { whatsapp: '', email: '' } });
    selectAFutureNonMondayDay();
    fireEvent.click(screen.getByRole('button', { name: /09:00/ }));
    fireEvent.click(screen.getByTestId('booking-next'));
    fireEvent.click(screen.getByTestId('booking-next'));
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Hana Kobayashi' },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'hana@example.com' },
    });
    fireEvent.click(screen.getByTestId('booking-next'));

    expect(screen.getByRole('alert')).toHaveTextContent(/Configure WhatsApp or email/i);
  });
});

/**
 * Click the first calendar day cell that is `available` (not past, not
 * Monday). The MiniCalendar opens on the current month by default.
 */
function selectAFutureNonMondayDay() {
  // Find every enabled date button — the mini calendar renders weekday
  // letters as plain divs and disabled days carry `disabled`.
  const buttons = screen.getAllByRole('button');
  const dayCells = buttons.filter((btn) => /^\d+$/.test(btn.textContent ?? ''));
  const available = dayCells.find((btn) => !(btn as HTMLButtonElement).disabled);
  expect(available, 'expected at least one available day in the current month').toBeTruthy();
  act(() => {
    fireEvent.click(available!);
  });
}
