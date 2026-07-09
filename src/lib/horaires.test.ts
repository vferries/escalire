import { describe, it, expect } from 'vitest';
import { groupHoraires, HORAIRE_REGEX, type Jour } from './horaires';

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

describe('HORAIRE_REGEX', () => {
  it('accepte le format avec tiret demi-cadratin', () => {
    expect(HORAIRE_REGEX.test('10h00 – 12h30')).toBe(true);
  });

  it('rejette un format sans minutes', () => {
    expect(HORAIRE_REGEX.test('10h-12h30')).toBe(false);
  });

  it('rejette un trait d\'union à la place du tiret demi-cadratin', () => {
    expect(HORAIRE_REGEX.test('10h00 - 12h30')).toBe(false);
  });
});
