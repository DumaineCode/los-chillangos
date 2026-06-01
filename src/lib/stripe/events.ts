/**
 * Stripe webhook event type constants.
 *
 * Centralizing the strings keeps the webhook route handler readable and
 * means a typo lights up at the call site, not silently in production.
 * Add new ones here when you start handling them.
 */
export const STRIPE_EVENT = {
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  CHECKOUT_SESSION_EXPIRED: 'checkout.session.expired',
  CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED: 'checkout.session.async_payment_failed',
  PAYMENT_INTENT_PAYMENT_FAILED: 'payment_intent.payment_failed',
} as const;

export type StripeEventType = (typeof STRIPE_EVENT)[keyof typeof STRIPE_EVENT];
