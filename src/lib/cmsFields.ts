import { z } from 'astro/zod';
import { HORAIRE_REGEX } from './horaires';

/**
 * Optional string field written by the CMS: a cleared field may come back as
 * '', null (a bare YAML key with no value, e.g. `guest:`) or the key may be
 * omitted entirely — all three normalize to undefined so the components'
 * truthiness checks (d.titre, d.image…) keep working, while a non-empty
 * value is still validated by the wrapped schema.
 *
 * `.optional()` must stay OUTERMOST: with zod v4 (Astro 6), a union that
 * merely accepts undefined does not make the object key optional — a missing
 * key then fails with "Required" (only reproducible with a cold content
 * cache: delete .astro/ AND node_modules/.astro/ to re-validate everything).
 */
export function cmsOptional(schema: z.ZodString) {
  return z
    .union([schema, z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional();
}

export const cmsOptionalUrl = () => cmsOptional(z.string().url());

/**
 * One opening-hours slot: a valid « 10h00 – 12h30 » string, or ''/null/missing
 * all meaning « fermé ». Output is always string | null — the shape
 * lib/horaires.ts (type Jour) expects. Same zod v4 caveat as cmsOptional:
 * key-optionality comes from `.optional()`, not from accepting undefined.
 */
export const horaireSlot = z
  .union([
    z.string().regex(HORAIRE_REGEX, 'Format attendu : « 10h00 – 12h30 » (tiret demi-cadratin)'),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((v) => (v ? v : null));
