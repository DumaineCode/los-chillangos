import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { focalToObjectPosition } from '../../lib/media/focal';

// ---------------------------------------------------------------------------
// FocalPreviewField component test (FR-16).
//
// The field reads focalX/focalY/alt live via useField and the saved image url
// via useDocumentInfo().savedDocumentData. We mock @payloadcms/ui with a
// hoisted, mutable state object so we can drive both the live focal change and
// the unsaved (no-url) empty state. The expected object-position is computed
// with the REAL shared helper — proving the preview never does its own math.
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({
  fields: {} as Record<string, unknown>,
  savedDocumentData: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@payloadcms/ui', () => ({
  useField: ({ path }: { path: string }) => ({ value: state.fields[path] }),
  useDocumentInfo: () => ({ savedDocumentData: state.savedDocumentData }),
}));

// Imported AFTER the mock so the component binds to the mocked hooks.
import FocalPreviewField from './FocalPreviewField';

function setState(opts: {
  focalX?: number | null;
  focalY?: number | null;
  alt?: string;
  url?: string | null;
}) {
  state.fields.focalX = opts.focalX ?? null;
  state.fields.focalY = opts.focalY ?? null;
  state.fields.alt = opts.alt ?? '';
  state.savedDocumentData = opts.url === undefined ? undefined : { url: opts.url };
}

afterEach(() => {
  state.fields = {};
  state.savedDocumentData = undefined;
  vi.clearAllMocks();
});

describe('FocalPreviewField (FR-16)', () => {
  it('renders four crop frames cropped by the shared helper from the focal point', () => {
    setState({ focalX: 80, focalY: 20, url: '/media/x.jpg' });
    const { container } = render(<FocalPreviewField />);

    const imgs = container.querySelectorAll('[data-testid="focal-preview"] img');
    expect(imgs).toHaveLength(4);

    const expected = focalToObjectPosition(80, 20);
    expect(expected).toBe('80% 20%');
    for (const img of imgs) {
      expect(img).toHaveStyle({ objectPosition: expected });
      expect(img).toHaveStyle({ objectFit: 'cover' });
    }
  });

  it('exposes the four canonical frames including a circular (round) one', () => {
    setState({ focalX: 50, focalY: 50, url: '/media/x.jpg' });
    const { container } = render(<FocalPreviewField />);

    expect(container.querySelectorAll('[data-frame]')).toHaveLength(4);
    expect(container.querySelector('[data-frame="wide"]')).not.toBeNull();
    expect(container.querySelector('[data-frame="portrait"]')).not.toBeNull();
    expect(container.querySelector('[data-frame="round"]')).not.toBeNull();
    expect(container.querySelector('[data-frame="square"]')).not.toBeNull();
  });

  it('defaults every frame to 50% 50% for null focal', () => {
    setState({ focalX: null, focalY: null, url: '/media/x.jpg' });
    const { container } = render(<FocalPreviewField />);

    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img).toHaveStyle({ objectPosition: '50% 50%' });
    }
  });

  it('updates live (A→B) when the focal point changes, with no save/refetch', () => {
    setState({ focalX: 10, focalY: 10, url: '/media/x.jpg' });
    const { container, rerender } = render(<FocalPreviewField />);

    expect(container.querySelector('img')).toHaveStyle({ objectPosition: '10% 10%' });

    // The focal selector moves — useField now returns B on the next render.
    state.fields.focalX = 90;
    state.fields.focalY = 35;
    rerender(<FocalPreviewField />);

    const imgs = container.querySelectorAll('img');
    for (const img of imgs) {
      expect(img).toHaveStyle({ objectPosition: '90% 35%' });
    }
  });

  it('shows a graceful Spanish empty state when there is no url (unsaved upload)', () => {
    setState({ focalX: 80, focalY: 20, url: undefined });
    const { container, queryByText } = render(<FocalPreviewField />);

    // No broken <img>, no crash.
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(queryByText(/Guarda la imagen para previsualizar el encuadre/i)).not.toBeNull();
  });
});
