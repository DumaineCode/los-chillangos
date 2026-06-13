import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Booking email orchestrator tests.
 *
 * Strategy: mock Payload (booking + tour + globals), the Resend client, and
 * React Email's `render` so we exercise the ORCHESTRATION — recipients,
 * subject token interpolation, locale selection, owner fallback, and the
 * never-throw contract — without rendering real HTML or hitting the network.
 */

vi.mock('@react-email/render', () => ({
  render: vi.fn(async () => '<html>rendered</html>'),
}));

vi.mock('./client', () => ({
  isEmailConfigured: true,
  resend: {
    emails: {
      send: vi.fn(async () => ({ data: { id: 'eml_test' }, error: null })),
    },
  },
}));

vi.mock('../payload', () => ({
  getPayload: vi.fn(async () => mockPayload),
}));

interface BookingShape {
  id: number;
  reference: string;
  tour: number;
  date: string;
  time: string;
  adults: number;
  teens: number;
  totalAmount: number;
  currency: string;
  customer: { name: string; email: string; whatsapp: string | null; locale: string };
}

let bookingDoc: BookingShape | null;
let contactGlobal: { email?: string | null } | null;

const mockPayload = {
  findByID: vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === 'bookings') return bookingDoc;
    if (collection === 'tours') return { title: 'Centro Histórico E-Bike Tour' };
    return null;
  }),
  findGlobal: vi.fn(async ({ slug }: { slug: string }) => {
    if (slug === 'email-content') return {}; // empty → code defaults
    if (slug === 'contact-info') return contactGlobal;
    return null;
  }),
};

const { resend } = await import('./client');
const { sendBookingEmails } = await import('./send');
const mockSend = vi.mocked(resend.emails.send);

function baseBooking(overrides: Partial<BookingShape> = {}): BookingShape {
  return {
    id: 42,
    reference: 'LC-TEST1234',
    tour: 7,
    date: '2026-03-14T06:00:00.000Z',
    time: '09:00',
    adults: 2,
    teens: 1,
    totalAmount: 225,
    currency: 'USD',
    customer: {
      name: 'María González',
      email: 'maria@example.com',
      whatsapp: '+52 55 1234 5678',
      locale: 'es',
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  bookingDoc = baseBooking();
  contactGlobal = { email: 'hola@loschillangos.com' };
  process.env.BOOKING_NOTIFY_EMAIL = 'owner@loschillangos.com';
  delete process.env.EMAIL_REPLY_TO;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  delete process.env.BOOKING_NOTIFY_EMAIL;
});

describe('sendBookingEmails', () => {
  it('sends a guest confirmation and an owner notification', async () => {
    await sendBookingEmails(42);

    expect(mockSend).toHaveBeenCalledTimes(2);

    const confirmation = mockSend.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(confirmation.to).toBe('maria@example.com');
    // ES default subject, with {reference} interpolated.
    expect(String(confirmation.subject)).toContain('LC-TEST1234');
    expect(String(confirmation.subject)).toMatch(/reserva/i);
    expect(confirmation.html).toBe('<html>rendered</html>');
    expect(confirmation.text).toBe('<html>rendered</html>');
    // Reply-To falls back to the owner address.
    expect(confirmation.replyTo).toBe('owner@loschillangos.com');

    const owner = mockSend.mock.calls[1]?.[0] as unknown as Record<string, unknown>;
    expect(owner.to).toBe('owner@loschillangos.com');
    expect(String(owner.subject)).toContain('LC-TEST1234');
    expect(String(owner.subject)).toContain('Centro Histórico');
    // Owner replies go straight to the guest.
    expect(owner.replyTo).toBe('maria@example.com');
  });

  it('interpolates {reference} in the English subject for en bookings', async () => {
    bookingDoc = baseBooking({
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
        whatsapp: null,
        locale: 'en',
      },
    });

    await sendBookingEmails(42);

    const confirmation = mockSend.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(confirmation.to).toBe('john@example.com');
    expect(String(confirmation.subject)).toMatch(/Your Los Chillangos booking is confirmed/i);
    expect(String(confirmation.subject)).toContain('LC-TEST1234');
  });

  it('falls back to ContactInfo email for the owner when env is unset', async () => {
    delete process.env.BOOKING_NOTIFY_EMAIL;

    await sendBookingEmails(42);

    expect(mockSend).toHaveBeenCalledTimes(2);
    const owner = mockSend.mock.calls[1]?.[0] as unknown as Record<string, unknown>;
    expect(owner.to).toBe('hola@loschillangos.com');
  });

  it('sends only the confirmation when no owner recipient is resolvable', async () => {
    delete process.env.BOOKING_NOTIFY_EMAIL;
    contactGlobal = { email: null };

    await sendBookingEmails(42);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const confirmation = mockSend.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(confirmation.to).toBe('maria@example.com');
  });

  it('no-ops when the booking is not found', async () => {
    bookingDoc = null;

    await sendBookingEmails(999);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('never throws when Resend returns an error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSend.mockResolvedValue({ data: null, error: { message: 'boom', name: 'application_error' } } as any);

    await expect(sendBookingEmails(42)).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
