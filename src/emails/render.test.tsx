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
