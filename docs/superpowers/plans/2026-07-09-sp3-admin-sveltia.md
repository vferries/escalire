# SP3 — Admin Sveltia CMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Sveltia CMS on `/admin` (GitHub backend, French collections mirroring `src/content.config.ts`), harden the content schemas so no CMS edit can break the build, and document the OAuth-proxy deployment + team procedure.

**Architecture:** Sveltia CMS is a static single-file app vendored at a pinned version (spec § 8 risk table) into `public/admin/`, configured by `public/admin/config.yml` (Decap-compatible). Auth goes through the `sveltia-cms-auth` Cloudflare Worker (spec S3) — its deployment needs Vincent's GitHub/Cloudflare access and is scripted as a runbook (Task 6). Content collections are the interface between CMS and site: a vitest suite locks `config.yml` field-for-field to the Zod schemas, and the schemas are hardened against the ways a CMS writes "empty" (`''`, `null`, missing key). `infos.json`/`textes.json` move from Astro's array-with-id format to plain objects (via a `file()` loader `parser`) because file-collection editors edit one top-level object.

**Tech Stack:** Sveltia CMS **0.170.4** (vendored, `unpkg.com/@sveltia/cms@0.170.4/dist/sveltia-cms.js`) · `sveltia-cms-auth` on Cloudflare Workers (free tier) · `yaml@2.9.0` (devDependency, tests only) · existing Astro 6 + vitest setup.

## Global Constraints

- Branch for this work: `feat/sp3-admin` (create from up-to-date `main`). One PR at the end.
- Site copy French; code/comments/commits English; **no co-author lines** in commits (repo convention).
- Budget 0 € (spec S2/S3): GitHub Pages + Cloudflare Worker free tier. **No secrets in the repo** (spec § 6): OAuth client id/secret live only in the Worker env.
- Sveltia version is **pinned and vendored** (spec § 8): `0.170.4`. Never load `@latest` from a CDN at runtime.
- Base path `/escalire/` (`astro.config.mjs`); content references uploads as `/uploads/...` and components prepend `import.meta.env.BASE_URL` — so `public_folder: /uploads` must stay as is.
- `/admin` protection: `meta robots noindex` in the admin page itself (the effective protection on a project page, cf. DEPLOY.md note), `Disallow: /escalire/admin/` already in `public/robots.txt`, admin absent from `public/sitemap.xml` (already true — verify, don't edit).
- Invalid content must fail the build (spec § 3) — hardening below makes *CMS-shaped emptiness* valid, not *wrong values* valid (a malformed hours string must still fail).
- Windows dev box: shell commands below are Git Bash (`Bash` tool) syntax. Tests: `npm test` (vitest). Build: `npm run build`. Both must be green at the end of every task.
- Acceptance (spec § 5 SP3): a libraire adds a coup de cœur with ISBN and sees it online in < 5 min without help; no write without auth; fields bounded in the CMS itself.

## File Structure

```
public/admin/index.html          ← CMS entry page (noindex, loads vendored bundle)
public/admin/sveltia-cms.js      ← vendored Sveltia 0.170.4 (committed)
public/admin/config.yml          ← backend, media library, 5 collections (FR labels)
src/lib/cmsFields.ts             ← Zod helpers: CMS-safe optional fields + horaire slot
src/lib/cmsFields.test.ts        ← unit tests for the helpers
src/lib/admin.test.ts            ← admin page guards + config.yml ⇆ content.config consistency
src/content.config.ts            ← use helpers; file() loaders get an object parser
src/content/infos.json           ← array-with-id → plain object
src/content/textes.json          ← array-with-id → plain object
docs/GUIDE-ADMIN.md              ← French step-by-step for the team (+ screenshots)
docs/ADMIN-SETUP.md              ← Vincent's runbook: OAuth app, Worker, invitations, access table
docs/ADMIN.md                    ← pointer to the two docs above
docs/DEPLOY.md                   ← domain-switch checklist gains the admin items
docs/assets/admin/*.png          ← screenshots for the guide (Task 4)
package.json                     ← + yaml devDependency
```

---

### Task 1: CMS-proof content schemas

A CMS writes "empty" three ways: empty string (cleared field), `null`, or missing key. Today `link: ''` or a missing `matin` key would fail the build ("aucune modification admin ne peut casser la mise en page" — ADMIN.md). Also move `infos.json`/`textes.json` to plain-object JSON so a CMS file collection can edit them.

**Files:**
- Create: `src/lib/cmsFields.ts`, `src/lib/cmsFields.test.ts`
- Modify: `src/content.config.ts`, `src/content/infos.json`, `src/content/textes.json`

**Interfaces:**
- Consumes: `HORAIRE_REGEX` from `src/lib/horaires.ts` (unchanged).
- Produces: `cmsOptional(schema: z.ZodString)` → `string | undefined`; `cmsOptionalUrl()` → `string | undefined`; `horaireSlot` → `string | null`. Task 3's consistency test imports `HORAIRE_REGEX` and hardcodes the field lists that this task's schemas define. Entry ids stay `'infos'` / `'textes'` (used by `getEntry('infos', 'infos')` in 6 components — no component change).

- [ ] **Step 0: Create the branch**

```bash
git checkout main && git pull && git checkout -b feat/sp3-admin
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/cmsFields.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { z } from 'astro/zod';
import { cmsOptional, cmsOptionalUrl, horaireSlot } from './cmsFields';

describe('cmsOptional', () => {
  const schema = cmsOptional(z.string().max(5));
  it('keeps valid values', () => {
    expect(schema.parse('abc')).toBe('abc');
  });
  it('normalizes a cleared field (empty string) to undefined', () => {
    expect(schema.parse('')).toBeUndefined();
  });
  it('accepts a missing key', () => {
    expect(schema.parse(undefined)).toBeUndefined();
  });
  it('still rejects invalid values', () => {
    expect(() => schema.parse('too long')).toThrow();
  });
});

describe('cmsOptionalUrl', () => {
  it('normalizes a cleared field to undefined', () => {
    expect(cmsOptionalUrl().parse('')).toBeUndefined();
  });
  it('still rejects a malformed URL', () => {
    expect(() => cmsOptionalUrl().parse('pas-une-url')).toThrow();
  });
});

describe('horaireSlot', () => {
  it('keeps a valid slot', () => {
    expect(horaireSlot.parse('10h00 – 12h30')).toBe('10h00 – 12h30');
  });
  it('normalizes empty, null and missing to null (« fermé »)', () => {
    expect(horaireSlot.parse('')).toBeNull();
    expect(horaireSlot.parse(null)).toBeNull();
    expect(horaireSlot.parse(undefined)).toBeNull();
  });
  it('still rejects a malformed slot', () => {
    expect(() => horaireSlot.parse('10h - 12h30')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/cmsFields.test.ts`
Expected: FAIL — `Cannot find module './cmsFields'` (or equivalent resolution error).

- [ ] **Step 3: Implement the helpers**

Create `src/lib/cmsFields.ts`:

```ts
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
    .transform((v) => (v ? v : undefined));
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/cmsFields.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Rewire content.config.ts**

Replace the full content of `src/content.config.ts` with:

```ts
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { cmsOptional, cmsOptionalUrl, horaireSlot } from './lib/cmsFields';

const evenements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/evenements' }),
  schema: z.object({
    title: z.string().min(1).max(120),
    date: z.coerce.date(),
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

const jour = z.object({ matin: horaireSlot, apresMidi: horaireSlot });

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
    slogan: z.string().max(80),
    sousTitre: z.string().max(120),
    librairieTitre: z.string().max(120),
    librairieP1: z.string(),
    librairieP2: z.string(),
    rayons: z.array(z.string()).min(1),
  }),
});

