import { describe, expect, it } from 'vitest';

import { generateBookingReference } from './reference';

describe('generateBookingReference', () => {
  it('returns a string matching LC-XXXXXXXX (uppercase base32 / hex chars)', () => {
    const ref = generateBookingReference();
    // Spec: `LC-` + 8 uppercase chars from a UUID (digits + A-F, all upper).
    expect(ref).toMatch(/^LC-[A-Z0-9]{8}$/);
  });

  it('always starts with the LC- prefix', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(generateBookingReference().startsWith('LC-')).toBe(true);
    }
  });

  it('produces unique references across many calls (1000 iterations)', () => {
    const seen = new Set<string>();
    const ITER = 1000;
    for (let i = 0; i < ITER; i += 1) {
      seen.add(generateBookingReference());
    }
    // UUID v4 randomness over the first 8 chars makes collisions astronomically
    // improbable at this scale. If this ever flakes, the generator is wrong.
    expect(seen.size).toBe(ITER);
  });
});
