import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../../../messages/en.json';
import { BookingFlow } from './BookingFlow';

/**
 * Smoke tests for the 4-step booking wizard after the Sub-etapa C rewire.
 *
 * Confirm step now POSTs to /api/booking/checkout and redirects to a
 * Stripe Checkout URL. We stub `fetch` globally:
 *   - GET /api/booking/availability → empty slots (StepDate falls back)
 *   - POST /api/booking/checkout → returns a stubbed checkoutUrl
 *
 * We do NOT actually navigate — `window.location.assign` is stubbed so the
 * test asserts the wizard called it with the expected URL.
 */

const baseTour = {
  id: 1,
  slug: 'coyoacan-classic',
  title: 'Coyoacán Classic E-Bike',
  category: 'ebike' as const,
  price: 89,
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
  // Default stub: availability returns no taken seats; checkout returns a URL.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (init?.method === 'POST' && url.includes('/api/booking/checkout')) {
        return {
          ok: true,
          json: async () => ({
            checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_smoke',
            reference: 'LC-12345678',
          }),
        };
      }
      return { ok: true, json: async () => ({ slots: [] }) };
    })
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
    fireEvent.click(screen.getByTestId('booking-next'));
    expect(screen.getByRole('heading', { name: /pick a date/i })).toBeInTheDocument();
  });

  it('reaches the confirm step and POSTs to /api/booking/checkout on click', async () => {
    // Stub window.location.assign so the redirect doesn't actually navigate.
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });

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
    const payButton = screen.getByTestId('booking-confirm');
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_smoke');
    });

    // The fetch we care about was the checkout POST.
    const fetchMock = vi.mocked(global.fetch);
    const checkoutCall = fetchMock.mock.calls.find(([url, init]) => {
      const u = typeof url === 'string' ? url : String(url);
      return u.includes('/api/booking/checkout') && init?.method === 'POST';
    });
    expect(checkoutCall).toBeDefined();
    const body = JSON.parse(checkoutCall![1]!.body as string) as {
      tourId: number;
      time: string;
      adults: number;
      customer: { name: string; email: string; locale: string };
    };
    expect(body.tourId).toBe(1);
    expect(body.time).toBe('09:00');
    expect(body.adults).toBe(2);
    expect(body.customer.name).toBe('Hana Kobayashi');
    expect(body.customer.email).toBe('hana@example.com');
    expect(body.customer.locale).toBe('en');
  });

  it('shows the tourPaused banner when availableDays is empty', () => {
    renderFlow({
      ...baseProps,
      tour: { ...baseTour, availableDays: [] },
    });
    expect(screen.getByText(/currently unavailable/i)).toBeInTheDocument();
  });

  it('renders an error message when the checkout API returns no-seats-left', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (init?.method === 'POST' && url.includes('/api/booking/checkout')) {
          return {
            ok: false,
            json: async () => ({ error: 'no-seats-left', remaining: 0 }),
          };
        }
        return { ok: true, json: async () => ({ slots: [] }) };
      })
    );

    renderFlow();
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
    fireEvent.click(screen.getByTestId('booking-confirm'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/just filled up/i);
    });
  });
});

/**
 * Click the first calendar day cell that is `available`. Mondays are
 * filtered out by the fixture's availableDays.
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
