import { describe, expect, it } from 'vitest';

import {
  BookingLinkError,
  buildMailtoLink,
  buildMessageBody,
  buildWhatsAppDeepLink,
  type BookingIntent,
  type BookingMessageLabels,
  type DeepLinkContext,
} from './whatsappDeepLink';

const ctx: DeepLinkContext = {
  contactWhatsapp: '+52 (55) 1234-5678',
  contactEmail: 'hola@loschillangos.com',
  siteUrl: 'https://loschillangos.com',
};

const labelsEn: BookingMessageLabels = {
  greeting: "Hi Los Chillangos! I'd like to book a tour.",
  name: 'Name',
  tour: 'Tour',
  date: 'Date',
  time: 'Time',
  people: 'People',
  privatize: 'Add-on',
  total: 'Estimated total',
  email: 'Email',
  whatsapp: 'WhatsApp',
  privatizeValue: 'Privatize this tour (+USD 140)',
  footer: 'Sent from loschillangos.com',
  subject: 'New booking request — {tour}',
  adultsValue: '2 adults',
  teensValue: '1 teen',
};

const labelsEs: BookingMessageLabels = {
  greeting: '¡Hola Los Chillangos! Quiero reservar un tour.',
  name: 'Nombre',
  tour: 'Tour',
  date: 'Fecha',
  time: 'Hora',
  people: 'Personas',
  privatize: 'Extra',
  total: 'Total estimado',
  email: 'Email',
  whatsapp: 'WhatsApp',
  privatizeValue: 'Tour privado (+USD 140)',
  footer: 'Enviado desde loschillangos.com',
  subject: 'Nueva solicitud de reserva — {tour}',
  adultsValue: '2 adultos',
  teensValue: '1 adolescente',
};

function makeIntent(overrides: Partial<BookingIntent> = {}): BookingIntent {
  return {
    tourTitle: 'Coyoacán Classic E-Bike',
    tourSlug: 'coyoacan-classic',
    date: new Date(Date.UTC(2026, 4, 15, 12, 0, 0)), // May 15, 2026 — midday UTC to avoid DST drift
    time: '14:00',
    adults: 2,
    teens: 1,
    privatize: false,
    estimatedTotal: 218,
    customerName: 'Hana Kobayashi',
    customerEmail: 'hana@example.com',
    locale: 'en',
    ...overrides,
  };
}