export const collections = { evenements, coupsDeCoeur, equipe, infos, textes };
```

(Note: the `HORAIRE_REGEX` import moves out of this file — it now lives behind `horaireSlot`.)

- [ ] **Step 6: Convert the JSON files to plain objects**

`src/content/infos.json` — remove the array wrapper and the `"id"` key, keep everything else byte-identical:

```json
{
  "horaires": {
    "lundi": { "matin": null, "apresMidi": null },
    "mardi": { "matin": "10h00 – 12h30", "apresMidi": "14h30 – 18h30" },
    "mercredi": { "matin": "10h00 – 12h30", "apresMidi": "14h30 – 18h30" },
    "jeudi": { "matin": "10h00 – 12h30", "apresMidi": "14h30 – 18h30" },
    "vendredi": { "matin": "10h00 – 12h30", "apresMidi": "14h30 – 18h30" },
    "samedi": { "matin": "10h00 – 12h30", "apresMidi": "14h30 – 18h30" },
    "dimanche": { "matin": null, "apresMidi": null }
  },
  "annonce": "",
  "telephone": "05 62 80 68 50",
  "email": "contact@escalire.fr",
  "adresse": {
    "lignes": ["Centre Commercial Espace 61", "61 avenue de Toulouse", "31750 Escalquens"],
    "lat": 43.5155,
    "lng": 1.5487
  },
  "instagram": "https://www.instagram.com/librairie_escalire/",
  "facebook": "https://www.facebook.com/escalirelibrairie",
  "placeDesLibraires": "https://www.placedeslibraires.fr/librairie-6038/escalquens/Escalire/"
}
```

`src/content/textes.json` — same treatment:

```json
{
  "slogan": "des livres qui donnent des ailes",
  "sousTitre": "Librairie indépendante à Escalquens",
  "librairieTitre": "Un lieu pour lire, flâner et se laisser conseiller",
  "librairieP1": "Une sélection de titres dans tous les domaines, choisie et défendue par des libraires qui lisent ce qu'ils conseillent. Littérature en langue étrangère (anglais, espagnol), scolaire et parascolaire, prise de commandes, chèques cadeaux.",
  "librairieP2": "Les commandes sont traitées dans la journée — et un livre coûte le même prix partout, alors autant le choisir chez votre libraire.",
  "rayons": ["Littérature", "Jeunesse", "Bande dessinée", "Policier", "Science-fiction", "Essais", "Pratique", "Voyage", "Beaux-arts", "VO anglais & espagnol"]
}
```

- [ ] **Step 7: Full test suite + build**

Run: `npm test` — Expected: PASS (all suites, including the pre-existing 13+).
Run: `npm run build` — Expected: build completes; no schema errors; same page output as before.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cmsFields.ts src/lib/cmsFields.test.ts src/content.config.ts src/content/infos.json src/content/textes.json
git commit -m "feat: harden content schemas against CMS-written empty values"
```

---

### Task 2: Admin entry page with vendored Sveltia

**Files:**
- Create: `public/admin/index.html`, `public/admin/sveltia-cms.js` (downloaded, committed), `src/lib/admin.test.ts`

