import { describe, expect, it } from 'vitest';

import { formatExtraPrice } from './extraPriceLabel';

describe('formatExtraPrice', () => {
  it('formats a total-type extra as a flat leading-plus dollar amount', () => {
    expect(formatExtraPrice({ price: 140, priceType: 'total', perPersonSuffix: '/ person' })).toBe(
      '+$140'
    );
  });

  it('formats a perPerson-type extra by appending the localized suffix (en)', () => {
    expect(
      formatExtraPrice({ price: 20, priceType: 'perPerson', perPersonSuffix: '/ person' })
    ).toBe('+$20 / person');
  });

  it('formats a perPerson-type extra with the Spanish suffix', () => {
    expect(
      formatExtraPrice({ price: 20, priceType: 'perPerson', perPersonSuffix: '/ persona' })
    ).toBe('+$20 / persona');
  });

  it('handles a zero price edge for both types', () => {
    expect(formatExtraPrice({ price: 0, priceType: 'total', perPersonSuffix: '/ person' })).toBe(
      '+$0'
    );
    expect(
      formatExtraPrice({ price: 0, priceType: 'perPerson', perPersonSuffix: '/ persona' })
    ).toBe('+$0 / persona');
  });

  it('never renders decimals for whole-dollar prices', () => {
    const result = formatExtraPrice({ price: 95, priceType: 'total', perPersonSuffix: '/ person' });

    expect(result).toBe('+$95');
    expect(result).not.toContain('.');
  });
});
