import { describe, it, expect } from 'vitest';
import { selectCoupsDeCoeur, selectCoupsDeCoeurPublies } from './coupsDeCoeur';

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

describe('selectCoupsDeCoeurPublies', () => {
  function livre(id: string, ordre: number, titre?: string) {
    return { id, data: { visible: true, ordre, titre } };
  }
  it("exclut les fiches sans titre (ISBN non résolu, spec SP4)", () => {
    const entries = [livre('a', 1, 'Un titre'), livre('b', 2), livre('c', 3, '')];
    expect(selectCoupsDeCoeurPublies(entries).map((e) => e.id)).toEqual(['a']);
  });
  it('conserve le tri et le plafond du sélecteur de base', () => {
    const entries = Array.from({ length: 8 }, (_, i) => livre(`e${i}`, 8 - i, `t${i}`));
    const result = selectCoupsDeCoeurPublies(entries);
    expect(result).toHaveLength(6);
    expect(result[0].id).toBe('e7');
  });
});
