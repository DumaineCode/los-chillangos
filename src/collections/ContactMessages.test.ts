import type { TextField } from 'payload';
import { describe, expect, it } from 'vitest';

import { ContactMessages } from './ContactMessages';

// ---------------------------------------------------------------------------
// ContactMessages — rental inquiry display fields (R7).
//
// Slice 3 adds two READ-ONLY admin-display fields so an owner can see which
// bike (and which accessories) an inquiry referenced, without being able to
// edit them — they are a record of what the visitor submitted, persisted by
// the /api/contact route. Per the resolved design default:
//   - rental:      text, admin.readOnly
//   - accessories: text (a readable join of the submitted ids), admin.readOnly
//
// Required behavior of the existing fields (name/email/message/status) is
// unchanged — those keep being required and editable.
// ---------------------------------------------------------------------------

// All the fields under assertion (name/email/message/rental/accessories) are
// text-shaped, so narrowing to a field with a `type` and `name` lets us read
// `type`, `required`, and `admin.readOnly` without fighting the broad Field
// union (which includes UIField, rows, etc. that lack those props).
type NamedField = TextField & { admin?: { readOnly?: boolean } };

function namedField(name: string): NamedField {
  const field = ContactMessages.fields.find(
    (f): f is NamedField => 'name' in f && f.name === name
  );
  if (!field) throw new Error(`field "${name}" not found on ContactMessages`);
  return field;
}

describe('ContactMessages — rental inquiry display fields (R7)', () => {
  it('adds a read-only text "rental" field for the referenced bike slug', () => {
    const rental = namedField('rental');

    expect(rental.type).toBe('text');
    expect(rental.admin?.readOnly).toBe(true);
  });

  it('adds a read-only text "accessories" field for the referenced accessories', () => {
    const accessories = namedField('accessories');

    expect(accessories.type).toBe('text');
    expect(accessories.admin?.readOnly).toBe(true);
  });

  it('keeps the existing required fields intact (no regression)', () => {
    const name = namedField('name');
    const email = namedField('email');
    const message = namedField('message');

    expect(name.required).toBe(true);
    expect(email.required).toBe(true);
    expect(message.required).toBe(true);

    // The new display fields must NOT be required — inquiries and the existing
    // contact form both must succeed without them.
    expect(namedField('rental').required).toBeFalsy();
    expect(namedField('accessories').required).toBeFalsy();
  });
});
