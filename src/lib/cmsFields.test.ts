import { describe, it, expect } from 'vitest';
import { z } from 'astro/zod';
import { cmsOptional, cmsOptionalUrl, horaireSlot } from './cmsFields';

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
});
