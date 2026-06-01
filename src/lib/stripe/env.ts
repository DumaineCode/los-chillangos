/**
 * Stripe-adjacent env helpers (Sub-etapa C).
 *
 * Keep env access in one place so we get loud, single-source errors when
 * something's missing in prod. The route handlers MUST call these instead of
 * reading `process.env.*` directly.
 */

/**
 * Returns the canonical site URL with scheme + host, no trailing slash.
 *
 * Priority:
 *   1. `NEXT_PUBLIC_SITE_URL` (env var) — preferred in all environments.
 *   2. The `Origin` header from the incoming request — convenient for local
 *      dev when the env var isn't set yet (e.g. before ngrok URL is known).
 *
 * Throws if neither is available — we'd rather fail loudly than redirect
 * Stripe to `undefined/...`.
 */
export function getSiteUrl(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);

  const origin = request?.headers.get('origin')?.trim();
  if (origin) return stripTrailingSlash(origin);

  throw new Error(
    'Cannot resolve site URL. Set NEXT_PUBLIC_SITE_URL or send a request with an Origin header.'
  );
}

/**
 * Returns the webhook signing secret from `STRIPE_WEBHOOK_SECRET`.
 * Throws in non-test environments if absent — the webhook route must
 * never accept events whose signature it can't verify.
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return 'whsec_test_dummy';
  throw new Error(
    'STRIPE_WEBHOOK_SECRET is required to verify Stripe webhook signatures.'
  );
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
