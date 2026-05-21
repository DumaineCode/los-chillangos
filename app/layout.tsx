import type { Metadata, Viewport } from 'next';

/**
 * Root layout — pass-through.
 *
 * The visible HTML shell (html, body, fonts, globals.css, nav, footer) is
 * owned by `app/[locale]/layout.tsx`, following the next-intl App Router
 * pattern. The Payload admin route group `(payload)` provides its own root
 * layout via `@payloadcms/next/layouts`.
 *
 * Next.js 15 accepts a pass-through `RootLayout` here because every concrete
 * URL is matched by either `[locale]` or `(payload)`, and middleware redirects
 * `/` → `/en` before any render happens.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Los Chillangos — CDMX E-Bike & Walking Tours',
    template: '%s · Los Chillangos',
  },
};

export const viewport: Viewport = {
  themeColor: '#0D182A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
