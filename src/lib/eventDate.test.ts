import { describe, it, expect } from 'vitest';
import { formatEventDate } from './eventDate';

describe('formatEventDate', () => {
  const date = new Date('2026-10-06T19:00:00');

  it('formats a capitalised French date without the year by default', () => {
    expect(formatEventDate(date)).toBe('Mardi 6 octobre');
  });

  it('appends the year when asked', () => {
    expect(formatEventDate(date, true)).toBe('Mardi 6 octobre 2026');
  });

  it('never shows the time — free-text “horaire” field owns that display', () => {
    expect(formatEventDate(date, true)).not.toMatch(/\d{2}:\d{2}/);
  });
});
