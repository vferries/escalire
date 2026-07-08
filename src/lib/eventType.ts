export const EVENT_TYPES = {
  soiree:    { label: 'Soirée',     color: '#2b3f77' },
  rencontre: { label: 'Rencontre',  color: '#e8442e' },
  dedicace:  { label: 'Dédicace',   color: '#f08a67' },
  lecture:   { label: 'Lecture',    color: '#6aa7cc' },
  atelier:   { label: 'Atelier',    color: '#4a76b8' },
  autre:     { label: 'Événement',  color: '#5a5e69' },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export function eventTypeInfo(type: string) {
  return EVENT_TYPES[type as EventType] ?? EVENT_TYPES.autre;
}
