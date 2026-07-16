import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { cmsOptional, cmsOptionalUrl, jourSchema } from './lib/cmsFields';

const evenements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/evenements' }),
  schema: z.object({
    title: z.string().min(1).max(120),
    date: z.coerce.date(),
    legende: cmsOptional(z.string().max(200)),
    type: z.enum(['soiree', 'rencontre', 'dedicace', 'lecture', 'atelier', 'autre']),
    guest: cmsOptional(z.string().max(80)),
    image: cmsOptional(z.string()),
    link: cmsOptionalUrl(),
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
    titre: cmsOptional(z.string().max(120)),
    auteur: cmsOptional(z.string().max(80)),
    editeur: cmsOptional(z.string().max(60)),
    couverture: cmsOptional(z.string()),
  }),
});

const equipe = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/equipe' }),
  schema: z.object({
    prenom: z.string().min(1).max(40),
    portrait: cmsOptional(z.string()),
    rayon: z.string().min(1).max(60),
    visible: z.boolean().default(true),
    ordre: z.number().int().default(0),
  }),
});

const jour = jourSchema;

// Plain-object JSON (editable as a CMS file collection); the parser restores
// the single-entry array shape Astro's file loader expects.
const singleEntry = (id: string) => (text: string) => [{ id, ...JSON.parse(text) }];

const infos = defineCollection({
  loader: file('./src/content/infos.json', { parser: singleEntry('infos') }),
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
  loader: file('./src/content/textes.json', { parser: singleEntry('textes') }),
  schema: z.object({
    slogan: cmsOptional(z.string().max(80)),
    sousTitre: z.string().max(120),
    librairieTitre: z.string().max(120),
    librairieP1: z.string(),
    librairieP2: z.string(),
    rayons: z.array(z.string()).min(1),
  }),
});

export const collections = { evenements, coupsDeCoeur, equipe, infos, textes };
