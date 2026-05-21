'use client';

import { useTranslations } from 'next-intl';

type Props = {
  /** The final URL (wa.me or mailto:) the button will navigate to. */
  href: string;
  /** True when we're falling back to mailto: because WhatsApp is empty. */
  isMailto: boolean;
  /** True when neither WhatsApp nor email is configured in Payload. */
  configMissing: boolean;
  /** Click handler that performs the redirect (so we can `window.location.href = …`). */
  onConfirm: () => void;
};

/**
 * Confirmation step — a single primary button that opens the deep link.
 *
 * The button is rendered as an `<a>` with the actual URL in its `href`, so:
 *   - Right-click "open in new tab" works
 *   - Screen readers announce the destination
 *   - The smoke test in `BookingFlow.test.tsx` can assert
 *     `getAttribute('href')` against the built deep link
 *
 * We still attach an `onClick` that calls `onConfirm()` so the parent can
 * trigger `window.location.href = …` (matching the user's prompt). Both
 * paths land on the same URL.
 */
export function StepConfirm({ href, isMailto, configMissing, onConfirm }: Props) {
  const t = useTranslations('booking.steps.confirm');
  const tButtons = useTranslations('booking.buttons');
  const tBooking = useTranslations('booking');

  if (configMissing) {
    return (
      <div role="alert" style={{ padding: 32, textAlign: 'center' }} data-testid="booking-step-4">
        <h2>{t('title')}</h2>
        <p
          style={{
            color: 'var(--terra)',
            marginTop: 16,
            padding: '16px 18px',
            background: 'var(--cream)',
            borderRadius: 6,
            border: '1px solid var(--terra)',
          }}
        >
          {tBooking('configMissing')}
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }} data-testid="booking-step-4">
      <h2>{t('title')}</h2>
      <p className="lede">{t('lede')}</p>
      <a
        href={href}
        className="btn btn-terra btn-lg"
        onClick={(e) => {
          // Let the browser handle the navigation natively. We also call
          // onConfirm() to support the wa.me deep-link sometimes needing a
          // `window.location.href = …` push on certain browsers. Don't
          // preventDefault — the native click does the heavier lifting.
          onConfirm();
          void e;
        }}
        target={isMailto ? undefined : '_blank'}
        rel={isMailto ? undefined : 'noopener noreferrer'}
        style={{ marginTop: 24 }}
        data-testid="booking-confirm"
      >
        {isMailto ? tButtons('confirmEmail') : tButtons('confirmWhatsapp')} →
      </a>
      <p style={{ marginTop: 24, fontSize: 14, color: 'var(--ink-soft)' }}>{t('redirectLede')}</p>
      <a
        href={href}
        target={isMailto ? undefined : '_blank'}
        rel={isMailto ? undefined : 'noopener noreferrer'}
        style={{
          display: 'inline-block',
          marginTop: 8,
          fontSize: 13,
          color: 'var(--ink)',
          textDecoration: 'underline',
          wordBreak: 'break-all',
        }}
      >
        {tButtons('fallbackLink')}
      </a>
      <p
        className="mono"
        style={{
          marginTop: 32,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {t('footer')}
      </p>
    </div>
  );
}