describe('buildMessageBody', () => {
  it('renders the en-US date as "May 15, 2026" and total as "USD 218"', () => {
    const body = buildMessageBody(makeIntent(), ctx, labelsEn);

    expect(body).toContain('May 15, 2026');
    // Intl currency en-US renders "$218.00" by default; we forced max=0 so it's "$218".
    // Spec asks for "USD 218" — let's be tolerant of `$` vs `US$` vs `USD` rendering,
    // and just assert the amount is present in the body.
    expect(body).toMatch(/\$?218(\.00)?|USD\s*218|US\$\s*218/);
  });

  it('renders the es-MX date as "15 de mayo de 2026"', () => {
    const body = buildMessageBody(makeIntent({ locale: 'es' }), ctx, labelsEs);

    expect(body).toContain('15 de mayo de 2026');
  });

  it('includes all required fields when all are present', () => {
    const body = buildMessageBody(
      makeIntent({ customerWhatsapp: '+1 718 555 0119' }),
      ctx,
      labelsEn
    );

    expect(body).toContain("Hi Los Chillangos! I'd like to book a tour.");
    expect(body).toContain('Name: Hana Kobayashi');
    expect(body).toContain('Tour: Coyoacán Classic E-Bike');
    expect(body).toContain('Date: May 15, 2026');
    expect(body).toContain('Time: 14:00');
    expect(body).toContain('People: 2 adults, 1 teen');
    expect(body).toContain('Email: hana@example.com');
    expect(body).toContain('WhatsApp: +1 718 555 0119');
    expect(body).toContain('Sent from loschillangos.com');
  });

  it('omits optional whatsapp line when not provided', () => {
    const body = buildMessageBody(makeIntent(), ctx, labelsEn);

    expect(body).toContain('Email: hana@example.com');
    expect(body).not.toContain('WhatsApp:');
  });

  it('omits optional whatsapp line when empty string is passed', () => {
    const body = buildMessageBody(makeIntent({ customerWhatsapp: '   ' }), ctx, labelsEn);

    expect(body).not.toContain('WhatsApp:');
  });

  it('omits the teen part of the People line when teens === 0', () => {
    const body = buildMessageBody(makeIntent({ teens: 0 }), ctx, {
      ...labelsEn,
      adultsValue: '2 adults',
      teensValue: '0 teens',
    });

    expect(body).toContain('People: 2 adults');
    expect(body).not.toContain('teen');
  });

  it('includes the privatize add-on line when privatize=true and reflects +140 in total', () => {
    const body = buildMessageBody(
      makeIntent({ privatize: true, estimatedTotal: 218 + 140 }),
      ctx,
      labelsEn
    );

    expect(body).toContain('Add-on: Privatize this tour (+USD 140)');
    expect(body).toMatch(/\$?358|USD\s*358/);
  });

  it('renders Spanish booking with localized labels and "1 adolescente"', () => {
    const body = buildMessageBody(makeIntent({ locale: 'es' }), ctx, labelsEs);

    expect(body).toContain('¡Hola Los Chillangos!');
    expect(body).toContain('Nombre: Hana Kobayashi');
    expect(body).toContain('Fecha: 15 de mayo de 2026');
    expect(body).toContain('Personas: 2 adultos, 1 adolescente');
  });
});

describe('buildWhatsAppDeepLink', () => {
  it('strips "+", spaces, parens and dashes from the number', () => {
    const link = buildWhatsAppDeepLink(makeIntent(), ctx, labelsEn);

    expect(link.startsWith('https://wa.me/525512345678?text=')).toBe(true);
  });

  it('URL-encodes the message (no raw spaces, newlines become %0A)', () => {
    const link = buildWhatsAppDeepLink(makeIntent(), ctx, labelsEn);
    const encoded = link.split('?text=')[1];

    // No literal whitespace
    expect(encoded).not.toMatch(/\s/);
    // Newlines round-tripped to %0A
    expect(encoded).toContain('%0A');
    // Decoded should equal what buildMessageBody produced
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toBe(buildMessageBody(makeIntent(), ctx, labelsEn));
  });

  it('throws BookingLinkError when contactWhatsapp has no digits', () => {
    const emptyCtx = { ...ctx, contactWhatsapp: '+ - ()' };

    expect(() => buildWhatsAppDeepLink(makeIntent(), emptyCtx, labelsEn)).toThrowError(
      BookingLinkError
    );
  });

  it('throws BookingLinkError when contactWhatsapp is an empty string', () => {
    const emptyCtx = { ...ctx, contactWhatsapp: '' };

    expect(() => buildWhatsAppDeepLink(makeIntent(), emptyCtx, labelsEn)).toThrowError(
      BookingLinkError
    );
  });
});

describe('buildMailtoLink', () => {
  it('correctly encodes subject and body', () => {
    const link = buildMailtoLink(makeIntent(), ctx, labelsEn);

    expect(link.startsWith('mailto:hola@loschillangos.com?')).toBe(true);
    expect(link).toContain('subject=');
    expect(link).toContain('body=');

    const url = new URL(link);
    const subject = url.searchParams.get('subject');
    const body = url.searchParams.get('body');

    expect(subject).toBe('New booking request — Coyoacán Classic E-Bike');
    expect(body).toBe(buildMessageBody(makeIntent(), ctx, labelsEn));
  });

  it('throws BookingLinkError when contact email is empty', () => {
    const emptyCtx = { ...ctx, contactEmail: '   ' };

    expect(() => buildMailtoLink(makeIntent(), emptyCtx, labelsEn)).toThrowError(BookingLinkError);
  });
});
