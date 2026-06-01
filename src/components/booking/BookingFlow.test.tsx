import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../../../messages/en.json';
import { BookingFlow } from './BookingFlow';

/**
 * Smoke tests for the 4-step booking wizard after the Sub-etapa B rewire.
 *
 * The tour fixture now carries `availableDays` + `timeSlots[].capacity` so
 * the calendar disables closed days and Step 2 caps the headcount per slot.
 *
 * We stub `fetch` so the live-availability call inside StepDate doesn't
 * trigger a real network request — instead it resolves to an empty body and
 * StepDate falls back to the static capacity from `tour.timeSlots`.
 */

const baseTour = {
  id: 1,
  slug: 'coyoacan-classic',
  title: 'Coyoacán Classic E-Bike',
  category: 'ebike' as const,
  price: 89,
  // Every day open except Monday, so the existing "pick first available" test
  // pattern keeps working (most months have non-Monday days available).
  availableDays: ['0', '2', '3', '4', '5', '6'] as ReadonlyArray<
    '0' | '1' | '2' | '3' | '4' | '5' | '6'
  >,
  timeSlots: [
    { time: '09:00', capacity: 8 },
    { time: '14:00', capacity: 8 },
  ],
};

const baseProps = {
  tour: baseTour,
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

beforeEach(() => {
  // Best-effort fetch stub for the availability endpoint. Returns no slots
  // so StepDate keeps the static fallback (everything enabled).
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ slots: [] }),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

    selectAFutureNonMondayDay();
    fireEvent.click(screen.getByRole('button', { name: /09:00/ }));
    fireEvent.click(screen.getByTestId('booking-next'));

    expect(screen.getByRole('heading', { name: /how many riders/i })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('booking-next'));

    expect(screen.getByRole('heading', { name: /your details/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Hana Kobayashi' },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'hana@example.com' },
    });
    fireEvent.click(screen.getByTestId('booking-next'));

    expect(screen.getByRole('heading', { name: /ready to confirm/i })).toBeInTheDocument();
    const link = screen.getByTestId('booking-confirm') as HTMLAnchorElement;
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

    const link = screen.getByTestId('booking-confirm') as HTMLAnchorElement;
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

  it('shows the tourPaused banner when availableDays is empty', () => {
    renderFlow({
      ...baseProps,
      tour: { ...baseTour, availableDays: [] },
    });
    expect(screen.getByText(/currently unavailable/i)).toBeInTheDocument();
  });
});

/**
 * Click the first calendar day cell that is `available` (i.e. enabled by
 * the parent-supplied predicate). The MiniCalendar opens on the current
 * month by default. Mondays are filtered out by the fixture's availableDays.
 */
function selectAFutureNonMondayDay() {
  const buttons = screen.getAllByRole('button');
  const dayCells = buttons.filter((btn) => /^\d+$/.test(btn.textContent ?? ''));
  const available = dayCells.find((btn) => !(btn as HTMLButtonElement).disabled);
  expect(available, 'expected at least one available day in the current month').toBeTruthy();
  act(() => {
    fireEvent.click(available!);
  });
}
