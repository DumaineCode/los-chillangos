import { describe, expect, it } from 'vitest';

import { formatBookingDate, formatMoney, formatTime, interpolate, toLines } from './format';

describe('formatMoney', () => {
  it('formats USD in major units (not cents)', () => {
    expect(formatMoney(225, 'USD', 'en')).toBe('$225.00');
  });

  it('formats with the es-MX locale', () => {
    // es-MX uses "US$" for foreign USD; assert the amount is present.
    expect(formatMoney(1250.5, 'USD', 'es')).toContain('1,250.50');
  });

  it('renders an unknown but well-formed 3-letter code without throwing', () => {
    // Intl is lenient with any 3-letter code (no throw); it just prefixes it.
    expect(formatMoney(100, 'ZZZ', 'en')).toContain('100.00');
  });

  it('falls back to plain number + code for a malformed currency code', () => {
    // 2-letter code makes Intl throw → our catch fires.
    expect(formatMoney(100, 'US', 'en')).toBe('100.00 US');
  });
});

describe('formatBookingDate', () => {
  it('renders a CDMX calendar date in English', () => {
    const out = formatBookingDate('2026-03-14T06:00:00.000Z', 'en');
    expect(out).toContain('2026');
    expect(out).toMatch(/March|Mar/);
    expect(out).toContain('14');
  });

  it('returns the input unchanged for an invalid date', () => {
    expect(formatBookingDate('not-a-date', 'en')).toBe('not-a-date');
  });
});

describe('formatTime', () => {
  it('formats 24h → 12h in English', () => {
    expect(formatTime('09:00', 'en')).toBe('9:00 AM');
    expect(formatTime('18:30', 'en')).toBe('6:30 PM');
    expect(formatTime('00:15', 'en')).toBe('12:15 AM');
    expect(formatTime('12:00', 'en')).toBe('12:00 PM');
  });

  it('keeps 24h with an "h" suffix in Spanish', () => {
    expect(formatTime('18:30', 'es')).toBe('18:30 h');
  });

  it('returns the input for a malformed time', () => {
    expect(formatTime('9am', 'en')).toBe('9am');
  });
});

describe('interpolate', () => {
  it('replaces known tokens and leaves unknown ones intact', () => {
    expect(interpolate('Hi {name}, ref {reference}', { name: 'Ana', reference: 'LC-1' })).toBe(
      'Hi Ana, ref LC-1'
    );
    expect(interpolate('Hello {missing}', {})).toBe('Hello {missing}');
  });
});

describe('toLines', () => {
  it('splits non-empty trimmed lines', () => {
    expect(toLines('  a \n\n b \n')).toEqual(['a', 'b']);
  });

  it('returns an empty array for empty input', () => {
    expect(toLines('')).toEqual([]);
    expect(toLines(null)).toEqual([]);
    expect(toLines(undefined)).toEqual([]);
  });
});
