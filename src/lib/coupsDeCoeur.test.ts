import { describe, it, expect } from 'vitest';
import { selectCoupsDeCoeur } from './coupsDeCoeur';

function makeEntry(id: string, ordre: number, visible = true) {
  return { id, data: { visible, ordre } };
}

describe('selectCoupsDeCoeur', () => {
  it('exclut les entrées invisibles (visible=false)', () => {
    const entries = [
      makeEntry('a', 1),
      makeEntry('b', 2, false),
      makeEntry('c', 3),
    ];
    const result = selectCoupsDeCoeur(entries);
    expect(result.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('trie par ordre croissant', () => {
    const entries = [
      makeEntry('c', 3),
      makeEntry('a', 1),
      makeEntry('b', 2),
    ];
    const result = selectCoupsDeCoeur(entries);
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('plafonne à 6 entrées quand 7+ sont visibles', () => {
    const entries = Array.from({ length: 8 }, (_, i) => makeEntry(`e${i}`, i));
    const result = selectCoupsDeCoeur(entries);
    expect(result).toHaveLength(6);
    expect(result.map((e) => e.id)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4', 'e5']);
  });

  it('retourne un tableau vide pour une entrée vide', () => {
    expect(selectCoupsDeCoeur([])).toEqual([]);
  });
});
