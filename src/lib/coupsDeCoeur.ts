type Selectable = { data: { visible: boolean; ordre: number } };

export function selectCoupsDeCoeur<T extends Selectable>(entries: T[], max = 6): T[] {
  return entries
    .filter((e) => e.data.visible)
    .sort((a, b) => a.data.ordre - b.data.ordre)
    .slice(0, max);
}
