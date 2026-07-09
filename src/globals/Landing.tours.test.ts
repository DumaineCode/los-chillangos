import { describe, expect, it } from 'vitest';
import type { Field, TabsField, TextField, TextareaField } from 'payload';

import { Landing } from './Landing';

// ---------------------------------------------------------------------------
// Landing `tours` named tab — tours-catalog section HEADER copy.
//
// The tours themselves live in the Tours collection; this tab only edits the
// eyebrow / title / subheading rendered above the catalog grid on the home
// page. Like every Landing section it is a NAMED tab so its data namespaces
// under `landing.tours.*`. All three fields are optional, localized marketing
// copy — empty values fall back to the built-in i18n strings at render time.
// ---------------------------------------------------------------------------

function getTabs(): TabsField {
  const tabsField = Landing.fields.find((f): f is TabsField => f.type === 'tabs');
  if (!tabsField) throw new Error('Landing has no tabs field');
  return tabsField;
}

function getToursTab() {
  const tabs = getTabs();
  const tab = tabs.tabs.find((t) => 'name' in t && t.name === 'tours');
  if (!tab) throw new Error('Landing has no tours tab');
  return tab;
}

function fieldByName(fields: Field[], name: string): Field | undefined {
  return fields.find((f) => 'name' in f && f.name === name);
}

describe('Landing — tours named tab (catalog section header)', () => {
  it('defines a `tours` named tab so its data namespaces under landing.tours', () => {
    const tab = getToursTab();
    expect('name' in tab && tab.name).toBe('tours');
    // Named tab → numbered, localized human label matching the page order.
    expect(tab.label).toEqual({ en: '5. Tours (header)', es: '5. Tours (encabezado)' });
  });

  it('sits between the seasonal and services tabs (page-appearance order)', () => {
    const names = getTabs()
      .tabs.map((t) => ('name' in t ? t.name : null))
      .filter(Boolean);
    const idx = names.indexOf('tours');
    expect(names[idx - 1]).toBe('seasonal');
    expect(names[idx + 1]).toBe('services');
  });

  it('exposes localized, optional eyebrow/title text fields', () => {
    const tab = getToursTab();
    const fields = 'fields' in tab ? tab.fields : [];

    for (const name of ['eyebrow', 'title']) {
      const field = fieldByName(fields, name) as TextField | undefined;
      expect(field, `expected a "${name}" field on the tours tab`).toBeDefined();
      expect(field!.type).toBe('text');
      expect(field!.localized).toBe(true);
      // Optional by design: empty falls back to the built-in i18n copy.
      expect(field!.required).toBeUndefined();
    }
  });

  it('exposes a localized, optional sub textarea field', () => {
    const tab = getToursTab();
    const fields = 'fields' in tab ? tab.fields : [];

    const sub = fieldByName(fields, 'sub') as TextareaField | undefined;
    expect(sub).toBeDefined();
    expect(sub!.type).toBe('textarea');
    expect(sub!.localized).toBe(true);
    expect(sub!.required).toBeUndefined();
  });
});
