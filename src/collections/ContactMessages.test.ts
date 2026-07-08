import type { TextField } from 'payload';
import { describe, expect, it } from 'vitest';

import { ContactMessages } from './ContactMessages';

// ---------------------------------------------------------------------------
// ContactMessages — core contact-form record fields.
//
// The collection stores public contact submissions (name/email/message/status).
// There are no rental-inquiry fields: rentals are a CMS-driven price list on the
// home, not a per-bike inquiry, so nothing carries a bike slug here.
// ---------------------------------------------------------------------------

type NamedField = TextField & { admin?: { readOnly?: boolean } };

function namedField(name: string): NamedField {
  const field = ContactMessages.fields.find((f): f is NamedField => 'name' in f && f.name === name);
  if (!field) throw new Error(`field "${name}" not found on ContactMessages`);
  return field;
}

describe('ContactMessages', () => {
  it('keeps the core required fields intact', () => {
    expect(namedField('name').required).toBe(true);
    expect(namedField('email').required).toBe(true);
    expect(namedField('message').required).toBe(true);
  });

  it('no longer defines rental/accessories inquiry fields', () => {
    const names = ContactMessages.fields
      .filter((f): f is NamedField => 'name' in f)
      .map((f) => f.name);
    expect(names).not.toContain('rental');
    expect(names).not.toContain('accessories');
  });
});
