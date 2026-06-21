import { describe, expect, it } from 'vitest';

import type { Media, MediaVideo } from '../../payload-types';
import { resolveMediaImage } from './resolveMediaImage';

/**
 * Unit tests for `resolveMediaImage` — the shared, side-effect-free resolver
 * that turns a Payload upload relationship into a cover-render-ready
 * `{ url, objectPosition, alt }` triple, or `null` when there is nothing usable.
 *
 * Covers FR-1..FR-6 from the spec. Cache-bust (`?v=`) is asserted at the
 * RESOLVER level only — next/image rewrites the rendered <img> src, so it can
 * never be asserted on a rendered element.
 */

const T = '2026-01-01T00:00:00.000Z';
const EPOCH = Date.parse(T); // 1767225600000

function media(overrides: Partial<Media> = {}): Media {
  return {
    id: 1,
    alt: '',
    url: '/media/hero.jpg',
    updatedAt: T,
    createdAt: T,
    ...overrides,
  } as Media;
}

describe('resolveMediaImage', () => {
  // FR-5 — null/number/no-url → null
  describe('null-result parity (FR-5)', () => {
    it('returns null for null or undefined', () => {
      expect(resolveMediaImage(null)).toBeNull();
      expect(resolveMediaImage(undefined)).toBeNull();
    });

    it('returns null for an unhydrated numeric id', () => {
      expect(resolveMediaImage(123)).toBeNull();
    });

    it('returns null when a populated doc has no url', () => {
      expect(resolveMediaImage(media({ url: null }))).toBeNull();
    });
  });

  // FR-1 — focal honored
  describe('focal point → object-position (FR-1)', () => {
    it('maps focalX/focalY to a "X% Y%" string', () => {
      const result = resolveMediaImage(media({ focalX: 20, focalY: 80 }));
      expect(result?.objectPosition).toBe('20% 80%');
    });

    it('maps a different focal point (forces real logic, not a hardcode)', () => {
      const result = resolveMediaImage(media({ focalX: 70, focalY: 30 }));
      expect(result?.objectPosition).toBe('70% 30%');
    });
  });

  // FR-2 — legacy/null default
  describe('legacy null focal → 50% 50% (FR-2)', () => {
    it('defaults both axes to 50% when focal is null', () => {
      const result = resolveMediaImage(media({ focalX: null, focalY: null }));
      expect(result?.objectPosition).toBe('50% 50%');
    });

    it('defaults both axes to 50% when focal is absent (undefined)', () => {
      const result = resolveMediaImage(media());
      expect(result?.objectPosition).toBe('50% 50%');
    });
  });

  // FR-3 — boundaries, clamp, round, single-axis fallback
  describe('boundaries / clamp / round (FR-3)', () => {
    it('keeps 0/0 at the extremes', () => {
      expect(resolveMediaImage(media({ focalX: 0, focalY: 0 }))?.objectPosition).toBe('0% 0%');
    });

    it('keeps 100/100 at the extremes', () => {
      expect(resolveMediaImage(media({ focalX: 100, focalY: 100 }))?.objectPosition).toBe(
        '100% 100%'
      );
    });

    it('clamps values above 100 and below 0', () => {
      expect(resolveMediaImage(media({ focalX: 150, focalY: -20 }))?.objectPosition).toBe(
        '100% 0%'
      );
    });

    it('rounds sub-percent precision to the nearest integer', () => {
      expect(resolveMediaImage(media({ focalX: 33.7, focalY: 66.2 }))?.objectPosition).toBe(
        '34% 66%'
      );
    });

    it('falls back to 50 for a single null axis only', () => {
      expect(resolveMediaImage(media({ focalX: 80, focalY: null }))?.objectPosition).toBe(
        '80% 50%'
      );
    });
  });

  // FR-4 — cache busting via version token
  describe('cache-bust version token (FR-4)', () => {
    it('appends ?v=<Date.parse(updatedAt)> to the url', () => {
      const result = resolveMediaImage(media());
      expect(result?.url).toBe(`/media/hero.jpg?v=${EPOCH}`);
    });

    it('changes the token when updatedAt changes', () => {
      const a = resolveMediaImage(media({ updatedAt: T }));
      const b = resolveMediaImage(media({ updatedAt: '2026-06-15T12:00:00.000Z' }));
      expect(a?.url).not.toBe(b?.url);
      expect(b?.url).toBe(`/media/hero.jpg?v=${Date.parse('2026-06-15T12:00:00.000Z')}`);
    });

    it('omits the token when updatedAt is missing or unparseable', () => {
      expect(resolveMediaImage(media({ updatedAt: undefined as unknown as string }))?.url).toBe(
        '/media/hero.jpg'
      );
      expect(resolveMediaImage(media({ updatedAt: 'not-a-date' }))?.url).toBe('/media/hero.jpg');
    });

    it('preserves an existing query string by appending with &', () => {
      const result = resolveMediaImage(media({ url: '/media/hero.jpg?w=800' }));
      expect(result?.url).toBe(`/media/hero.jpg?w=800&v=${EPOCH}`);
    });
  });

  // FR-6 — alt passthrough
  describe('alt passthrough (FR-6)', () => {
    it('passes the alt text through', () => {
      expect(resolveMediaImage(media({ alt: 'Sunset over the canal' }))?.alt).toBe(
        'Sunset over the canal'
      );
    });

    it('defaults alt to an empty string when missing', () => {
      expect(resolveMediaImage(media({ alt: undefined as unknown as string }))?.alt).toBe('');
    });
  });

  // size param picks sizes[name].url else base
  describe('size selection', () => {
    it('uses sizes[name].url when the named size exists', () => {
      const doc = media({
        sizes: { card: { url: '/media/hero-card.jpg' } },
      });
      expect(resolveMediaImage(doc, { size: 'card' })?.url).toBe(`/media/hero-card.jpg?v=${EPOCH}`);
    });

    it('falls back to the base url when the named size is absent', () => {
      const doc = media({ sizes: {} });
      expect(resolveMediaImage(doc, { size: 'card' })?.url).toBe(`/media/hero.jpg?v=${EPOCH}`);
    });

    it('uses the base url for a MediaVideo (no sizes map)', () => {
      const video = {
        id: 2,
        alt: '',
        url: '/media/clip.mp4',
        updatedAt: T,
        createdAt: T,
      } as MediaVideo;
      expect(resolveMediaImage(video, { size: 'card' })?.url).toBe(`/media/clip.mp4?v=${EPOCH}`);
    });
  });
});
