import { describe, expect, it, vi } from 'vitest';

import { sweepExpiredHolds } from './sweep';

/**
 * Hand-rolled Payload mock: only the methods we use.
 */
function makePayload(
  updateImpl: (args: unknown) => Promise<{ docs: unknown[] }>
): { update: ReturnType<typeof vi.fn> } {
  return { update: vi.fn(updateImpl) };
}

describe('sweepExpiredHolds', () => {
  it('updates pending bookings whose hold has expired and returns the count', async () => {
    const now = new Date('2026-06-15T14:00:00Z');
    const payload = makePayload(async () => ({
      docs: [{ id: 1 }, { id: 2 }, { id: 3 }],
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sweepExpiredHolds(payload as any, now);

    expect(result).toEqual({ swept: 3 });
    expect(payload.update).toHaveBeenCalledTimes(1);
    const call = payload.update.mock.calls[0]?.[0] as {
      collection: string;
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      overrideAccess: boolean;
    };
    expect(call.collection).toBe('bookings');
    expect(call.data).toEqual({ status: 'expired' });
    expect(call.overrideAccess).toBe(true);
    // Where clause: status = pending AND holdExpiresAt < now
    expect(call.where).toEqual({
      and: [
        { status: { equals: 'pending' } },
        { holdExpiresAt: { less_than: now.toISOString() } },
      ],
    });
  });

  it('returns 0 when nothing matched', async () => {
    const payload = makePayload(async () => ({ docs: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sweepExpiredHolds(payload as any, new Date('2026-06-15T14:00:00Z'));
    expect(result).toEqual({ swept: 0 });
  });

  it('falls back to new Date() when no `now` is passed', async () => {
    const payload = makePayload(async () => ({ docs: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sweepExpiredHolds(payload as any);
    expect(payload.update).toHaveBeenCalled();
  });
});
