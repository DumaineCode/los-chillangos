import { describe, expect, it } from 'vitest';

import { buildWhatsAppLink, formatWhatsAppDisplay, toWhatsAppDigits } from './whatsapp';

describe('toWhatsAppDigits', () => {
  it('strips every non-digit character', () => {
    expect(toWhatsAppDigits('+52 55 5555 5555')).toBe('525555555555');
    expect(toWhatsAppDigits('(415) 555-0123')).toBe('4155550123');
  });

  it('returns empty string for nullish or digit-free input', () => {
    expect(toWhatsAppDigits(null)).toBe('');
    expect(toWhatsAppDigits(undefined)).toBe('');
    expect(toWhatsAppDigits('')).toBe('');
    expect(toWhatsAppDigits('  ')).toBe('');
  });
});

describe('buildWhatsAppLink', () => {
  it('builds a wa.me link from the digits', () => {
    expect(buildWhatsAppLink('+525555555555')).toBe('https://wa.me/525555555555');
    expect(buildWhatsAppLink('+52 55 5555 5555')).toBe('https://wa.me/525555555555');
  });

  it('returns null when there are no digits', () => {
    expect(buildWhatsAppLink(null)).toBeNull();
    expect(buildWhatsAppLink('')).toBeNull();
    expect(buildWhatsAppLink('no digits here')).toBeNull();
  });
});

describe('formatWhatsAppDisplay', () => {
  it('formats Mexican numbers as +52 AA BBBB CCCC', () => {
    expect(formatWhatsAppDisplay('+525555555555')).toBe('+52 55 5555 5555');
    expect(formatWhatsAppDisplay('525512345678')).toBe('+52 55 1234 5678');
  });

  it('formats generic international numbers readably', () => {
    expect(formatWhatsAppDisplay('+14155550123')).toBe('+1 415 555 0123');
  });

  it('returns empty string for nullish input', () => {
    expect(formatWhatsAppDisplay(null)).toBe('');
    expect(formatWhatsAppDisplay(undefined)).toBe('');
    expect(formatWhatsAppDisplay('')).toBe('');
  });

  it('falls back to the trimmed raw value when there are no digits', () => {
    expect(formatWhatsAppDisplay('  contact us  ')).toBe('contact us');
  });
});
