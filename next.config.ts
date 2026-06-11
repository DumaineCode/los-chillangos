import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image only ships the deps actually used at runtime.
  output: 'standalone',
  reactStrictMode: true,
  images: {
    // Allow Payload-served media (local dev) + Cloudflare R2 (prod).
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      // Custom R2 public domain (R2_PUBLIC_URL).
      { protocol: 'https', hostname: 'cdn.loschillangos.com' },
    ],
  },
  async headers() {
    return [
      {
        // Immutable cache for brand assets — mirrors legacy `vercel.json`
        // policy on `/assets/*`. Long-lived because filenames are static and
        // any swap requires a code change anyway.
        source: '/brand/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default withPayload(withNextIntl(nextConfig));
