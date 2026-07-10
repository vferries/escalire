type Selectable = { data: { visible: boolean; ordre: number } };

export function selectCoupsDeCoeur<T extends Selectable>(entries: T[], max = 6): T[] {
  return entries
    .filter((e) => e.data.visible)
    .sort((a, b) => a.data.ordre - b.data.ordre)
    .slice(0, max);
}

type CoupDeCoeur = Selectable & { data: { titre?: string } };

/** Spec SP4: a coup de cœur whose ISBN never resolved (no titre) is not published. */
export function selectCoupsDeCoeurPublies<T extends CoupDeCoeur>(entries: T[], max = 6): T[] {
  return selectCoupsDeCoeur(entries.filter((e) => e.data.titre), max);
}
