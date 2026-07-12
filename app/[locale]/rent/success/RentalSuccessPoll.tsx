'use client';

import { useEffect, useState } from 'react';

type Props = {
  reference: string;
  timeoutMessage: string;
};

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * Polls /api/rental/status?ref=... every 3s for up to 30s. When the rental
 * flips to `paid`, polling stops and the page reloads so the RSC re-renders the
 * confirmed view. On timeout it shows a message to check email / contact us.
 * Mirrors the booking SuccessPoll.
 */
export function RentalSuccessPoll({ reference, timeoutMessage }: Props) {
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
        const res = await fetch(`/api/rental/status?ref=${encodeURIComponent(reference)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string };
        if (body.status === 'paid') {
          clearInterval(timer);
          window.location.reload();
        }
      } catch {
        /* transient network error — keep polling */
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
