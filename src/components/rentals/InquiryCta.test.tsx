import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InquiryCta, type InquiryCtaStrings } from './InquiryCta';

/**
 * Behavioral tests for the rentals inquiry CTA (R7 — rentals-inquiry-cta seam).
 *
 * The CTA collects required name + email + a message textarea pre-seeded with
 * the bike reference, validates client-side (name>=2 / email / message>=10)
 * BEFORE posting, and POSTs to /api/contact carrying the bike slug as `rental`
 * and the referenced accessory ids as `accessories`. We stub `fetch` to assert
 * the payload and success / error UI states.
 *
 * The seam stays engine-free: it only ever targets /api/contact — never /book,
 * fleet, availability, pricing, or Stripe.
 */

function seededMessage(bikeName: string) {
  return `I'm interested in renting the ${bikeName} bike.`;
}

const strings: InquiryCtaStrings = {
  heading: 'Request a quote',
  seededMessage: seededMessage('Urban Cruiser'),
  nameLabel: 'Name',
  namePlaceholder: 'Your name',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  messageLabel: 'Your message',
  submit: 'Send inquiry',
  sending: 'Sending…',
  successTitle: 'Inquiry sent!',
  successBody: "Thanks — we'll get back to you soon.",
  sendAnother: 'Send another inquiry',
  errors: {
    name: 'Tell us your name.',
    email: "That email doesn't look right.",
    message: 'Please write a slightly longer message.',
    unexpected: 'Something went wrong. Please try again.',
  },
};

const baseProps = {
  locale: 'en' as const,
  rental: 'urban-cruiser',
  accessories: ['helmet-1', 'lock-2'],
  strings,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InquiryCta', () => {
  it('pre-seeds the message textarea with the bike reference (>=10 chars)', () => {
    render(<InquiryCta {...baseProps} />);
    const textarea = screen.getByLabelText(/your message/i) as HTMLTextAreaElement;
    const seeded = seededMessage('Urban Cruiser');
    expect(textarea.value).toBe(seeded);
    expect(seeded.length).toBeGreaterThanOrEqual(10);
  });

  it('blocks submit and shows field errors when required fields are invalid', async () => {
    render(<InquiryCta {...baseProps} />);

    // Empty the name/email; client validation must reject name<2 and bad email.
    fireEvent.click(screen.getByRole('button', { name: /send inquiry/i }));

    await waitFor(() => {
      expect(screen.getByText('Tell us your name.')).toBeInTheDocument();
    });
    expect(screen.getByText("That email doesn't look right.")).toBeInTheDocument();
    // No POST happened because validation failed before fetch.
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it('blocks submit when the seeded message is cleared below 10 chars', async () => {
    render(<InquiryCta {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Hana' } });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'hana@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/your message/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /send inquiry/i }));

    await waitFor(() => {
      expect(screen.getByText('Please write a slightly longer message.')).toBeInTheDocument();
    });
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it('POSTs the correct payload to /api/contact on a valid submit and shows success', async () => {
    render(<InquiryCta {...baseProps} />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Hana Kobayashi' } });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'hana@example.com' },
    });
    // Keep the seeded message, append extra user text.
    const textarea = screen.getByLabelText(/your message/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: `${textarea.value} Do you deliver to Roma Norte?` },
    });

    fireEvent.click(screen.getByRole('button', { name: /send inquiry/i }));

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    const fetchMock = vi.mocked(global.fetch);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/contact');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as {
      name: string;
      email: string;
      message: string;
      locale: string;
      rental: string;
      accessories: string[];
    };
    expect(body.name).toBe('Hana Kobayashi');
    expect(body.email).toBe('hana@example.com');
    expect(body.locale).toBe('en');
    expect(body.rental).toBe('urban-cruiser');
    expect(body.accessories).toEqual(['helmet-1', 'lock-2']);
    expect(body.message).toContain(seededMessage('Urban Cruiser'));
    expect(body.message).toContain('Roma Norte');

    // Success UI replaces the form.
    await waitFor(() => {
      expect(screen.getByText('Inquiry sent!')).toBeInTheDocument();
    });
    // Engine-free seam: only /api/contact was ever called.
    for (const [calledUrl] of fetchMock.mock.calls) {
      expect(String(calledUrl)).toBe('/api/contact');
    }
  });

  it('omits accessories from the payload when none are referenced (triangulation)', async () => {
    render(
      <InquiryCta
        {...baseProps}
        accessories={[]}
        rental="city-step-through"
        strings={{ ...strings, seededMessage: seededMessage('City Step-Through') }}
      />
    );

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Diego' } });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'diego@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send inquiry/i }));

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      rental: string;
      accessories?: string[];
      message: string;
    };
    expect(body.rental).toBe('city-step-through');
    // Empty accessory selection → key omitted (optional in the schema).
    expect(body.accessories).toBeUndefined();
    expect(body.message).toContain(seededMessage('City Step-Through'));
  });

  it('shows the error state when the API responds not-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ error: 'invalid' }) }))
    );

    render(<InquiryCta {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Hana' } });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'hana@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send inquiry/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    });
  });
});
