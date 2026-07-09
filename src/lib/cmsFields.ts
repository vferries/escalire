import { z } from 'astro/zod';
import { HORAIRE_REGEX } from './horaires';

/**
 * Optional string field written by the CMS: a cleared field may come back as
 * '' or the key may be omitted entirely — both normalize to undefined so the
 * components' truthiness checks (d.titre, d.image…) keep working, while a
 * non-empty value is still validated by the wrapped schema.
 */
export function cmsOptional(schema: z.ZodString) {
  return z
    .union([schema, z.literal(''), z.undefined()])
    .transform((v) => (v ? v : undefined))
    .optional();
}

export const cmsOptionalUrl = () => cmsOptional(z.string().url());

/**
 * One opening-hours slot: a valid « 10h00 – 12h30 » string, or ''/null/missing
 * all meaning « fermé ». Output is always string | null — the shape
 * lib/horaires.ts (type Jour) expects.
 */
export const horaireSlot = z
  .union([
    z.string().regex(HORAIRE_REGEX, 'Format attendu : « 10h00 – 12h30 » (tiret demi-cadratin)'),
    z.literal(''),
    z.null(),
    z.undefined(),
  ])
  .transform((v) => (v ? v : null));
