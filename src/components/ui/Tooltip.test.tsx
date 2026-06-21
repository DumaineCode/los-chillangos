import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Tooltip } from './Tooltip';

/**
 * Accessibility-first behavioral tests for the ⓘ Tooltip.
 *
 * We assert SEMANTIC behavior (roles, aria wiring, keyboard) — never CSS
 * classes. The disclaimer must be reachable by keyboard and exposed to
 * assistive tech via aria-describedby.
 */
describe('Tooltip', () => {
  it('renders a focusable trigger button with an accessible label', () => {
    render(<Tooltip content="Just your group." label="More info about Private tour" />);

    const trigger = screen.getByRole('button', { name: 'More info about Private tour' });
    expect(trigger).toBeInTheDocument();
    // Buttons are focusable by default — assert it is NOT removed from tab order.
    expect(trigger).not.toHaveAttribute('tabindex', '-1');
  });

  it('exposes the disclaimer via aria-describedby when opened', () => {
    render(<Tooltip content="Just your group." label="More info" />);

    const trigger = screen.getByRole('button', { name: 'More info' });
    // Closed: no tooltip in the accessibility tree.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(trigger);

    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Just your group.');
    // The trigger points at the tooltip element by id.
    expect(trigger).toHaveAttribute('aria-describedby', tip.id);
  });

  it('toggles open on click (mobile tap) and closed again', () => {
    render(<Tooltip content="Tap content." label="info" />);
    const trigger = screen.getByRole('button', { name: 'info' });

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tap content.');

    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<Tooltip content="Esc content." label="info" />);
    const trigger = screen.getByRole('button', { name: 'info' });

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('hides on blur', () => {
    render(<Tooltip content="Blur content." label="info" />);
    const trigger = screen.getByRole('button', { name: 'info' });

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
