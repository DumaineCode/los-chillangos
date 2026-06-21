import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';

import { BookingConfirmation } from './BookingConfirmation';
import { OwnerNotification } from './OwnerNotification';

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
});
