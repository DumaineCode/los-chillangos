'use client';

import { useEffect, useState } from 'react';

type Props = {
  reference: string;
  timeoutMessage: string;
};

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * Polls /api/booking/status?ref=... every 3s for up to 30s. When the
 * booking flips to `paid`, the polling stops and the page is force-reloaded
 * so the RSC re-renders the confirmed view. If polling times out, we show
 * the timeout message so the user knows to check email or contact support.
 */
export function SuccessPoll({ reference, timeoutMessage }: Props) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    const timer = setInterval(async () => {
      if (cancelled) return;
      if (Date.now() - start >= POLL_TIMEOUT_MS) {
        clearInterval(timer);
        if (!cancelled) setTimedOut(true);
        return;
      }
      try {
        const res = await fetch(
          `/api/booking/status?ref=${encodeURIComponent(reference)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string };
        if (body.status === 'paid') {
          clearInterval(timer);
          // Force the RSC to re-render with the new status.
          window.location.reload();
        }
      } catch {
        // Transient network error — keep polling.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [reference]);

  if (!timedOut) return null;
  return (
    <p role="alert" style={{ marginTop: 24, color: 'var(--terra)' }}>
      {timeoutMessage}
    </p>
  );
}
