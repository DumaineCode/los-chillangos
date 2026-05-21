import { getPayload as getPayloadBase, type Payload } from 'payload';

import config from '../payload.config';

/**
 * RSC-friendly Payload Local API accessor.
 *
 * Memoized per process so each Server Component invocation doesn't spin up a
 * new Payload instance — the underlying `getPayload({ config })` already
 * caches internally, but exposing a single helper keeps imports tidy and
 * gives us one place to add tracing/logging later.
 *
 * Usage (RSC):
 *   const payload = await getPayload();
 *   const { docs } = await payload.find({ collection: 'tours', locale: 'es' });
 */
let cached: Promise<Payload> | undefined;

export function getPayload(): Promise<Payload> {
  if (!cached) {
    cached = getPayloadBase({ config });
  }
  return cached;
}
