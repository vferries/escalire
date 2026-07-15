export type Jour = { matin: string | null; apresMidi: string | null };

// Single source of truth for the hours format, used both in content.config.ts
// (Zod validation) and in horaires.test.ts. Separator is space + en-dash
// (U+2013) + space, matching the mockup and infos.json.
const HORAIRE_CORE = String.raw`\d{2}h\d{2} – \d{2}h\d{2}`;
export const HORAIRE_REGEX = new RegExp(`^${HORAIRE_CORE}$`);

// CMS-side variant: Sveltia tests `pattern` even on empty optional fields
// (validateScalarField runs the regex unconditionally), so closed days must
// match too. Empty string only — a JSON null becomes the string "null" in
// Sveltia's draft and must keep failing loudly rather than pass silently.
export const HORAIRE_CMS_PATTERN = `^(${HORAIRE_CORE})?$`;

export const JOURS = [
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
] as const;

export type NomJour = (typeof JOURS)[number];

function texteJour(j: Jour): string {
  if (j.matin && j.apresMidi) return `${j.matin} / ${j.apresMidi}`;
  return j.matin ?? j.apresMidi ?? 'fermé';
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Groups consecutive days with identical hours. The week is treated as
 * cyclic so "closed Sunday + closed Monday" collapses into a single
 * trailing row (« Dimanche & lundi »), matching the mockup.
 */
export function groupHoraires(
  horaires: Record<NomJour, Jour>
): { label: string; jours: NomJour[]; texte: string }[] {
  const groups: { jours: NomJour[]; texte: string }[] = [];
  for (const jour of JOURS) {
    const texte = texteJour(horaires[jour]);
    const last = groups[groups.length - 1];
    if (last && last.texte === texte) last.jours.push(jour);
    else groups.push({ jours: [jour], texte });
  }
  // cyclic merge: last group (ending Sunday) absorbs the leading Monday group
  if (groups.length > 1 && groups[0].texte === groups[groups.length - 1].texte) {
    const first = groups.shift()!;
    groups[groups.length - 1].jours.push(...first.jours);
  }
  return groups.map((g) => {
    let label: string;
    if (g.jours.length === 1) label = cap(g.jours[0]);
    else if (g.jours.length === 2) label = `${cap(g.jours[0])} & ${g.jours[1]}`;
    else label = `${cap(g.jours[0])} — ${cap(g.jours[g.jours.length - 1])}`;
    return { label, jours: g.jours, texte: g.texte };
  });
}
