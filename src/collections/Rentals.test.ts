import { describe, expect, it } from 'vitest';
import type { Field } from 'payload';

import { Rentals } from './Rentals';
import { NAV_GROUPS } from '../admin/navGroups';

/**
 * Rentals collection — Phase A config contract.
 *
 * The Rentals collection mirrors the Tours content/i18n/draft policy for a NEW,
 * decoupled bike-rental domain WITHOUT any tour scheduling fields. These tests
 * pin the field shape the spec requires:
 *   - localized copy (name/description/characteristics), NON-localized unique slug
 *   - display-only price (text, verbatim — no pricing engine)
 *   - accessories[] array ON Rentals (name localized, photo→media, price text)
 *   - drafts + livePreview + revalidate hook + NAV_GROUPS.site
 *   - NO tour-specific fields (itinerary/route/seasonal/timeSlots/availableDays/extras)
 *
 * Field lookup walks the flat field list. Rentals keeps a flat shape (no nested
 * tabs/groups for the data namespace), so a top-level `find` by name is enough.
 */

/** Find a top-level field by its `name`. */
function fieldByName(fields: Field[], name: string): Field | undefined {
  return fields.find((f): f is Field => 'name' in f && f.name === name);
}

/** All top-level field names (only fields that carry a `name`). */
function fieldNames(fields: Field[]): string[] {
  return fields.flatMap((f) => ('name' in f && typeof f.name === 'string' ? [f.name] : []));
}

describe('Rentals collection config', () => {
  it('uses the rentals slug and sits under the Website nav group', () => {
    expect(Rentals.slug).toBe('rentals');
    expect(Rentals.admin?.group).toEqual(NAV_GROUPS.site);
  });

  it('enables drafts so the client can stage and publish', () => {
    expect(Rentals.versions).toMatchObject({ drafts: true });
  });

  it('exposes a livePreview URL pointing at the localized /rentals/{slug} route', () => {
    const livePreview = Rentals.admin?.livePreview;
    expect(livePreview).toBeDefined();
    const urlFn = livePreview!.url as (args: unknown) => string;
    expect(urlFn).toBeTypeOf('function');
    const url = urlFn({
      data: { slug: 'urban-cruiser' },
      locale: { code: 'es' },
    });
    expect(url).toContain('path=%2Fes%2Frentals%2Furban-cruiser');
  });

  it('allows public read and gates writes behind an authenticated user', () => {
    expect(Rentals.access?.read?.({} as never)).toBe(true);
    expect(Rentals.access?.create?.({ req: { user: null } } as never)).toBe(false);
    expect(Rentals.access?.create?.({ req: { user: { id: '1' } } } as never)).toBe(true);
  });

  describe('slug field (non-localized, unique, slugified)', () => {
    const slug = () => fieldByName(Rentals.fields as Field[], 'slug');

    it('is a unique, indexed, NON-localized text field', () => {
      const field = slug();
      expect(field).toMatchObject({ type: 'text', unique: true, index: true });
      expect((field as { localized?: boolean }).localized).not.toBe(true);
    });

    it('auto-fills an empty slug from the name via beforeValidate slugify', () => {
      const field = slug() as {
        hooks?: { beforeValidate?: Array<(args: unknown) => unknown> };
      };
      const hook = field.hooks?.beforeValidate?.[0];
      expect(hook).toBeTypeOf('function');
      expect(hook!({ value: '', data: { name: 'Urban Cruiser' } })).toBe('urban-cruiser');
    });

    it('strips accents when slugifying from the name', () => {
      const field = slug() as {
        hooks?: { beforeValidate?: Array<(args: unknown) => unknown> };
      };
      const hook = field.hooks!.beforeValidate![0];
      expect(hook({ value: '', data: { name: 'Montaña Eléctrica' } })).toBe('montana-electrica');
    });

    it('respects an existing manual slug instead of overwriting it', () => {
      const field = slug() as {
        hooks?: { beforeValidate?: Array<(args: unknown) => unknown> };
      };
      const hook = field.hooks!.beforeValidate![0];
      expect(hook({ value: 'custom-slug', data: { name: 'Anything' } })).toBe('custom-slug');
    });

    it('rejects a non-kebab-case slug and accepts a valid one', () => {
      const field = slug() as {
        validate?: (v: string | null | undefined) => true | string;
      };
      expect(field.validate!('Not Valid Slug')).not.toBe(true);
      expect(field.validate!('urban-cruiser')).toBe(true);
    });
  });

  describe('localized copy fields', () => {
    it.each(['name', 'description', 'characteristics'])(
      'marks %s as localized',
      (name) => {
        const field = fieldByName(Rentals.fields as Field[], name);
        expect(field).toMatchObject({ localized: true });
      }
    );
  });

  describe('price field (display-only, verbatim)', () => {
    it('is a text field so the value is stored verbatim with no math', () => {
      const price = fieldByName(Rentals.fields as Field[], 'price');
      expect(price).toMatchObject({ type: 'text' });
    });

    it('is NOT a number field (no pricing-engine coupling)', () => {
      const price = fieldByName(Rentals.fields as Field[], 'price') as { type?: string };
      expect(price.type).not.toBe('number');
    });
  });

  describe('media fields', () => {
    it('has a heroImage upload pointing at the media collection', () => {
      const hero = fieldByName(Rentals.fields as Field[], 'heroImage');
      expect(hero).toMatchObject({ type: 'upload', relationTo: 'media' });
    });

    it('has a gallery array of media uploads', () => {
      const gallery = fieldByName(Rentals.fields as Field[], 'gallery') as {
        type?: string;
        fields?: Field[];
      };
      expect(gallery.type).toBe('array');
      const image = fieldByName(gallery.fields ?? [], 'image');
      expect(image).toMatchObject({ type: 'upload', relationTo: 'media' });
    });
  });

  describe('accessories[] array (on Rentals, separate from Extras)', () => {
    const accessories = () =>
      fieldByName(Rentals.fields as Field[], 'accessories') as {
        type?: string;
        fields?: Field[];
      };

    it('is an array field', () => {
      expect(accessories().type).toBe('array');
    });

    it('has a localized name sub-field', () => {
      const name = fieldByName(accessories().fields ?? [], 'name');
      expect(name).toMatchObject({ type: 'text', localized: true });
    });

    it('has a photo media upload sub-field', () => {
      const photo = fieldByName(accessories().fields ?? [], 'photo');
      expect(photo).toMatchObject({ type: 'upload', relationTo: 'media' });
    });

    it('has an optional display price as TEXT (no pricing-engine number)', () => {
      const price = fieldByName(accessories().fields ?? [], 'price') as {
        type?: string;
        required?: boolean;
      };
      expect(price.type).toBe('text');
      expect(price.required).not.toBe(true);
    });
  });

  describe('no tour-specific fields leak in', () => {
    it.each(['itinerary', 'route', 'seasonal', 'timeSlots', 'availableDays', 'extras', 'usesBikes'])(
      'does not expose the tour field %s',
      (forbidden) => {
        expect(fieldNames(Rentals.fields as Field[])).not.toContain(forbidden);
      }
    );
  });
});
