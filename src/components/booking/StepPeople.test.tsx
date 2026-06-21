import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import enMessages from '../../../messages/en.json';
import type { WizardExtra } from './BookingFlow';
import { StepPeople } from './StepPeople';

/**
 * Focused tests for the price label that now sits next to each extra's
 * selection checkbox on wizard step 2. The label reuses `formatExtraPrice`
 * and the localized `common.perPersonShort` suffix so the format matches the
 * tour page exactly (`+$140` for total, `+$20 / person` for perPerson in en).
 */

const totalExtra: WizardExtra = {
  id: 7,
  name: 'Private tour',
  price: 140,
  priceType: 'total',
  disclaimer: 'Just your group.',
};

const perPersonExtra: WizardExtra = {
  id: 9,
  name: 'GoPro footage',
  price: 20,
  priceType: 'perPerson',
  disclaimer: 'One clip per rider.',
};

function renderStep(extras: ReadonlyArray<WizardExtra>) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepPeople
        adults={2}
        teens={0}
        extras={extras}
        selectedExtraIds={[]}
        pricePerAdult={89}
        slotCapacity={8}
        locale="en"
        onAdultsChange={vi.fn()}
        onTeensChange={vi.fn()}
        onToggleExtra={vi.fn()}
      />
    </NextIntlClientProvider>
  );
}

describe('StepPeople extra price label', () => {
  it('renders the flat price for a total-type extra next to its checkbox', () => {
    renderStep([totalExtra]);

    // The extra is still offered as a yes/no checkbox.
    expect(screen.getByRole('checkbox', { name: /private tour/i })).toBeInTheDocument();
    // And now its price is visible AT the row, before any selection.
    expect(screen.getByText('+$140')).toBeInTheDocument();
  });

  it('renders the per-person price with the localized suffix for a perPerson extra', () => {
    renderStep([perPersonExtra]);

    expect(screen.getByRole('checkbox', { name: /gopro footage/i })).toBeInTheDocument();
    expect(screen.getByText('+$20 / person')).toBeInTheDocument();
  });
});
