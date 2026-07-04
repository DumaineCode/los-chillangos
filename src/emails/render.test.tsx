import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';

import { BookingConfirmation } from './BookingConfirmation';
import { ContactNotification } from './ContactNotification';
import { OwnerNotification } from './OwnerNotification';
import { EMAIL_STRINGS } from './strings';
import { colors, fonts, radius, spacing, styles } from './theme';

/** Inline style block of the nearest `<a>` tag preceding the given text. */
function anchorBefore(html: string, text: string): string {
  const textAt = html.indexOf(text);
  expect(textAt).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf('<a', textAt), textAt);
}

/**
 * Real-render smoke tests. The orchestrator tests mock `render`, so these are
 * the only place the templates are actually rendered to HTML — they catch JSX
 * / component regressions and prove the `@react-email/render` node path works.
 */
describe('email templates render to HTML', () => {
  it('renders the booking confirmation with its preview props', async () => {
    const html = await render(<BookingConfirmation {...BookingConfirmation.PreviewProps} />);
    expect(html).toMatch(/<html/i);
    expect(html).toContain('LC-7QK2P9XZ');
    expect(html).toContain('Centro Histórico E-Bike Tour');
    expect(html).toContain('$225.00');
  });

  it('itemizes each selected extra between guests and total', async () => {
    const html = await render(
      <BookingConfirmation
        {...BookingConfirmation.PreviewProps}
        facts={{
          ...BookingConfirmation.PreviewProps.facts,
          extras: [
            { name: 'Private tour', amountLabel: '+$140.00' },
            { name: 'Airport transfer', amountLabel: '+$60.00' },
          ],
          totalLabel: '$425.00',
        }}
      />
    );

    expect(html).toContain('Private tour');
    expect(html).toContain('+$140.00');
    expect(html).toContain('Airport transfer');
    expect(html).toContain('+$60.00');
    expect(html).toContain('$425.00');
  });

  it('omits the extras section when no extras were selected', async () => {
    const html = await render(
      <BookingConfirmation
        {...BookingConfirmation.PreviewProps}
        facts={{ ...BookingConfirmation.PreviewProps.facts, extras: [] }}
      />
    );

    // No extras → no leftover privatize/add-on copy.
    expect(html).not.toContain('+$140.00');
  });

  it('renders a plaintext version of the confirmation', async () => {
    const text = await render(<BookingConfirmation {...BookingConfirmation.PreviewProps} />, {
      plainText: true,
    });
    expect(text).toContain('LC-7QK2P9XZ');
    expect(text).not.toMatch(/<html/i);
  });

  it('renders the owner notification with its preview props', async () => {
    const html = await render(<OwnerNotification {...OwnerNotification.PreviewProps} />);
    expect(html).toMatch(/<html/i);
    expect(html).toContain('New paid booking');
    expect(html).toContain('maria@example.com');
  });

  it('renders the contact notification with its preview props', async () => {
    const html = await render(<ContactNotification {...ContactNotification.PreviewProps} />);
    expect(html).toMatch(/<html/i);
    expect(html).toContain('New contact message');
    expect(html).toContain('María González');
    expect(html).toContain('tour privado para un grupo de 6 personas');
  });

  it('keeps Spanish structural labels intact in the booking confirmation', async () => {
    const es = EMAIL_STRINGS.es;
    const html = await render(
      <BookingConfirmation
        {...BookingConfirmation.PreviewProps}
        copy={{
          ...BookingConfirmation.PreviewProps.copy,
          greeting: 'Hola María,',
          intro: 'Tu pago fue procesado y tu lugar está reservado.',
        }}
        labels={{
          detailsTitle: es.detailsTitle,
          goodToKnowTitle: es.goodToKnowTitle,
          meetingPointTitle: es.meetingPointTitle,
          reference: es.label.reference,
          tour: es.label.tour,
          date: es.label.date,
          time: es.label.time,
          guests: es.label.guests,
          total: es.label.total,
        }}
      />
    );

    expect(html).toContain('Hola María,');
    expect(html).toContain('Tu pago fue procesado y tu lugar está reservado.');
    expect(html).toContain('Tu reserva');
    expect(html).toContain('Referencia');
    expect(html).toContain('Total pagado');
  });
});

describe('shared email theme primitives', () => {
  it('exposes spacing and radius tokens for the templates', () => {
    expect(spacing.md).toBe('16px');
    expect(spacing.xl).toBe('32px');
    expect(radius.md).toBe('12px');
    expect(radius.lg).toBe('16px');
  });

  it('exposes style primitives wired to the brand palette', () => {
    expect(styles.heading.fontFamily).toBe(fonts.serif);
    expect(styles.paragraph.color).toBe(colors.inkSoft);
    expect(styles.card.backgroundColor).toBe(colors.cream);
    expect(styles.card.borderRadius).toBe(radius.md);
    expect(styles.button.backgroundColor).toBe(colors.pink);
    expect(styles.badge.color).toBe(colors.pinkDeep);
    expect(styles.message.whiteSpace).toBe('pre-wrap');
  });
});

describe('restyled chrome and primitives in rendered HTML', () => {
  it.each([
    ['booking confirmation', () => <BookingConfirmation {...BookingConfirmation.PreviewProps} />],
    ['owner notification', () => <OwnerNotification {...OwnerNotification.PreviewProps} />],
    ['contact notification', () => <ContactNotification {...ContactNotification.PreviewProps} />],
  ] as const)('the %s header band carries the pink brand accent', async (_name, tpl) => {
    const html = await render(tpl());
    expect(html).toContain(colors.pink);
  });

  it('styles the owner admin button with the pink primary accent', async () => {
    const html = await render(<OwnerNotification {...OwnerNotification.PreviewProps} />);
    expect(anchorBefore(html, 'Open in admin')).toContain(colors.pink);
  });

  it('styles the contact admin button with the pink primary accent', async () => {
    const html = await render(<ContactNotification {...ContactNotification.PreviewProps} />);
    expect(anchorBefore(html, 'Open in admin')).toContain(colors.pink);
  });
});