**Interfaces:**
- Produces: `/escalire/admin/` page that loads `./sveltia-cms.js` and auto-reads `./config.yml` (created in Task 3 — until then the CMS shows a config error, which is fine). `src/lib/admin.test.ts` is extended (not replaced) by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const adminDir = fileURLToPath(new URL('../../public/admin/', import.meta.url));

describe('admin page', () => {
  const html = () => readFileSync(adminDir + 'index.html', 'utf8');
  it('is excluded from search engines (noindex)', () => {
    expect(html()).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
  it('loads the vendored Sveltia bundle, never a CDN (spec § 8)', () => {
    expect(html()).toContain('<script src="./sveltia-cms.js"></script>');
    expect(html()).not.toMatch(/unpkg|jsdelivr|cdn/);
  });
  it('ships a real bundle, not a placeholder', () => {
    expect(statSync(adminDir + 'sveltia-cms.js').size).toBeGreaterThan(500_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin.test.ts`
Expected: FAIL — ENOENT on `public/admin/index.html`.

- [ ] **Step 3: Vendor the pinned bundle**

```bash
mkdir -p public/admin
curl -fsSL https://unpkg.com/@sveltia/cms@0.170.4/dist/sveltia-cms.js -o public/admin/sveltia-cms.js
ls -l public/admin/sveltia-cms.js   # expect > 1 MB
```

- [ ] **Step 4: Write the admin page**

Create `public/admin/index.html`:

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Administration — Librairie Escalire</title>
    <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <!-- Sveltia CMS 0.170.4, vendored (spec § 8). Update procedure: docs/ADMIN-SETUP.md -->
    <script src="./sveltia-cms.js"></script>
  </body>
</html>
```

(No `type="module"` on the script tag — the Sveltia docs warn it breaks the JS API.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify the build ships the admin**

Run: `npm run build`
Expected: build OK, then `ls dist/admin/` shows `index.html` and `sveltia-cms.js`.

- [ ] **Step 7: Commit**

```bash
git add public/admin/index.html public/admin/sveltia-cms.js src/lib/admin.test.ts
git commit -m "feat: serve vendored Sveltia CMS 0.170.4 on /admin with noindex"
```

---

### Task 3: CMS configuration (config.yml) locked to the schemas

**Files:**
- Create: `public/admin/config.yml`
- Modify: `src/lib/admin.test.ts` (append a `describe` block), `package.json` (+ `yaml` devDependency)

**Interfaces:**
- Consumes: `HORAIRE_REGEX` from `src/lib/horaires.ts`; the collection folders/files and field names fixed in Task 1.
- Produces: `public/admin/config.yml` with `backend.base_url` placeholder `https://sveltia-cms-auth.A-COMPLETER.workers.dev` — Task 6 replaces it with the real Worker URL.

- [ ] **Step 1: Add the yaml devDependency (tests only)**

```bash
npm install -D yaml@2.9.0
```

- [ ] **Step 2: Write the failing consistency tests**

Append to `src/lib/admin.test.ts` (keep existing imports, add `import { parse } from 'yaml';` and `import { HORAIRE_REGEX } from './horaires';`):

```ts
describe('admin config ⇆ content.config consistency', () => {
  const config = parse(readFileSync(adminDir + 'config.yml', 'utf8'));
  const byName = Object.fromEntries(config.collections.map((c: any) => [c.name, c]));
  const names = (fields: any[]) => fields.map((f) => f.name);

  it('targets the GitHub repo on main through an OAuth proxy', () => {
    expect(config.backend).toMatchObject({ name: 'github', repo: 'vferries/escalire', branch: 'main' });
    expect(config.backend.base_url).toMatch(/^https:\/\//);
  });

  it('stores uploads where the site serves them', () => {
    expect(config.media_folder).toBe('public/uploads');
    expect(config.public_folder).toBe('/uploads');
  });

  it('mirrors the coups-de-coeur schema', () => {
    const c = byName['coups-de-coeur'];
    expect(c.folder).toBe('src/content/coups-de-coeur');
    expect(names(c.fields).sort()).toEqual(
      ['isbn13', 'citation', 'libraire', 'visible', 'ordre', 'titre', 'auteur', 'editeur', 'couverture'].sort()
    );
    const isbn = c.fields.find((f: any) => f.name === 'isbn13');
    expect(isbn.pattern[0]).toBe(String.raw`^\d{13}$`);
    const citation = c.fields.find((f: any) => f.name === 'citation');
    expect(citation.maxlength).toBe(200);
  });

  it('mirrors the evenements schema (body extra)', () => {
    const c = byName['evenements'];
    expect(c.folder).toBe('src/content/evenements');
    expect(names(c.fields).sort()).toEqual(
      ['title', 'date', 'type', 'guest', 'image', 'link', 'published', 'body'].sort()
    );
    const type = c.fields.find((f: any) => f.name === 'type');
    expect(type.options.map((o: any) => o.value).sort()).toEqual(
      ['soiree', 'rencontre', 'dedicace', 'lecture', 'atelier', 'autre'].sort()
    );
  });

  it('mirrors the equipe schema', () => {
    const c = byName['equipe'];
    expect(c.folder).toBe('src/content/equipe');
    expect(names(c.fields).sort()).toEqual(['prenom', 'portrait', 'rayon', 'visible', 'ordre'].sort());
  });

  it('edits infos.json with the exact schema fields and hours pattern', () => {
    const f = byName['infos'].files[0];
    expect(f.file).toBe('src/content/infos.json');
    expect(names(f.fields).sort()).toEqual(
      ['horaires', 'annonce', 'telephone', 'email', 'adresse', 'instagram', 'facebook', 'placeDesLibraires'].sort()
    );
    const horaires = f.fields.find((x: any) => x.name === 'horaires');
    expect(names(horaires.fields)).toEqual(
      ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
    );
    for (const jour of horaires.fields) {
      expect(names(jour.fields)).toEqual(['matin', 'apresMidi']);
      for (const creneau of jour.fields) {
        expect(creneau.required).toBe(false);
        expect(creneau.pattern[0]).toBe(HORAIRE_REGEX.source);
      }
    }
  });

  it('edits textes.json with the exact schema fields', () => {
    const f = byName['textes'].files[0];
    expect(f.file).toBe('src/content/textes.json');
    expect(names(f.fields).sort()).toEqual(
      ['slogan', 'sousTitre', 'librairieTitre', 'librairieP1', 'librairieP2', 'rayons'].sort()
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin.test.ts`
Expected: FAIL — ENOENT on `public/admin/config.yml`.

- [ ] **Step 4: Write config.yml**

Create `public/admin/config.yml`:

```yaml
# Sveltia CMS configuration — Escalire admin (SP3).
# Decap-compatible on purpose (spec § 8 fallback). Field lists are locked to
# src/content.config.ts by src/lib/admin.test.ts — update both together.

backend:
  name: github
  repo: vferries/escalire
  branch: main
  # sveltia-cms-auth Cloudflare Worker (docs/ADMIN-SETUP.md § 2) — placeholder
  # until Task 6; login is impossible until this is the real Worker URL.
  base_url: https://sveltia-cms-auth.A-COMPLETER.workers.dev

site_url: https://vferries.github.io/escalire/
display_url: https://vferries.github.io/escalire/

media_folder: public/uploads
public_folder: /uploads

media_libraries:
  default:
    config:
      max_file_size: 5242880 # 5 Mo
      slugify_filename: true
      transformations:
        raster_image:
          format: webp
          quality: 85
          width: 1600
          height: 1600

output:
  omit_empty_optional_fields: true

editor:
  preview: false

collections:
  - name: coups-de-coeur
    label: Coups de cœur
    label_singular: Coup de cœur
    folder: src/content/coups-de-coeur
    create: true
    slug: '{{fields.isbn13}}'
    identifier_field: titre
    summary: '{{fields.titre}} ({{fields.libraire}})'
    sortable_fields: [ordre, titre]
    fields:
      - name: isbn13
        label: ISBN (13 chiffres)
        widget: string
        pattern: ['^\d{13}$', '13 chiffres, sans espaces ni tirets (ex. 9782374912684)']
        hint: Au dos du livre, sous le code-barres. La couverture est récupérée automatiquement.
      - name: citation
        label: Citation du libraire
        widget: text
        maxlength: 200
        hint: 1 à 2 phrases, 200 caractères maximum.
      - name: libraire
        label: Prénom du libraire
        widget: string
        maxlength: 40
      - name: visible
        label: Visible sur le site
        widget: boolean
        default: true
        hint: Le site affiche au plus 6 coups de cœur, dans l'ordre ci-dessous.
      - name: ordre
        label: Ordre d'affichage
        widget: number
        value_type: int
        default: 0
        hint: Du plus petit au plus grand.
      - name: titre
        label: Titre du livre
        widget: string
        required: false
        maxlength: 120
        hint: À remplir pour l'instant (le remplissage automatique depuis l'ISBN arrive plus tard).
      - name: auteur
        label: Auteur / autrice
        widget: string
        required: false
        maxlength: 80
      - name: editeur
        label: Éditeur
        widget: string
        required: false
        maxlength: 60
      - name: couverture
        label: Couverture (secours)
        widget: image
        required: false
        hint: Uniquement si la couverture automatique ne s'affiche pas.

  - name: evenements
    label: Rencontres & événements
    label_singular: Événement
    folder: src/content/evenements
    create: true
    slug: '{{year}}-{{month}}-{{day}}-{{slug}}'
    identifier_field: title
    summary: '{{fields.title}}'
    sortable_fields: [date, title]
    fields:
      - name: title
        label: Titre
        widget: string
        maxlength: 120
        hint: 'Ex. : « Rencontre avec Rouda – Les Jardins perdus ».'
      - name: date
        label: Date et heure
        widget: datetime
        format: 'YYYY-MM-DDTHH:mm:ss'
        hint: Les événements passés sont archivés automatiquement chaque nuit.
      - name: type
        label: Type
        widget: select
        default: rencontre
        options:
          - { value: rencontre, label: Rencontre }
          - { value: dedicace, label: Dédicace }
          - { value: lecture, label: Lecture }
          - { value: atelier, label: Atelier }
          - { value: soiree, label: Soirée }
          - { value: autre, label: Autre }
      - name: guest
        label: Invité·e
        widget: string
        required: false
        maxlength: 80
      - name: image
        label: Affiche
        widget: image
        required: false
      - name: link
        label: Lien externe
        widget: string
        type: url
        required: false
        hint: Billetterie, publication Instagram…
      - name: published
        label: Visible sur le site
        widget: boolean
        default: false
      - name: body
        label: Description
        widget: markdown
        required: false

  - name: equipe
    label: Équipe
    label_singular: Libraire
    folder: src/content/equipe
    create: true
    slug: '{{fields.prenom}}'
    identifier_field: prenom
    summary: '{{fields.prenom}} — {{fields.rayon}}'
    sortable_fields: [ordre, prenom]
    fields:
      - name: prenom
        label: Prénom
        widget: string
        maxlength: 40
      - name: portrait
        label: Portrait
        widget: image
        required: false
        hint: Photo carrée de préférence — elle est affichée en rond.
      - name: rayon
        label: Rayon favori
        widget: string
        maxlength: 60
      - name: visible
        label: Visible sur le site
        widget: boolean
        default: true
      - name: ordre
        label: Ordre d'affichage
        widget: number
        value_type: int
        default: 0

  - name: infos
    label: Horaires & infos pratiques
    files:
      - name: infos
        label: Horaires & infos pratiques
        file: src/content/infos.json
        fields:
          - name: horaires
            label: Horaires d'ouverture
            widget: object
            hint: 'Format : « 10h00 – 12h30 » (tiret demi-cadratin –). Laisser vide si fermé.'
            fields:
              - name: lundi
                label: Lundi
                widget: object
                fields:
                  - name: matin
                    label: Matin
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 10h00 – 12h30 » (espace, tiret –, espace)']
                  - name: apresMidi
                    label: Après-midi
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 14h30 – 18h30 » (espace, tiret –, espace)']
              - name: mardi
                label: Mardi
                widget: object
                fields:
                  - name: matin
                    label: Matin
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 10h00 – 12h30 » (espace, tiret –, espace)']
                  - name: apresMidi
                    label: Après-midi
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 14h30 – 18h30 » (espace, tiret –, espace)']
              - name: mercredi
                label: Mercredi
                widget: object
                fields:
                  - name: matin
                    label: Matin
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 10h00 – 12h30 » (espace, tiret –, espace)']
                  - name: apresMidi
                    label: Après-midi
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 14h30 – 18h30 » (espace, tiret –, espace)']
              - name: jeudi
                label: Jeudi
                widget: object
                fields:
                  - name: matin
                    label: Matin
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 10h00 – 12h30 » (espace, tiret –, espace)']
                  - name: apresMidi
                    label: Après-midi
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 14h30 – 18h30 » (espace, tiret –, espace)']
              - name: vendredi
                label: Vendredi
                widget: object
                fields:
                  - name: matin
                    label: Matin
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 10h00 – 12h30 » (espace, tiret –, espace)']
                  - name: apresMidi
                    label: Après-midi
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 14h30 – 18h30 » (espace, tiret –, espace)']
              - name: samedi
                label: Samedi
                widget: object
                fields:
                  - name: matin
                    label: Matin
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 10h00 – 12h30 » (espace, tiret –, espace)']
                  - name: apresMidi
                    label: Après-midi
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 14h30 – 18h30 » (espace, tiret –, espace)']
              - name: dimanche
                label: Dimanche
                widget: object
                fields:
                  - name: matin
                    label: Matin
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 10h00 – 12h30 » (espace, tiret –, espace)']
                  - name: apresMidi
                    label: Après-midi
                    widget: string
                    required: false
                    pattern: ['^\d{2}h\d{2} – \d{2}h\d{2}$', 'Format : « 14h30 – 18h30 » (espace, tiret –, espace)']
          - name: annonce
            label: Annonce exceptionnelle
            widget: string
            required: false
            maxlength: 160
            hint: 'Affichée en bandeau sur le site si non vide. Ex. : « Fermé le 15 août ».'
          - name: telephone
            label: Téléphone
            widget: string
          - name: email
            label: Email
            widget: string
            type: email
          - name: adresse
            label: Adresse (ne pas modifier sans raison)
            widget: object
            collapsed: true
            fields:
              - name: lignes
                label: Lignes d'adresse
                widget: list
                min: 1
              - name: lat
                label: Latitude
                widget: number
                value_type: float
                step: 0.0001
              - name: lng
                label: Longitude
                widget: number
                value_type: float
                step: 0.0001
          - name: instagram
            label: Instagram
            widget: string
            type: url
          - name: facebook
            label: Facebook
            widget: string
            type: url
          - name: placeDesLibraires
            label: Place des Libraires
            widget: string
            type: url

  - name: textes
    label: Textes du site
    files:
      - name: textes
        label: Textes du site
        file: src/content/textes.json
        fields:
          - name: slogan
            label: Slogan (hero)
            widget: string
            maxlength: 80
          - name: sousTitre
            label: Sous-titre (hero)
            widget: string
            maxlength: 120
          - name: librairieTitre
            label: Titre de la section « La librairie »
            widget: string
            maxlength: 120
          - name: librairieP1
            label: Paragraphe 1
            widget: text
          - name: librairieP2
            label: Paragraphe 2
            widget: text
          - name: rayons
            label: Rayons (nuage de la section « La librairie »)
            widget: list
            min: 1
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin.test.ts`
Expected: PASS (3 page tests + 7 consistency tests).

- [ ] **Step 6: Full suite + build**

Run: `npm test` — Expected: all green.
Run: `npm run build` — Expected: OK; `dist/admin/config.yml` present.

- [ ] **Step 7: Commit**

```bash
git add public/admin/config.yml src/lib/admin.test.ts package.json package-lock.json
git commit -m "feat: add Sveltia collections config locked to content schemas"
```

---

### Task 4: Local end-to-end verification + screenshots

Sveltia's local repository workflow (File System Access API, Chrome/Edge only) lets us accept the whole CMS **before** any OAuth deployment: on `localhost` the CMS offers « Work with Local Repository » and writes straight to the working tree.

**Files:**
- Create: `docs/assets/admin/*.png` (screenshots for the Task 5 guide)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: screenshots referenced by `docs/GUIDE-ADMIN.md` as `assets/admin/<name>.png`: `01-accueil.png` (collection list), `02-coup-de-coeur.png` (entry form), `03-enregistrer.png` (save button / toast).

> **Note:** picking the project folder in the native file dialog cannot be automated — this step needs a human at a Chrome window (or the executor with browser tools + Vincent's hand for the dialog). If no desktop Chrome is available, do steps 1–2 and 7 only, record the limitation in the PR description, and let Vincent run steps 3–6 from `docs/ADMIN-SETUP.md § 5`.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). The admin is at `http://localhost:4321/escalire/admin/index.html` (the dev server does not auto-resolve directory indexes under `public/`; production GitHub Pages does).

- [ ] **Step 2: Smoke-check the page**

Open the URL: the Sveltia UI must load (no blank page), show no config error, and list the 5 collections with their French labels. UI language follows the browser locale (French browser → French UI).

- [ ] **Step 3: Enter local repository mode**

Click « Work with Local Repository » / « Utiliser un dépôt local », select `C:\Users\borda\projects\escalire`.

- [ ] **Step 4: Acceptance run — add a coup de cœur**

In « Coups de cœur » → create: isbn13 `9782207116364`, citation `Un test de bout en bout depuis l'admin.`, libraire `Vincent`, titre `Test admin`, visible off. Save. Verify:

```bash
cat src/content/coups-de-coeur/9782207116364.md
```

Expected frontmatter: the exact fields above, `visible: false`, no empty keys. Then check the dev site still renders (entry hidden since `visible: false`) and `npm run build` passes with the CMS-written file.

- [ ] **Step 5: Acceptance run — hours validation**

In « Horaires & infos pratiques », set lundi matin to `10h - 12h` → the CMS must refuse with the French pattern message. Set it to `10h00 – 12h30`, save, verify `git diff src/content/infos.json` shows only that change (plain-object shape intact). Then revert: leave it empty again, save, and confirm the build still passes (null/omitted → « fermé »).

- [ ] **Step 6: Screenshots**

Capture `01-accueil.png`, `02-coup-de-coeur.png` (form of step 4), `03-enregistrer.png` into `docs/assets/admin/`.

- [ ] **Step 7: Clean up the test entry and commit screenshots**

```bash
rm src/content/coups-de-coeur/9782207116364.md
git checkout -- src/content/infos.json
npm test && npm run build
git add docs/assets/admin
git commit -m "docs: add admin screenshots from local CMS run"
```

---

### Task 5: Documentation — team guide + technical runbook

**Files:**
- Create: `docs/GUIDE-ADMIN.md`, `docs/ADMIN-SETUP.md`
- Modify: `docs/ADMIN.md` (pointer at the end), `docs/DEPLOY.md` (domain-switch checklist)

**Interfaces:**
- Consumes: screenshots `docs/assets/admin/*.png` (Task 4; if absent, keep the image lines with a `<!-- TODO capture (Task 4 fallback) -->` comment).
- Produces: `docs/ADMIN-SETUP.md` §§ 1–4 are the exact procedure Task 6 executes.

- [ ] **Step 1: Write the team guide**

Create `docs/GUIDE-ADMIN.md`:

```markdown
# Guide de l'espace d'administration — Librairie Escalire

Ce guide s'adresse à l'équipe de la librairie. Aucune connaissance technique
n'est nécessaire. L'admin fonctionne sur ordinateur et tablette (Chrome,
Firefox, Safari ou Edge récents).

## L'essentiel en 30 secondes

1. Ouvrir **https://vferries.github.io/escalire/admin/**
2. Cliquer sur **« Se connecter avec GitHub »** et entrer son compte GitHub.
3. Choisir un contenu (Coups de cœur, Rencontres…), modifier, **Enregistrer**.
4. Le site se met à jour tout seul en **2 à 5 minutes**.

![Écran d'accueil de l'admin](assets/admin/01-accueil.png)

## Se connecter

- L'accès se fait avec votre **compte GitHub personnel** (créé avec Vincent,
  voir le tableau des accès dans `ADMIN-SETUP.md`).
- Première connexion : GitHub demande d'autoriser « Escalire admin » — cliquer
  sur **Authorize**.
- Mot de passe oublié : « Forgot password? » sur github.com, ou voir Vincent.
- L'interface s'affiche en français si votre navigateur est en français ;
  sinon : icône ⚙ (Réglages) → *Language* → Français.

## Ajouter un coup de cœur

1. Menu **Coups de cœur** → bouton **Créer**.
2. **ISBN** : les 13 chiffres au dos du livre, sous le code-barres, sans
   espaces ni tirets. La couverture est récupérée automatiquement à partir
   de ce numéro.
3. **Citation** : votre mot de libraire, 1 à 2 phrases (200 caractères max).
4. **Titre, auteur, éditeur** : à remplir (le remplissage automatique depuis
   l'ISBN arrivera dans une prochaine étape).
5. **Visible** : coché = affiché sur le site. Le site montre au maximum
   **6 coups de cœur**, du plus petit « ordre » au plus grand.
6. **Enregistrer**.

![Formulaire coup de cœur](assets/admin/02-coup-de-coeur.png)

Si la couverture ne s'affiche pas sur le site après quelques minutes :
vérifier l'ISBN ; en dernier recours, ajouter une photo dans « Couverture
(secours) ».

## Annoncer une rencontre

1. Menu **Rencontres & événements** → **Créer**.
2. Remplir titre, **date et heure**, type, description ; ajouter l'affiche
   (image) et un lien externe si besoin (billetterie, publication Instagram).
3. Cocher **Visible sur le site** puis **Enregistrer**.
4. Le site met en avant le **prochain événement à venir** ; les événements
   passés sont archivés automatiquement chaque nuit — rien à faire.

## Horaires, annonce exceptionnelle, coordonnées

- Menu **Horaires & infos pratiques**.
- Horaires : un créneau s'écrit exactement `10h00 – 12h30` (espace, tiret
  demi-cadratin « – », espace). Laisser vide = fermé. Le formulaire refuse
  tout autre format — copier un créneau existant au besoin.
- **Annonce exceptionnelle** : ex. « Fermé le 15 août » — s'affiche en bandeau
  sur le site tant que le champ n'est pas vide. Penser à le vider ensuite.
- Ne pas toucher au bloc **Adresse** (il pilote la carte).

## Équipe et textes

- **Équipe** : prénom, portrait (photo carrée de préférence, affichée en
  rond), rayon favori, ordre d'affichage.
- **Textes du site** : slogan du haut de page et paragraphes « La librairie »
  — à modifier rarement.

## Enregistrer, et après ?

![Enregistrer](assets/admin/03-enregistrer.png)

- **Enregistrer** publie la modification : elle part sur GitHub et le site se
  reconstruit automatiquement (2 à 5 minutes).
- Si une valeur est refusée (message rouge), c'est le garde-fou du site :
  corriger le champ indiqué — **une modification admin ne peut pas casser le
  site**.
- En cas de doute ou de panne : contacter Vincent. Le site public reste
  toujours en ligne, même si l'admin est indisponible.
```

- [ ] **Step 2: Write the technical runbook**

Create `docs/ADMIN-SETUP.md`:

```markdown
# ADMIN-SETUP.md — Mise en service et exploitation de l'admin (SP3)

Public : mainteneur technique (Vincent). Le guide utilisateur est
`GUIDE-ADMIN.md`. Décisions d'architecture : spec
`superpowers/specs/2026-07-08-site-deploy-admin-design.md` (S3, S4, § 8).

Chaîne d'auth : `/admin` (Sveltia CMS statique) → Worker Cloudflare
`sveltia-cms-auth` (proxy OAuth) → OAuth App GitHub → commits sur
`vferries/escalire` avec le compte GitHub du libraire.

## 1. Créer l'OAuth App GitHub (une fois)

1. https://github.com/settings/applications/new (compte `vferries`)
2. Renseigner :
   - **Application name** : `Escalire admin`
   - **Homepage URL** : `https://vferries.github.io/escalire/`
   - **Authorization callback URL** : `https://<WORKER>/callback` — l'URL
     exacte du Worker n'est connue qu'après l'étape 2 ; mettre un placeholder
     et revenir la corriger.
3. **Register application**, puis **Generate a new client secret**. Noter
   Client ID et Client Secret (coffre partagé — jamais dans le dépôt).

## 2. Déployer le Worker sveltia-cms-auth (une fois)

Option A (bouton) : https://github.com/sveltia/sveltia-cms-auth → « Deploy to
Cloudflare Workers ». Option B (CLI) :

```bash
git clone https://github.com/sveltia/sveltia-cms-auth.git
cd sveltia-cms-auth
npx wrangler login
npx wrangler deploy
```

Puis, dans le dashboard Cloudflare (Workers → sveltia-cms-auth → Settings →
Variables) :

| Variable | Valeur | Chiffrée |
|---|---|---|
| `GITHUB_CLIENT_ID` | Client ID de l'étape 1 | non |
| `GITHUB_CLIENT_SECRET` | Client Secret de l'étape 1 | **oui (Encrypt)** |
| `ALLOWED_DOMAINS` | `vferries.github.io` | non |

Récupérer l'URL du Worker (`https://sveltia-cms-auth.<sous-domaine>.workers.dev`)
et reporter `https://<WORKER>/callback` dans l'OAuth App (étape 1).

## 3. Brancher le CMS sur le Worker

Dans `public/admin/config.yml`, remplacer le placeholder :

```yaml
backend:
  base_url: https://sveltia-cms-auth.<sous-domaine>.workers.dev
```

Commit + push : le déploiement GitHub Pages suit (< 5 min).

## 4. Inviter les libraires (2–4 comptes)

1. Chaque libraire crée un compte GitHub personnel (email pro de préférence),
   avec **2FA activée** (Settings → Password and authentication).
2. Dépôt `vferries/escalire` → Settings → Collaborators → **Add people** →
   rôle **Write** (= rôle unique « éditeur », cf. ADMIN.md).
3. Le libraire accepte l'invitation (email), puis se connecte sur
   `/escalire/admin/` — vérifier ensemble un premier coup de cœur
   (GUIDE-ADMIN.md), chronomètre en main : **< 5 min** saisie → en ligne.

### Tableau des accès

| Prénom | Compte GitHub | Rôle | 2FA | Invité le |
|---|---|---|---|---|
| Vincent | `vferries` | owner | oui | — |
| _à compléter_ | | Write | | |

Écart assumé (spec S4) : auth par comptes GitHub et non par magic link
(ADMIN.md § Utilisateurs) — pas de backend d'auth possible à budget 0.

## 5. Travailler en local (test / dépannage)

`npm run dev` puis http://localhost:4321/escalire/admin/index.html →
« Work with Local Repository » (Chrome/Edge uniquement) → choisir le dossier
du dépôt. Les enregistrements écrivent directement dans l'arbre de travail,
sans OAuth ni commit : idéal pour tester `config.yml`.

## 6. Mettre à jour Sveltia (version figée, spec § 8)

Le bundle est vendorisé dans `public/admin/sveltia-cms.js` (v0.170.4).

```bash
npm view @sveltia/cms version        # dernière version
curl -fsSL https://unpkg.com/@sveltia/cms@<VERSION>/dist/sveltia-cms.js \
  -o public/admin/sveltia-cms.js
npm test                             # garde-fous page + config
```

Tester en local (§ 5) avant de pousser. En cas de régression Sveltia : la
config est compatible Decap CMS (bascule possible en changeant le script).

## 7. Récupération d'accès / incidents

- Libraire bloqué (mot de passe, 2FA) : récupération standard GitHub ; en
  dernier recours Vincent retire le collaborateur et le réinvite.
- Worker indisponible : l'admin ne permet plus de se connecter, **le site
  public reste en ligne** ; vérifier le dashboard Cloudflare (quota gratuit).
- Secret OAuth compromis : régénérer le Client Secret (OAuth App) et mettre à
  jour la variable chiffrée du Worker.

## 8. Bascule escalire.fr

Voir la checklist de `DEPLOY.md` — côté admin : `site_url`/`display_url` dans
`config.yml`, et ajouter `escalire.fr` à `ALLOWED_DOMAINS` du Worker.
```

- [ ] **Step 3: Point ADMIN.md at the implementation**

Append at the end of `docs/ADMIN.md`:

```markdown

## Implémentation (2026-07, SP3)

Admin en production : Sveltia CMS sur `/admin` (backend GitHub). Guide de
l'équipe : `GUIDE-ADMIN.md`. Mise en service, accès et exploitation :
`ADMIN-SETUP.md`. Écart assumé vs § Utilisateurs : auth par comptes GitHub,
pas de magic link (spec S4).
```

- [ ] **Step 4: Extend the DEPLOY.md domain-switch checklist**

In `docs/DEPLOY.md`, replace the line:

```markdown
- [ ] Bascule escalire.fr : régénérer `robots.txt` (Disallow: /admin/) et `sitemap.xml` (URLs racine), ajuster `site`/`base` dans `astro.config`
```

with:

```markdown
- [ ] Bascule escalire.fr : régénérer `robots.txt` (Disallow: /admin/) et `sitemap.xml` (URLs racine), ajuster `site`/`base` dans `astro.config`, mettre à jour `site_url`/`display_url` dans `public/admin/config.yml` et ajouter `escalire.fr` à `ALLOWED_DOMAINS` du Worker OAuth (cf. ADMIN-SETUP.md § 8)
```

- [ ] **Step 5: Commit**

```bash
git add docs/GUIDE-ADMIN.md docs/ADMIN-SETUP.md docs/ADMIN.md docs/DEPLOY.md
git commit -m "docs: add admin user guide and technical runbook"
```

---

### Task 6: OAuth proxy, PR, and production acceptance (with Vincent)

Steps 1, 4 and 5 need Vincent's GitHub/Cloudflare credentials — the executor must **stop and ask**, not attempt them.

**Files:**
- Modify: `public/admin/config.yml` (real `base_url`), `docs/ADMIN-SETUP.md` (access table rows)

- [ ] **Step 1: Vincent runs ADMIN-SETUP.md §§ 1–2**

Blocked on user: ask Vincent to create the OAuth App and deploy the Worker (docs written in Task 5), and to report back the Worker URL. Suggest he can paste terminal steps with `! <command>` if he wants them run from the session.

- [ ] **Step 2: Set the real base_url**

Edit `public/admin/config.yml`: replace `https://sveltia-cms-auth.A-COMPLETER.workers.dev` with the reported Worker URL.

Run: `npm test` — Expected: PASS (the consistency test only checks `https://` shape).

```bash
git add public/admin/config.yml
git commit -m "feat: point admin auth at the deployed OAuth worker"
```

- [ ] **Step 3: Open the PR**

Use superpowers:finishing-a-development-branch. PR `feat/sp3-admin` → `main`, title `feat: Sveltia admin (SP3)`; body summarizes: vendored Sveltia 0.170.4, config locked to schemas by tests, schema hardening, docs, and what remains manual (invitations, acceptance). Merge after review; the Pages deploy runs automatically.

- [ ] **Step 4: Production acceptance (post-merge)**

On https://vferries.github.io/escalire/admin/ :
- login with GitHub succeeds (no write possible without it — acceptance « aucune écriture sans authentification »);
- add a real coup de cœur with ISBN + citation, stopwatch from save to visible on https://vferries.github.io/escalire/ : **< 5 min** (acceptance ADMIN.md);
- an invalid value (ISBN of 12 digits, hours `10h-12h`) is refused **in the form** (acceptance « champs bornés dès le CMS »).

- [ ] **Step 5: Invite the libraires and fill the access table**

Vincent runs ADMIN-SETUP.md § 4 with the team; fill the table in `docs/ADMIN-SETUP.md`, commit:

```bash
git add docs/ADMIN-SETUP.md
git commit -m "docs: record admin access table"
git push
```
