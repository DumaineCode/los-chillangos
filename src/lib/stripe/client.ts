import Stripe from 'stripe';

/**
 * Server-side Stripe client (Sub-etapa C).
 *
 * Singleton per process. We pin to the API version that ships with the
 * installed `stripe` SDK so the typings line up with the wire format — see
 * `node_modules/stripe/esm/apiVersion.d.ts`. Bumping the SDK regenerates
 * this literal automatically. If a future SDK version no longer accepts
 * this string, the `new Stripe(...)` call below will fail typecheck and we
 * update both at once.
 *
 * Module-load throws if `STRIPE_SECRET_KEY` is missing in non-test
 * environments. Tests mock this module before importing route handlers,
 * so they never hit this code path.
 */

const STRIPE_API_VERSION = '2026-05-27.dahlia';

function buildClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'test') {
      // Allow construction with a dummy key in tests — they mock the SDK
      // calls and never hit the network.
      return new Stripe('sk_test_dummy_for_tests', { apiVersion: STRIPE_API_VERSION });
    }
    throw new Error(
      'STRIPE_SECRET_KEY is required. Set it in .env.local (test keys for dev, live for prod).'
    );
  }
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

export const stripe = buildClient();

export { STRIPE_API_VERSION };
