import { describe, expect, it } from 'vitest';

import { parseQuoteAccents } from './parseQuoteAccents';

describe('parseQuoteAccents', () => {
  it('returns a single plain segment when there are no asterisks', () => {
    expect(parseQuoteAccents('La vida es corta')).toEqual([
      { text: 'La vida es corta', accent: false },
    ]);
  });

  it('marks text wrapped in a matched pair of asterisks as an accent segment', () => {
    expect(parseQuoteAccents('*corta*')).toEqual([{ text: 'corta', accent: true }]);
  });

  it('keeps plain text before and after a single highlighted span', () => {
    expect(parseQuoteAccents('La vida es *corta*')).toEqual([
      { text: 'La vida es ', accent: false },
      { text: 'corta', accent: true },
    ]);
  });

  it('emits plain segments before, between, and after multiple highlighted spans', () => {
    expect(parseQuoteAccents('Vive *hoy*, no *mañana*.')).toEqual([
      { text: 'Vive ', accent: false },
      { text: 'hoy', accent: true },
      { text: ', no ', accent: false },
      { text: 'mañana', accent: true },
      { text: '.', accent: false },
    ]);
  });

  it('handles an accent span that starts the string with trailing plain text', () => {
    expect(parseQuoteAccents('*Ride* the real CDMX')).toEqual([
      { text: 'Ride', accent: true },
      { text: ' the real CDMX', accent: false },
    ]);
  });

  // Documented edge case: a lone, unmatched asterisk is malformed markup.
  // The SAFE behavior is to keep it as a LITERAL character in plain text
  // (no accent) so no authored content is silently dropped.
  it('treats an unmatched lone asterisk as literal plain text (no accent)', () => {
    expect(parseQuoteAccents('2 * 3 = 6')).toEqual([{ text: '2 * 3 = 6', accent: false }]);
  });

  it('treats a trailing unmatched asterisk after a real span as literal text', () => {
    expect(parseQuoteAccents('*hoy* y *')).toEqual([
      { text: 'hoy', accent: true },
      { text: ' y *', accent: false },
    ]);
  });

  // Documented edge case: an empty highlight `**` has nothing to accent, so it
  // is dropped entirely — no accent segment, no visible asterisks.
  it('drops an empty highlight (**) leaving no segment and no visible asterisks', () => {
    expect(parseQuoteAccents('a ** b')).toEqual([{ text: 'a  b', accent: false }]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseQuoteAccents('')).toEqual([]);
  });

  it('never leaves an asterisk marker visible for matched pairs', () => {
    const segments = parseQuoteAccents('El *arte* es *libre*');
    const joined = segments.map((s) => s.text).join('');
    expect(joined).not.toContain('*');
    expect(segments.filter((s) => s.accent).map((s) => s.text)).toEqual(['arte', 'libre']);
  });
});
