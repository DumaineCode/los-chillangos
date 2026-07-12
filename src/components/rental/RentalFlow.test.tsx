import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../../../messages/en.json';
import { RentalFlow } from './RentalFlow';

/**
 * Smoke tests for the standalone bike-rental wizard (Batch 3c / PR4).
 *
 * Mirrors BookingFlow.test.tsx. We stub `fetch` globally:
 *   - GET  /api/rental/availability → a rentable day with a start×tier grid
 *   - POST /api/rental/checkout      → a stubbed { checkoutUrl, reference }
 *
 * `window.location.assign` is stubbed so the redirect is asserted, not run.
 * The wizard must NEVER post a price — the server derives it (design §5a/§5b).
 */

const COMBOS = [
  { startTime: '10:00', durationMinutes: 60, unitPrice: 200, maxQuantity: 8 },
  { startTime: '10:00', durationMinutes: 120, unitPrice: 300, maxQuantity: 8 },
  { startTime: '12:00', durationMinutes: 60, unitPrice: 200, maxQuantity: 5 },
];

const baseProps = {
  siteUrl: 'https://loschillangos.com',
  locale: 'en' as const,
};

function renderFlow(props = baseProps) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <RentalFlow {...props} />
    </NextIntlClientProvider>
  );
}

function stubFetch(checkout: { ok: boolean; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (init?.method === 'POST' && url.includes('/api/rental/checkout')) {
        return { ok: checkout.ok, json: async () => checkout.body };
      }
      // Availability GET.
      return { ok: true, json: async () => ({ date: '2099-01-01', rentable: true, combos: COMBOS }) };
    })
  );
}

beforeEach(() => {
  stubFetch({
    ok: true,
    body: { checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_rental', reference: 'LC-RENT0001' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RentalFlow', () => {
  it('renders step 1 (Pick a day) initially', () => {
    renderFlow();
    expect(screen.getByRole('heading', { name: /pick a day/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
  });

  it('does not advance past step 1 without a date + start time', () => {
    renderFlow();
    fireEvent.click(screen.getByTestId('rental-next'));
    expect(screen.getByRole('heading', { name: /pick a day/i })).toBeInTheDocument();
  });

  it('walks date → options → details → confirm and POSTs to /api/rental/checkout (no price sent)', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });

    renderFlow();

    // Step 1: pick the first enabled (today) calendar cell, then a start time.
    selectFirstAvailableDay();
    const startChip = await screen.findByRole('button', { name: /10:00/ });
    fireEvent.click(startChip);
    fireEvent.click(screen.getByTestId('rental-next'));

    // Step 2: pick the 2h tier, bump quantity to 2, preview reflects 2 × 300.
    expect(screen.getByRole('heading', { name: /duration & bikes/i })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rental-tier-120'));
    fireEvent.click(screen.getByLabelText(/increase bikes/i));
    expect(screen.getAllByText('$600').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('rental-next'));

    // Step 3: customer details (reuses the booking details step).
    expect(screen.getByRole('heading', { name: /your details/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Hana Kobayashi' } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'hana@example.com' } });
    fireEvent.change(screen.getByLabelText(/country of origin/i), { target: { value: 'MX' } });
    fireEvent.click(screen.getByTestId('rental-next'));

    // Step 4: confirm → Stripe redirect.
    expect(screen.getByRole('heading', { name: /ready to confirm/i })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rental-confirm'));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_rental');
    });

    const fetchMock = vi.mocked(global.fetch);
    const checkoutCall = fetchMock.mock.calls.find(([url, init]) => {
      const u = typeof url === 'string' ? url : String(url);
      return u.includes('/api/rental/checkout') && init?.method === 'POST';
    });
    expect(checkoutCall).toBeDefined();
    const body = JSON.parse(checkoutCall![1]!.body as string) as Record<string, unknown> & {
      customer: Record<string, unknown>;
    };
    expect(body.startTime).toBe('10:00');
    expect(body.durationMinutes).toBe(120);
    expect(body.quantity).toBe(2);
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.customer.name).toBe('Hana Kobayashi');
    expect(body.customer.email).toBe('hana@example.com');
    expect(body.customer.country).toBe('MX');
    expect(body.customer.locale).toBe('en');
    // The client must NEVER send a price — server derives it.
    expect(body).not.toHaveProperty('unitPrice');
    expect(body).not.toHaveProperty('totalAmount');
    expect(body.customer).not.toHaveProperty('price');
  });

  it('surfaces the rental-unavailable error from the checkout API', async () => {
    stubFetch({ ok: false, body: { error: 'rental-unavailable', reason: 'fleet' } });

    renderFlow();
    selectFirstAvailableDay();
    fireEvent.click(await screen.findByRole('button', { name: /10:00/ }));
    fireEvent.click(screen.getByTestId('rental-next'));
    fireEvent.click(screen.getByTestId('rental-tier-60'));
    fireEvent.click(screen.getByTestId('rental-next'));
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Hana Kobayashi' } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'hana@example.com' } });
    fireEvent.change(screen.getByLabelText(/country of origin/i), { target: { value: 'MX' } });
    fireEvent.click(screen.getByTestId('rental-next'));
    fireEvent.click(screen.getByTestId('rental-confirm'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no longer available/i);
    });
  });

  it('shows a not-rentable notice when the day returns rentable:false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ date: '2099-01-01', rentable: false, combos: [] }) }))
    );

    renderFlow();
    selectFirstAvailableDay();
    await waitFor(() => {
      expect(screen.getByText(/aren't open for that day/i)).toBeInTheDocument();
    });
  });
});

/** Click the first enabled (non-disabled) calendar day cell — today. */
function selectFirstAvailableDay() {
  const buttons = screen.getAllByRole('button');
  const dayCells = buttons.filter((btn) => /^\d+$/.test(btn.textContent ?? ''));
  const available = dayCells.find((btn) => !(btn as HTMLButtonElement).disabled);
  expect(available, 'expected at least one enabled day in the current month').toBeTruthy();
  act(() => {
    fireEvent.click(available!);
  });
}
