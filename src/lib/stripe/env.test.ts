import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getSiteUrl, getWebhookSecret } from './env';

describe('getSiteUrl', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it('returns NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://chillangos.example';
    expect(getSiteUrl()).toBe('https://chillangos.example');
  });

  it('strips a trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://chillangos.example/';
    expect(getSiteUrl()).toBe('https://chillangos.example');
  });

  it('falls back to request origin when env var is absent', () => {
    const req = new Request('http://anywhere/', {
      headers: { origin: 'https://abc123.ngrok.app' },
    });
    expect(getSiteUrl(req)).toBe('https://abc123.ngrok.app');
  });

  it('throws when neither env var nor request origin is available', () => {
    expect(() => getSiteUrl()).toThrowError(/Cannot resolve site URL/);
  });
});

describe('getWebhookSecret', () => {
  const original = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = original;
  });

  it('returns env var when set', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_real_value_here';
    expect(getWebhookSecret()).toBe('whsec_real_value_here');
  });

  it('falls back to a dummy in NODE_ENV=test', () => {
    expect(getWebhookSecret()).toBe('whsec_test_dummy');
  });
});
