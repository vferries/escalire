import { describe, it, expect } from 'vitest';
import { groupHoraires, type Jour } from './horaires';

const ouvert: Jour = { matin: '10h00 – 12h30', apresMidi: '14h30 – 18h30' };
const ferme: Jour = { matin: null, apresMidi: null };

describe('groupHoraires', () => {
  it('groupe la semaine type de la librairie', () => {
    const rows = groupHoraires({
      lundi: ferme, mardi: ouvert, mercredi: ouvert, jeudi: ouvert,
      vendredi: ouvert, samedi: ouvert, dimanche: ferme,
    });
    expect(rows).toEqual([
      {
        label: 'Mardi — Samedi',
        jours: ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
        texte: '10h00 – 12h30 / 14h30 – 18h30',
      },
      { label: 'Dimanche & lundi', jours: ['dimanche', 'lundi'], texte: 'fermé' },
    ]);
  });

  it('gère un jour isolé et une demi-journée', () => {
    const matinSeul: Jour = { matin: '10h00 – 12h30', apresMidi: null };
    const rows = groupHoraires({
      lundi: ferme, mardi: ouvert, mercredi: matinSeul, jeudi: ouvert,
      vendredi: ouvert, samedi: ouvert, dimanche: ferme,
    });
    expect(rows.map((r) => r.label)).toEqual([
      'Mardi', 'Mercredi', 'Jeudi — Samedi', 'Dimanche & lundi',
    ]);
    expect(rows[1].texte).toBe('10h00 – 12h30');
  });
});
