import { describe, it, expect } from 'vitest';
import { z } from 'astro/zod';
import { cmsOptional, cmsOptionalUrl, horaireSlot, jourSchema } from './cmsFields';

describe('cmsOptional', () => {
  const schema = cmsOptional(z.string().max(5));
  it('keeps valid values', () => {
    expect(schema.parse('abc')).toBe('abc');
  });
  it('normalizes a cleared field (empty string) to undefined', () => {
    expect(schema.parse('')).toBeUndefined();
  });
  it('accepts a missing key', () => {
    expect(schema.parse(undefined)).toBeUndefined();
  });
  it('normalizes a bare YAML key (null) to undefined', () => {
    expect(schema.parse(null)).toBeUndefined();
  });
  it('still rejects invalid values', () => {
    expect(() => schema.parse('too long')).toThrow();
  });
  // parse(undefined) is not enough: in zod v4 a missing OBJECT KEY only
  // passes if the field schema is .optional() — this is what broke the
  // CI build on legacy events without a `link` key.
  it('makes the key optional inside an object schema', () => {
    expect(z.object({ f: schema }).parse({})).toEqual({});
  });
});

describe('cmsOptionalUrl', () => {
  it('normalizes a cleared field to undefined', () => {
    expect(cmsOptionalUrl().parse('')).toBeUndefined();
    expect(cmsOptionalUrl().parse(null)).toBeUndefined();
  });
  it('still rejects a malformed URL', () => {
    expect(() => cmsOptionalUrl().parse('pas-une-url')).toThrow();
  });
});

describe('horaireSlot', () => {
  it('keeps a valid slot', () => {
    expect(horaireSlot.parse('10h00 – 12h30')).toBe('10h00 – 12h30');
  });
  it('normalizes empty, null and missing to null (« fermé »)', () => {
    expect(horaireSlot.parse('')).toBeNull();
    expect(horaireSlot.parse(null)).toBeNull();
    expect(horaireSlot.parse(undefined)).toBeNull();
  });
  it('still rejects a malformed slot', () => {
    expect(() => horaireSlot.parse('10h - 12h30')).toThrow();
  });
  it('treats a missing key inside an object schema as « fermé »', () => {
    expect(z.object({ matin: horaireSlot }).parse({})).toEqual({ matin: null });
  });
});

describe('jourSchema', () => {
  const ferme = { matin: null, apresMidi: null };
  it('keeps a full day', () => {
    expect(jourSchema.parse({ matin: '10h00 – 12h30', apresMidi: '14h30 – 18h30' }))
      .toEqual({ matin: '10h00 – 12h30', apresMidi: '14h30 – 18h30' });
  });
  it('fills missing slots within a day', () => {
    expect(jourSchema.parse({ apresMidi: '14h30 – 18h30' }))
      .toEqual({ matin: null, apresMidi: '14h30 – 18h30' });
  });
  // Sveltia's omit_empty_optional_fields drops a fully-empty day object
  // altogether — this is what broke the CI build after the first admin save.
  it('treats a missing day inside an object schema as « fermé »', () => {
    expect(z.object({ lundi: jourSchema }).parse({})).toEqual({ lundi: ferme });
  });
  it('treats a bare null day as « fermé »', () => {
    expect(jourSchema.parse(null)).toEqual(ferme);
  });
});
