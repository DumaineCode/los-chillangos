import { describe, expect, it } from 'vitest';

import type { Media, MediaVideo } from '../../payload-types';
import { resolveMediaUrl } from './resolveMediaUrl';

/**
 * Unit tests for `resolveMediaUrl` — the shared, side-effect-free helper that
 * extracts a usable URL from a Payload upload relationship which may be:
 *   - null / undefined        → null
 *   - a number (unhydrated id) → null
 *   - a populated Media/MediaVideo doc with a url → the url
 *   - a populated doc without a url → null
 */

describe('resolveMediaUrl', () => {
  it('returns null for null or undefined', () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
  });

  it('returns null for an unhydrated numeric id', () => {
    expect(resolveMediaUrl(123)).toBeNull();
  });

  it('returns the url from a populated Media doc', () => {
    const media = { id: 1, url: '/media/hero.jpg' } as Media;
    expect(resolveMediaUrl(media)).toBe('/media/hero.jpg');
  });

  it('returns the url from a populated MediaVideo doc', () => {
    const video = { id: 2, url: '/media/clip.mp4' } as MediaVideo;
    expect(resolveMediaUrl(video)).toBe('/media/clip.mp4');
  });

  it('returns null when a populated doc has no url', () => {
    const media = { id: 3 } as Media;
    expect(resolveMediaUrl(media)).toBeNull();
  });
});
