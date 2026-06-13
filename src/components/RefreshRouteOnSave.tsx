'use client';

import { RefreshRouteOnSave as PayloadRefreshRouteOnSave } from '@payloadcms/live-preview-react';
import { useRouter } from 'next/navigation';

/**
 * Live Preview bridge (client component).
 *
 * Mounted only on the tour detail page while Next draft mode is active. It
 * listens for the `payload-live-preview` postMessage events the admin emits as
 * the client edits a tour, and triggers `router.refresh()` so the server
 * component re-fetches the in-progress draft and re-renders inside the preview
 * iframe — no save required.
 *
 * `serverURL` must match the origin the admin runs on so the postMessage
 * handshake is accepted. We reuse `NEXT_PUBLIC_SITE_URL` (already the canonical
 * site origin used by Stripe redirects).
 */
export function RefreshRouteOnSave() {
  const router = useRouter();

  return (
    <PayloadRefreshRouteOnSave
      refresh={() => router.refresh()}
      serverURL={process.env.NEXT_PUBLIC_SITE_URL ?? ''}
    />
  );
}
