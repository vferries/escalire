import { describe, it, expect } from 'vitest';
import { partitionEvents, type EventEntry } from './events';
import { eventTypeInfo } from './eventType';

function makeEvent(id: string, date: string, published = true): EventEntry {
  return { id, data: { date: new Date(date), published } } as EventEntry;
}

describe('partitionEvents', () => {
  const now = new Date('2026-06-13T12:00:00');

  it('exclut les brouillons (published=false)', () => {
    const events = [makeEvent('a', '2026-07-01', false)];
    const { upcoming, past } = partitionEvents(events, now);
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(0);
  });

  it('classe les événements futurs dans upcoming, triés par date croissante', () => {
    const events = [
      makeEvent('b', '2026-08-01'),
      makeEvent('a', '2026-07-01'),
    ];
    const { upcoming } = partitionEvents(events, now);
    expect(upcoming.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('classe les événements passés dans past, triés par date décroissante', () => {
    const events = [
      makeEvent('old', '2026-01-01'),
      makeEvent('recent', '2026-05-01'),
    ];
    const { past } = partitionEvents(events, now);
    expect(past.map((e) => e.id)).toEqual(['recent', 'old']);
  });

  it('traite un événement du jour comme à venir', () => {
    const events = [makeEvent('today', '2026-06-13T20:00:00')];
    const { upcoming } = partitionEvents(events, now);
    expect(upcoming.map((e) => e.id)).toEqual(['today']);
  });
});

describe('eventTypeInfo', () => {
  it('connaît le type lecture', () => {
    expect(eventTypeInfo('lecture').label).toBe('Lecture');
  });
  it('retombe sur "Événement" pour un type inconnu', () => {
    expect(eventTypeInfo('nimporte').label).toBe('Événement');
  });
});
