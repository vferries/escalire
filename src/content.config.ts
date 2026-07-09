import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { HORAIRE_REGEX } from './lib/horaires';

const evenements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/evenements' }),
  schema: z.object({
    title: z.string().min(1).max(120),
    date: z.coerce.date(),
    type: z.enum(['soiree', 'rencontre', 'dedicace', 'lecture', 'atelier', 'autre']),
    guest: z.string().max(80).optional(),
    image: z.string().optional(),
    link: z.string().url().optional(),
    published: z.boolean().default(false),
  }),
});

const coupsDeCoeur = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coups-de-coeur' }),
  schema: z.object({
    isbn13: z.string().regex(/^\d{13}$/, 'ISBN13 : 13 chiffres, sans espaces ni tirets'),
    citation: z.string().min(1).max(200),
    libraire: z.string().min(1).max(40),
    visible: z.boolean().default(true),
    ordre: z.number().int().default(0),
    // filled by the SP4 enrichment bot; hand-entered values always win
    titre: z.string().max(120).optional(),
    auteur: z.string().max(80).optional(),
    editeur: z.string().max(60).optional(),
    couverture: z.string().optional(),
  }),
});

const equipe = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/equipe' }),
  schema: z.object({
    prenom: z.string().min(1).max(40),
    portrait: z.string().optional(),
    rayon: z.string().min(1).max(60),
    visible: z.boolean().default(true),
    ordre: z.number().int().default(0),
  }),
});

const horaireSlot = z
  .string()
  .regex(HORAIRE_REGEX, 'Format attendu : « 10h00 – 12h30 » (tiret demi-cadratin)')
  .nullable();
const jour = z.object({ matin: horaireSlot, apresMidi: horaireSlot });

const infos = defineCollection({
  loader: file('./src/content/infos.json'),
  schema: z.object({
    horaires: z.object({
      lundi: jour, mardi: jour, mercredi: jour, jeudi: jour,
      vendredi: jour, samedi: jour, dimanche: jour,
    }),
    annonce: z.string().max(160).default(''),
    telephone: z.string().min(1),
    email: z.string().email(),
    adresse: z.object({
      lignes: z.array(z.string()).min(1),
      lat: z.number(),
      lng: z.number(),
    }),
    instagram: z.string().url(),
    facebook: z.string().url(),
    placeDesLibraires: z.string().url(),
  }),
});

const textes = defineCollection({
  loader: file('./src/content/textes.json'),
  schema: z.object({
    slogan: z.string().max(80),
    sousTitre: z.string().max(120),
    librairieTitre: z.string().max(120),
    librairieP1: z.string(),
    librairieP2: z.string(),
    rayons: z.array(z.string()).min(1),
  }),
});

export const collections = { evenements, coupsDeCoeur, equipe, infos, textes };
