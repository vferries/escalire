# SP1 — Recréation du site Escalire (Astro) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the Escalire one-page showcase site in Astro (static output), pixel-faithful to the mockup, with content served by typed content collections.

**Architecture:** Astro SSG at the repo root, one page (`src/pages/index.astro`) composed of section components. Content lives in `src/content/` collections (Zod-validated). All visual values come from the readable mockup source `design/escalire-source.html` and `DESIGN.md`. Client-side behavior (reveals, parallax, feathers, Leaflet, intensity setting) is plain vanilla JS in `<script>` tags — no framework islands.

**Tech Stack:** Astro ^6 · Vitest ^4 · Leaflet ^1.9 · @fontsource (Caveat, Cormorant Garamond, EB Garamond) · plain CSS with custom properties (no Tailwind).

**New dependencies introduced by this plan (explicitly flagged):** `astro`, `leaflet`, `@types/leaflet`, `vitest`, `@fontsource/caveat`, `@fontsource/cormorant-garamond`, `@fontsource/eb-garamond`. Nothing else may be added without flagging it.

## Global Constraints

- **Reference files** (read them before any visual task):
  - `design/escalire-source.html` — readable mockup source (1862 lines). THE visual reference. Line numbers cited per task. Inline `style="..."` attributes are the exact values to port; `style-hover="..."` attributes become CSS `:hover` rules.
  - `DESIGN.md` — tokens, typography, effects. On conflict with the mockup, the mockup wins for exact values; DESIGN.md wins for intent.
  - Old repo to reuse from: `/home/vincent/projects/old/escalire-bak` (canonical path).
- **Language:** site copy 100 % French; code, comments, commits in English.
- **Base path:** the site will deploy at `https://vferries.github.io/escalire/`. `astro.config.mjs` sets `base: '/escalire/'` (trailing slash — Astro's `trailingSlash: 'ignore'` default would otherwise leave `BASE_URL` without one and break `${base}asset` joins). EVERY asset URL and internal link in components must be built with `import.meta.env.BASE_URL` (never hardcode `/assets/...`).
- **Node:** >= 22 (`.nvmrc` = `22`).
- **CSS:** design tokens as CSS custom properties in `src/styles/global.css` (`--paper`, `--navy`, …). Component styles in scoped `<style>` blocks in `.astro` files.
- **Animations:** IntersectionObserver + transform/opacity only. Respect `prefers-reduced-motion` AND the client-persisted intensity setting (`immersif`/`equilibre`/`discret`, localStorage key `escalire-animations`).
- **Masks:** tinted artwork = `background-color` + `mask-image` (`feather-mask.png`, `brush-stroke.png`, `ink-splat.png`, `ink-edge.png`). Never recolor bitmaps.
- **Book covers:** `https://images.epagine.fr/{last 3 digits of ISBN}/{ISBN13}_1_75.jpg`, plain `<img>` (no CORS/canvas), typographic navy/cream fallback on 404.
- **Known traps (CLAUDE.md):** torn-paper separators overlap the previous section by −90px (`height:90px; margin:-90px 0 0`; keep section content `position: relative` above them); `scroll-margin-top: 84px` on every section; falling feathers = 3 nested wrappers (fall / sway / tinted feather) — never merge the transforms; NO `overflow: hidden` on `body` (mockup uses `overflow-x: hidden` on body — keep exactly that, nothing more).
- **Events frontmatter dates** are tz-less local timestamps (`2026-03-27T19:30:00`), parsed as UTC by YAML; all date formatting/grouping uses UTC accessors (see `src/lib/eventDate.ts` doc comment). Do not "fix" this.
- **Test command:** `npx vitest run` (also `npm test`). Build check: `npm run build`.
- **Commits:** one per task, on branch `feat/sp1-site` (created in Task 1). Never commit on `main`. No co-author lines.
- **Binary assets:** after any commit that adds images, run `git status` and verify no image was left untracked.

## File Structure

```
astro.config.mjs, tsconfig.json, package.json, .nvmrc, .gitignore
public/
  assets/            ← copied from design/assets/ (logo, feather, masks, photos)
  uploads/           ← copied from escalire-bak (38 event images)
  favicon.svg
src/
  styles/global.css  ← tokens, resets, fonts, shared keyframes
  content.config.ts  ← 5 collections (evenements, coups-de-coeur, equipe, infos, textes)
  content/
    evenements/*.md      (46 archive files + upcoming ones)
    coups-de-coeur/*.md  (2 entries from the mockup)
    equipe/*.md          (3 placeholders)
    infos.json           (singleton, file loader)
    textes.json          (singleton, file loader)
  lib/
    events.ts + events.test.ts        (ported from escalire-bak)
    eventDate.ts                      (ported verbatim)
    eventType.ts                      (ported, extended + repalette)
    epagine.ts + epagine.test.ts      (new: cover URL builder)
    horaires.ts + horaires.test.ts    (new: schedule grouping + day highlight)
  layouts/Base.astro                  (head, fonts, meta, annonce banner, nav, footer slot wrap)
  components/
    Nav.astro           (fixed nav + progress bar)
    Footer.astro        (footer + intensity setting UI)
    TornEdge.astro      (torn-paper separator)
    Hero.astro
    Librairie.astro
    CoupsDeCoeur.astro + BookCard.astro
    Rencontres.astro
    Equipe.astro
    Infos.astro         (3 cards + Leaflet map)
  scripts/site.js       (reveals, parallax, progress, nav shadow, entrance, feathers, gust, intensity)
  pages/index.astro
```

Rendering rules (spec § 4): max 6 coups de cœur visibles ; une collection sans contenu visible ⇒ section masquée (not rendered) ; Rencontres met en avant le prochain événement à venir.

---

### Task 1: Scaffold Astro project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.nvmrc`, `.gitignore`, `src/pages/index.astro`, `src/styles/global.css` (placeholder)

**Interfaces:**
- Produces: working `npm run build` / `npm run dev`; `import.meta.env.BASE_URL` = `/escalire/`.

- [ ] **Step 1: Create branch**

```bash
cd /home/vincent/projects/escalire
git checkout docs/spec-site-deploy-admin && git checkout -b feat/sp1-site
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "escalire",
  "type": "module",
  "version": "0.0.1",
  "private": true,
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Install dependencies (exact set, nothing more)**

```bash
npm install astro leaflet
npm install -D vitest @types/leaflet
npm install @fontsource/caveat @fontsource/cormorant-garamond @fontsource/eb-garamond
```

- [ ] **Step 4: Write astro.config.mjs**

```js
// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://vferries.github.io',
  // trailing slash required: BASE_URL keeps it, so `${base}assets/...` joins stay valid
  base: '/escalire/',
});
```

- [ ] **Step 5: Write tsconfig.json, .nvmrc, .gitignore**

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`.nvmrc`: `22`

`.gitignore`:
```
node_modules/
dist/
.astro/
```

- [ ] **Step 6: Minimal page**

`src/styles/global.css`: `/* tokens in Task 2 */`

`src/pages/index.astro`:
```astro
---
import '../styles/global.css';
---
<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8" /><title>Librairie Escalire</title></head>
  <body><h1>Escalire</h1></body>
</html>
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: `Complete!` with 1 page built, no errors. Also `npx vitest run` → "No test files found" is acceptable at this stage (exit code may be 1; that's expected until Task 3).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .nvmrc .gitignore src/
git commit -m "feat: scaffold Astro project with base path /escalire"
```

---

### Task 2: Assets, fonts, design tokens

**Files:**
- Create: `public/assets/*` (copies), `public/favicon.svg`
- Modify: `src/styles/global.css`, `src/pages/index.astro` (font imports come later via layout — for now import CSS in the page)

**Interfaces:**
- Produces: CSS custom properties `--paper #faf6ef`, `--paper-card #fffdf8`, `--sky #c9dfed`, `--ink #181a20`, `--night #14161c`, `--navy #2b3f77`, `--blue #4a76b8`, `--blue-light #6aa7cc`, `--red #e8442e`, `--coral #f08a67`, `--text-2 #33363f`, `--text-3 #5a5e69`, `--text-on-dark #c8cad2`; shared keyframes `featherFall`, `featherSway`, `cueBob`, `inkDrift`; utility classes `.container` (max-width 1140px), `.section` (padding 120px 28px, scroll-margin-top 84px, position relative).

- [ ] **Step 1: Copy assets**

```bash
mkdir -p public/assets
cp design/assets/*.png public/assets/
```

- [ ] **Step 2: Favicon**

`public/favicon.svg` — feather silhouette, navy on transparent:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="rotate(-24 50 50)"><ellipse cx="50" cy="50" rx="18" ry="38" fill="#2b3f77"/><line x1="50" y1="18" x2="50" y2="86" stroke="#faf6ef" stroke-width="3"/></g></svg>
```

- [ ] **Step 3: Write global.css**

Port the site CSS block from `design/escalire-source.html` lines 1330–1339 (body reset, `::selection`, the 4 keyframes, Leaflet popup restyle) plus tokens. Complete file:

```css
@import '@fontsource/eb-garamond/400.css';
@import '@fontsource/eb-garamond/400-italic.css';
@import '@fontsource/eb-garamond/500.css';
@import '@fontsource/cormorant-garamond/500.css';
@import '@fontsource/cormorant-garamond/500-italic.css';
@import '@fontsource/cormorant-garamond/600.css';
@import '@fontsource/caveat/500.css';
@import '@fontsource/caveat/600.css';
@import '@fontsource/caveat/700.css';

:root {
  --paper: #faf6ef;
  --paper-card: #fffdf8;
  --sky: #c9dfed;
  --ink: #181a20;
  --night: #14161c;
  --navy: #2b3f77;
  --blue: #4a76b8;
  --blue-light: #6aa7cc;
  --red: #e8442e;
  --coral: #f08a67;
  --text-2: #33363f;
  --text-3: #5a5e69;
  --text-on-dark: #c8cad2;
  --font-display: 'Cormorant Garamond', serif;
  --font-body: 'EB Garamond', serif;
  --font-hand: 'Caveat', cursive;
}

html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden; /* exactly this — never overflow:hidden (feathers rely on vertical overflow) */
}
::selection { background: var(--sky); color: var(--ink); }
p { text-wrap: pretty; }
a { color: var(--navy); }
a:hover { color: var(--red); }

.container { max-width: 1140px; margin: 0 auto; }
.section { padding: 120px 28px; scroll-margin-top: 84px; position: relative; }

@keyframes featherFall { 0% { transform: translateY(-24vh); } 100% { transform: translateY(124vh); } }
@keyframes featherSway { 0% { transform: translateX(-30px) rotate(-14deg); } 50% { transform: translateX(30px) rotate(10deg); } 100% { transform: translateX(-30px) rotate(-14deg); } }
@keyframes cueBob { 0%, 100% { transform: translateY(0); opacity: .55; } 50% { transform: translateY(9px); opacity: 1; } }
@keyframes inkDrift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(2.5%, 3.5%) scale(1.07); } }

#map-escalire .leaflet-popup-content-wrapper,
#map-escalire .leaflet-popup-tip { background: var(--paper-card); color: var(--text-2); font-family: var(--font-body); }
```

Check `featherSway`'s exact 100% frame against line 1335 of the source and match it.

- [ ] **Step 4: Verify build + tracked assets**

Run: `npm run build` → success. Run `git status` → all 8 PNGs under `public/assets/` listed (untracked, about to be added). None missing.

- [ ] **Step 5: Commit**

```bash
git add public/ src/styles/global.css
git commit -m "feat: add design tokens, self-hosted fonts and static assets"
```

---

### Task 3: Event logic library (ported from escalire-bak)

**Files:**
- Create: `src/lib/events.ts`, `src/lib/events.test.ts`, `src/lib/eventDate.ts`, `src/lib/eventType.ts`

**Interfaces:**
- Produces: `partitionEvents<T>(events: T[], now: Date): { upcoming: T[]; past: T[] }` (filters `data.published`, upcoming ascending, past descending); `formatEventDate(date: Date, withYear?: boolean): string` (French, UTC, capitalized); `EVENT_TYPES` map + `eventTypeInfo(type: string): { label: string; color: string }`.

- [ ] **Step 1: Copy logic + tests verbatim from the old repo**

```bash
mkdir -p src/lib
cp /home/vincent/projects/old/escalire-bak/src/lib/events.ts src/lib/
cp /home/vincent/projects/old/escalire-bak/src/lib/events.test.ts src/lib/
cp /home/vincent/projects/old/escalire-bak/src/lib/eventDate.ts src/lib/
```

- [ ] **Step 2: Run tests — must pass as-is**

Run: `npx vitest run`
Expected: 4 tests pass (`partitionEvents` suite).

- [ ] **Step 3: Write eventType.ts (extended with `lecture`, repaletted to DESIGN.md)**

New file `src/lib/eventType.ts` (do NOT copy the old one — palette changed):
```ts
export const EVENT_TYPES = {
  soiree:    { label: 'Soirée',     color: '#2b3f77' },
  rencontre: { label: 'Rencontre',  color: '#e8442e' },
  dedicace:  { label: 'Dédicace',   color: '#f08a67' },
  lecture:   { label: 'Lecture',    color: '#6aa7cc' },
  atelier:   { label: 'Atelier',    color: '#4a76b8' },
  autre:     { label: 'Événement',  color: '#5a5e69' },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export function eventTypeInfo(type: string) {
  return EVENT_TYPES[type as EventType] ?? EVENT_TYPES.autre;
}
```

- [ ] **Step 4: Add a test for `lecture` + fallback**

Append to `src/lib/events.test.ts` or create `src/lib/eventType.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { eventTypeInfo } from './eventType';

describe('eventTypeInfo', () => {
  it('connaît le type lecture', () => {
    expect(eventTypeInfo('lecture').label).toBe('Lecture');
  });
  it('retombe sur "Événement" pour un type inconnu', () => {
    expect(eventTypeInfo('nimporte').label).toBe('Événement');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run` → 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/
git commit -m "feat: port event partition/date/type logic from escalire-bak"
```

---

### Task 4: Epagine cover URL + schedule grouping (TDD)

**Files:**
- Create: `src/lib/epagine.ts`, `src/lib/epagine.test.ts`, `src/lib/horaires.ts`, `src/lib/horaires.test.ts`

**Interfaces:**
- Produces: `epagineCoverUrl(isbn13: string): string`; `type Jour = { matin: string | null; apresMidi: string | null }`; `JOURS: readonly ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']`; `groupHoraires(horaires: Record<typeof JOURS[number], Jour>): { label: string; jours: string[]; texte: string }[]`.

- [ ] **Step 1: Write failing epagine tests**

`src/lib/epagine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { epagineCoverUrl } from './epagine';

describe('epagineCoverUrl', () => {
  it('construit l’URL avec les 3 derniers chiffres comme dossier', () => {
    expect(epagineCoverUrl('9782283034873')).toBe(
      'https://images.epagine.fr/873/9782283034873_1_75.jpg'
    );
    expect(epagineCoverUrl('9782374912684')).toBe(
      'https://images.epagine.fr/684/9782374912684_1_75.jpg'
    );
  });
});
```

- [ ] **Step 2: Run → FAIL** (`epagine.ts` missing)

- [ ] **Step 3: Implement**

`src/lib/epagine.ts`:
```ts
export function epagineCoverUrl(isbn13: string): string {
  return `https://images.epagine.fr/${isbn13.slice(-3)}/${isbn13}_1_75.jpg`;
}
```

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Write failing horaires tests**

Behavior: group *consecutive* days sharing identical `(matin, apresMidi)`; the week is cyclic so a closed Sunday merges with a closed Monday into « Dimanche & lundi » rendered last; groups of ≥3 days → « Mardi — Samedi », 2 days → « Dimanche & lundi », 1 day → « Mercredi ». `texte` = `"{matin} / {apresMidi}"`, or the single non-null part, or `"fermé"` when both null.

`src/lib/horaires.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { groupHoraires, type Jour } from './horaires';

const ouvert: Jour = { matin: '10h00 – 12h30', apresMidi: '14h30 – 18h30' };
const ferme: Jour = { matin: null, apresMidi: null };

describe('groupHoraires', () => {
  it('groupe la semaine type de la librairie', () => {
    const rows = groupHoraires({
      lundi: ferme, mardi: ouvert, mercredi: ouvert, jeudi: ouvert,
      vendredi: ouvert, samedi: ouvert, dimanche: ferme,
    });
    expect(rows).toEqual([
      {
        label: 'Mardi — Samedi',
        jours: ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
        texte: '10h00 – 12h30 / 14h30 – 18h30',
      },
      { label: 'Dimanche & lundi', jours: ['dimanche', 'lundi'], texte: 'fermé' },
    ]);
  });

  it('gère un jour isolé et une demi-journée', () => {
    const matinSeul: Jour = { matin: '10h00 – 12h30', apresMidi: null };
    const rows = groupHoraires({
      lundi: ferme, mardi: ouvert, mercredi: matinSeul, jeudi: ouvert,
      vendredi: ouvert, samedi: ouvert, dimanche: ferme,
    });
    expect(rows.map((r) => r.label)).toEqual([
      'Mardi', 'Mercredi', 'Jeudi — Samedi', 'Dimanche & lundi',
    ]);
    expect(rows[1].texte).toBe('10h00 – 12h30');
  });
});
```

- [ ] **Step 6: Run → FAIL**

- [ ] **Step 7: Implement**

`src/lib/horaires.ts`:
```ts
export type Jour = { matin: string | null; apresMidi: string | null };

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
```

- [ ] **Step 8: Run → PASS** (`npx vitest run` → 9 tests green: 4 events + 2 eventType + 1 epagine + 2 horaires)

- [ ] **Step 9: Commit**

```bash
git add src/lib/epagine.ts src/lib/epagine.test.ts src/lib/horaires.ts src/lib/horaires.test.ts
git commit -m "feat: add epagine cover URL builder and schedule grouping"
```

---

### Task 5: Content collections + real content

**Files:**
- Create: `src/content.config.ts`, `src/content/evenements/*.md` (46 files), `src/content/coups-de-coeur/{comme-des-betes,l-autre-femme}.md`, `src/content/equipe/{libraire-1,libraire-2,libraire-3}.md`, `src/content/infos.json`, `src/content/textes.json`, `public/uploads/*` (38 images)

**Interfaces:**
- Produces: collections `evenements`, `coupsDeCoeur`, `equipe`, `infos`, `textes` queryable via `getCollection` / `getEntry`. Consumers use: `getCollection('evenements')` → entries with `data.{title,date,type,guest?,image?,link?,published}`; `getCollection('coupsDeCoeur')` → `data.{isbn13,citation,libraire,visible,ordre,titre?,auteur?,editeur?,couverture?}`; `getEntry('infos','infos')` → `data.{horaires,annonce,telephone,email,instagram,facebook,placeDesLibraires,adresse}`; `getEntry('textes','textes')` → `data.{slogan,sousTitre,librairieTitre,librairieP1,librairieP2,rayons[]}`.

- [ ] **Step 1: Copy archive content + images**

```bash
mkdir -p src/content/evenements
cp /home/vincent/projects/old/escalire-bak/src/content/events/*.md src/content/evenements/
mkdir -p public/uploads
cp /home/vincent/projects/old/escalire-bak/public/uploads/* public/uploads/
```

- [ ] **Step 2: Write content.config.ts**

```ts
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

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

const jour = z.object({ matin: z.string().nullable(), apresMidi: z.string().nullable() });

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
```

- [ ] **Step 3: Write singleton content** (values verbatim from mockup, § 4 of the source map)

`src/content/infos.json`:
```json
[
  {
    "id": "infos",
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
]
```

`src/content/textes.json`:
```json
[
  {
    "id": "textes",
    "slogan": "des livres qui donnent des ailes",
    "sousTitre": "Librairie indépendante à Escalquens",
    "librairieTitre": "Un lieu pour lire, flâner et se laisser conseiller",
    "librairieP1": "Une sélection de titres dans tous les domaines, choisie et défendue par des libraires qui lisent ce qu'ils conseillent. Littérature en langue étrangère (anglais, espagnol), scolaire et parascolaire, prise de commandes, chèques cadeaux.",
    "librairieP2": "Les commandes sont traitées dans la journée — et un livre coûte le même prix partout, alors autant le choisir chez votre libraire.",
    "rayons": ["Littérature", "Jeunesse", "Bande dessinée", "Policier", "Science-fiction", "Essais", "Pratique", "Voyage", "Beaux-arts", "VO anglais & espagnol"]
  }
]
```

`src/content/coups-de-coeur/comme-des-betes.md`:
```md
---
isbn13: "9782283034873"
titre: "Comme des bêtes"
auteur: "Violaine Bérot"
editeur: "Buchet-Chastel"
citation: "Âpre et lumineux : la montagne, un homme, des rumeurs. Se dévore d'une traite."
libraire: "la libraire"
visible: true
ordre: 1
---
```

`src/content/coups-de-coeur/l-autre-femme.md`:
```md
---
isbn13: "9782374912684"
titre: "L'Autre Femme"
auteur: "Mercedes Rosende"
editeur: "Quidam"
citation: "Un polar uruguayen drôle et féroce, porté par une héroïne inoubliable."
libraire: "le libraire"
visible: true
ordre: 2
---
```

`src/content/equipe/libraire-1.md` (and -2, -3, adjusting `ordre`):
```md
---
prenom: "Prénom"
rayon: "rayon favori"
visible: true
ordre: 1
---
```

- [ ] **Step 4: Fix archive files that fail validation**

Run: `npm run build`.
The 46 archive files use types from the old enum (`soiree`, `rencontre`, `dedicace`, `atelier`, `autre`) — all present in the new enum, so they should validate unchanged. If any file fails (bad type, malformed date), fix the frontmatter minimally and note it in the commit body.
Expected: build succeeds, log line reports the 5 collections synced.

- [ ] **Step 5: Verify collections are queryable**

Add temporarily to `src/pages/index.astro` frontmatter:
```astro
---
import { getCollection, getEntry } from 'astro:content';
import '../styles/global.css';
const evts = await getCollection('evenements');
const infos = await getEntry('infos', 'infos');
console.log(`evenements: ${evts.length}, tel: ${infos?.data.telephone}`);
---
```
Run: `npm run build` → log shows `evenements: 46, tel: 05 62 80 68 50`. Remove the `console.log` after checking (keep the imports if the next tasks need them).

- [ ] **Step 6: Commit (verify binaries tracked)**

```bash
git add src/content.config.ts src/content/ public/uploads/ src/pages/index.astro
git status   # verify: no untracked .jpg/.png remains under public/uploads
git commit -m "feat: add content collections with archive events and mockup content"
```

---

### Task 6: Base layout, Nav + progress bar, Footer

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`
- Modify: `src/pages/index.astro`

**Reference:** mockup lines 1342 (progress bar), 1344–1355 (nav), 1577–1590 (footer). Port inline styles into scoped `<style>`; every `style-hover` becomes a `:hover` rule.

**Interfaces:**
- Consumes: `getEntry('infos','infos')`, `getEntry('textes','textes')`.
- Produces: `Base.astro` with props `{ title: string; description: string }` and a default slot; renders `<html lang="fr">`, head (charset, viewport, title, description, favicon, canonical via `Astro.site`), annonce banner (only when `infos.data.annonce` non-empty), `<Nav />`, `<slot />`, `<Footer />`, and `<script src="../scripts/site.js">` hook (script file created in Task 10 — until then omit the tag).
- Produces DOM contract for `site.js`: progress bar element `#progress-bar`, nav `#site-nav`, sections with ids `accueil/librairie/coups-de-coeur/evenements/equipe/infos`.

- [ ] **Step 1: Write Nav.astro**

Structure (styles ported from lines 1342–1355):
```astro
---
const base = import.meta.env.BASE_URL;
const links = [
  ['#librairie', 'La librairie'],
  ['#coups-de-coeur', 'Coups de cœur'],
  ['#evenements', 'Rencontres'],
  ['#equipe', "L'équipe"],
  ['#infos', 'Horaires & accès'],
];
---
<div id="progress-bar" aria-hidden="true"></div>
<nav id="site-nav" aria-label="Navigation principale">
  <a href="#accueil" class="nav-logo">
    <img src={`${base}assets/logo-escalire.png`} alt="Librairie Escalire" width="77" height="38" />
  </a>
  <div class="nav-links">
    {links.map(([href, label]) => <a href={href}>{label}</a>)}
  </div>
</nav>
<style>
  #progress-bar {
    position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 40;
    background: linear-gradient(90deg, var(--red), var(--navy) 60%, var(--blue-light));
    transform: scaleX(0); transform-origin: left;
  }
  #site-nav {
    position: fixed; top: 3px; left: 0; right: 0; z-index: 30;
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 28px;
    background: rgba(250, 246, 239, 0.82);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    transition: box-shadow 0.3s ease;
  }
  #site-nav.scrolled { box-shadow: 0 10px 30px rgba(24, 30, 50, 0.08); }
  /* …complete paddings, font-size, letter-spacing, link hover from lines 1344–1355 of design/escalire-source.html… */
</style>
```
The comment above is a pointer for THIS plan only — the implementer must replace it with the actual ported declarations (nav link font `var(--font-body)` 16–17px, `letter-spacing: .04em`, hover color `--red` per `style-hover` attributes at lines 1349–1353; last link styled as a pill CTA if the mockup does so — check line 1353).

- [ ] **Step 2: Write Footer.astro** (lines 1577–1590)

Content: sky background, decorative feather `<img aria-hidden="true">` bottom-right (rotate 26deg, width 140px, opacity .9), logo (height 64px), tagline « Librairie indépendante à Escalquens — Sicoval », links Instagram / Facebook / Place des Libraires / Mentions légales (`https://escalire.fr/MentionsLegales.html`), copyright `© {new Date().getFullYear()} Librairie Escalire — 05 62 80 68 50 — contact@escalire.fr` (build values from `infos` entry, not hardcoded). Also include the animation-intensity control (wired in Task 10):
```astro
<fieldset class="anim-setting">
  <legend>Animations</legend>
  <label><input type="radio" name="intensite" value="immersif" checked /> immersif</label>
  <label><input type="radio" name="intensite" value="equilibre" /> équilibré</label>
  <label><input type="radio" name="intensite" value="discret" /> discret</label>
</fieldset>
```
Style it discreetly (Caveat, small, `--text-2` on sky).

- [ ] **Step 3: Write Base.astro**

```astro
---
import { getEntry } from 'astro:content';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import '../styles/global.css';

interface Props { title: string; description: string }
const { title, description } = Astro.props;
const infos = await getEntry('infos', 'infos');
const annonce = infos?.data.annonce ?? '';
const base = import.meta.env.BASE_URL;
---
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="icon" href={`${base}favicon.svg`} type="image/svg+xml" />
    <link rel="preload" as="image" href={`${base}assets/logo-escalire.png`} />
  </head>
  <body>
    <Nav />
    {annonce && <p class="annonce" role="status">{annonce}</p>}
    <slot />
    <Footer />
  </body>
</html>
```
`.annonce`: full-width banner below the nav (navy background, cream text, Caveat, centered, padding 10px 20px; `margin-top` to clear the fixed nav).

- [ ] **Step 4: Rewrite index.astro to use the layout**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base
  title="Librairie Escalire — librairie indépendante à Escalquens"
  description="Librairie indépendante à Escalquens (Espace 61) : conseils de libraires, commandes dans la journée, rencontres d'auteurs et dédicaces."
>
  <main><!-- sections land here in Tasks 7–9 --></main>
</Base>
```

- [ ] **Step 5: Verify**

Run: `npm run build` → success. Run `npm run dev`, open `http://localhost:4321/escalire/` → nav fixed on top with logo, footer with links, no console error. To verify the annonce banner: temporarily set `"annonce": "test"` in infos.json, check the banner shows, revert to `""`.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/ src/components/ src/pages/index.astro
git commit -m "feat: add base layout, fixed nav with progress bar, footer"
```

---

### Task 7: Hero + torn-edge separator + Librairie section

**Files:**
- Create: `src/components/Hero.astro`, `src/components/TornEdge.astro`, `src/components/Librairie.astro`
- Modify: `src/pages/index.astro`

**Reference:** hero = lines 1357–1380; separator = line 1383; librairie = 1385–1421 of `design/escalire-source.html`. Port ALL inline styles.

**Interfaces:**
- Consumes: `getEntry('textes','textes')` (slogan, sousTitre, librairieTitre, P1, P2, rayons).
- Produces: `TornEdge.astro` props `{ color: string }` → `<div class="torn" style={`background:${color}`}>` with `mask-image: url(...ink-edge.png); mask-size: 100% 100%; height: 90px; margin: -90px 0 0; position: relative; z-index: 2;`. DOM hooks for `site.js`: `#hero-bg` (parallax ×0.14), `#hero-art` (parallax ×0.26), `[data-entrance="0..4"]` items, `#hero-feathers` and `.parallax-feather[data-parallax]` elements, scroll cue `<a href="#librairie" class="scroll-cue">`.

- [ ] **Step 1: Write TornEdge.astro** (as specified above; check exact mask CSS on line 1383)

- [ ] **Step 2: Write Hero.astro**

`<header id="accueil">`, min-height 100vh, background gradient `#d6e7f3 → #c9dfed → #bfd8e9`;
- `#hero-bg`: absolute inset, `inkDrift` halo blobs + static tinted parallax feathers (masked divs, `data-parallax` with factors 0.07–0.16 and `data-rot`), aria-hidden — port blob/feather positions from lines 1358–1364;
- `#hero-feathers`: empty absolute-inset container (falling feathers generated by JS in Task 11);
- `#hero-art`: logo `<img data-entrance="0" src=…logo-escalire.png alt="Librairie Escalire" fetchpriority="high">` (width min(540px, 82vw), drop-shadow from line 1368), sous-titre italique Cormorant (`data-entrance="1"`), slogan Caveat white on brush-stroke mask navy/ink rotated −1.5° (`data-entrance="2"`, port from line 1371: the highlight uses `mask-image: url(assets/brush-stroke.png)` behind white Caveat text), CTA row (`data-entrance="3"`): « Découvrir la librairie » (pill, `--ink` bg, hover `--navy`) + « Horaires & accès » (pill, 1.5px border) linking `#librairie` / `#infos`;
- scroll cue (`data-entrance="4"`): `<a href="#librairie" class="scroll-cue">` text « défiler » uppercase letterspaced + 1px vertical line, `animation: cueBob 2.8s ease-in-out infinite` (port from lines 1825–1844).
Content comes from `textes` (slogan, sousTitre) — not hardcoded.

- [ ] **Step 3: Write Librairie.astro**

`<section id="librairie" class="section">` on `--paper`; 2-col grid `repeat(auto-fit, minmax(320px, 1fr))` gap per line 1390; left: kicker Caveat « la librairie » + H2 `data-reveal="ink-text"` + brush underline `data-reveal="ink"` + P1/P2 `data-reveal="up"` + rayon chips (pill border + 8px color dot, colors from line 1398–1407 — port each chip's dot color); right: 2 polaroids (`--paper-card`, padding 14–16px + 18–20px bottom, radius 6px, shadow `0 22px 44px rgba(24,30,50,.14)`, rotations ±1.6–1.8°) with `<img>` photos `photo-devanture.png` / `photo-interieur.png` (`loading="lazy"`, alt « Devanture de la librairie Escalire » / « Intérieur de la librairie, entre les rayons »), captions Caveat from lines 1413/1417.
Texts from `textes` collection; rayons list rendered from `textes.data.rayons`.

- [ ] **Step 4: Assemble in index.astro**

```astro
<Hero />
<main>
  <TornEdge color="var(--paper)" />
  <Librairie />
</main>
```
(`<main>` starts at librairie as in the mockup, line 1382.)

- [ ] **Step 5: Verify**

`npm run build` → success. Dev server: hero occupies viewport, gradient + logo + slogan on brush stroke visible, separator overlaps hero bottom by 90px with paper-torn edge, librairie section shows text + chips + 2 photos. Compare side-by-side with `design/escalire.html` opened in a browser.

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/pages/index.astro
git commit -m "feat: add hero, torn-edge separator and librairie section"
```

---

### Task 8: Coups de cœur + BookCard with epagine fallback

**Files:**
- Create: `src/components/CoupsDeCoeur.astro`, `src/components/BookCard.astro`
- Modify: `src/pages/index.astro`

**Reference:** lines 1423–1460.

**Interfaces:**
- Consumes: `getCollection('coupsDeCoeur')`, `epagineCoverUrl` from `src/lib/epagine.ts`.
- Produces: section hidden entirely when 0 visible entries; max 6 shown, sorted by `ordre`.

- [ ] **Step 1: Write BookCard.astro**

Props: `{ entry: CollectionEntry<'coupsDeCoeur'> }`. Card: radius 8px, soft shadow, rotation ±1.2–1.4° (alternate sign by index — pass a `flip` prop), cover ~460px tall. Cover `<img>`:
```astro
---
import { epagineCoverUrl } from '../lib/epagine';
const { entry, flip = false } = Astro.props;
const d = entry.data;
const base = import.meta.env.BASE_URL;
const cover = d.couverture ? `${base}${d.couverture.replace(/^\//, '')}` : epagineCoverUrl(d.isbn13);
---
<article class:list={['book-card', { flip }]}>
  <div class="cover">
    <img src={cover} alt={`Couverture du livre ${d.titre ?? ''}`} loading="lazy"
         onerror="this.closest('.cover').classList.add('fallback')" />
    <div class="cover-fallback" aria-hidden="true">
      <strong>{d.titre}</strong><span>{d.auteur}</span>
    </div>
  </div>
  <h3>{d.titre}</h3>
  <p class="meta">{d.auteur} — {d.editeur}</p>
  <p class="citation">« {d.citation} »</p>
  <p class="signature">{d.libraire}</p>
</article>
```
`.cover-fallback`: hidden by default; `.cover.fallback img { display: none }`, `.cover.fallback .cover-fallback { display: flex }` — navy background, cream Cormorant title, centered (the typographic fallback card). Citation in Caveat with the guillemets as in line 1439.

- [ ] **Step 2: Write CoupsDeCoeur.astro**

```astro
---
import { getCollection } from 'astro:content';
import BookCard from './BookCard.astro';
const entries = (await getCollection('coupsDeCoeur', (e) => e.data.visible))
  .sort((a, b) => a.data.ordre - b.data.ordre)
  .slice(0, 6);
---
{entries.length > 0 && (
  <section id="coups-de-coeur" class="section"> … </section>
)}
```
Section: gradient `#e9f1f8 → #dcebf5`; centered kicker « le petit mot du libraire » + H2 « Nos coups de cœur du moment » (`data-reveal="ink-text"` + `data-reveal="ink"` underline); grid of BookCards + the dashed « Et le vôtre ? » card (port texts from lines 1453–1455, dashed border, Caveat note « conseils garantis sans algorithme », decorative feather img rotate 14°); closing line with Place des Libraires link (line 1458, `data-reveal="fade"`) — URL from `infos` collection.

- [ ] **Step 3: Add to index.astro** after Librairie (no TornEdge between librairie and coups-de-cœur — check mockup: separators exist only at lines 1383/1462/1505; librairie→coups-de-cœur has none).

- [ ] **Step 4: Verify**

`npm run build` → success. Dev: 2 book cards with real epagine covers + « Et le vôtre ? ». Test fallback: temporarily break an ISBN's URL in devtools (block request) → typographic navy card appears. Test visibility rule: set both entries `visible: false` → section absent from the HTML; revert.

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/pages/index.astro
git commit -m "feat: add coups-de-coeur section with epagine covers and fallback"
```

---

### Task 9: Rencontres (dark) + Équipe + Infos & Leaflet

**Files:**
- Create: `src/components/Rencontres.astro`, `src/components/Equipe.astro`, `src/components/Infos.astro`
- Modify: `src/pages/index.astro`

**Reference:** rencontres 1464–1503; équipe 1507–1532; infos 1534–1574; Leaflet init 1677–1692.

**Interfaces:**
- Consumes: `partitionEvents`, `formatEventDate`, `eventTypeInfo`, `groupHoraires`, collections `evenements`, `equipe`, `infos`.
- Produces: DOM hooks `#events-feathers` (falling feathers layer, dark palette), `#map-escalire` with `data-lat/data-lng/data-base` attributes, `.horaires-row[data-jours="mardi,…"]` rows for the day highlight.

- [ ] **Step 1: Write Rencontres.astro**

```astro
---
import { getCollection, getEntry } from 'astro:content';
import { partitionEvents } from '../lib/events';
import { formatEventDate } from '../lib/eventDate';
const all = await getCollection('evenements');
const infos = await getEntry('infos', 'infos');
const { upcoming } = partitionEvents(all, new Date());
const next = upcoming[0];
const base = import.meta.env.BASE_URL;
---
```
Section `id="evenements"`, background `--night`, radial glow blobs (lines 1466–1467), parallax feathers + `#events-feathers` container; left column: kicker « rencontres & dédicaces » (coral), H2 light « La librairie reçoit celles et ceux qui écrivent », intro paragraph, 3 bullets (bold lead + description, from lines 1480–1490), 2 pill buttons « Les prochaines dates sur Instagram » / « Facebook » (URLs from `infos`); right column: polaroid —
  - if `next`: affiche `<img src={next.data.image ? base + next.data.image.replace(/^\//,'') : …fallback…} alt={next.data.title} loading="lazy">`, caption Caveat `{formatEventDate(next.data.date, true)} — {next.data.title}`, wrapped in `<a href={next.data.link}>` when link present;
  - else: placeholder polaroid « Prochaine rencontre — affiche à venir » (line 1500).
Note: the build date decides "upcoming" — the daily cron (SP2) keeps it fresh.

- [ ] **Step 2: Write Equipe.astro**

Visible members sorted by `ordre`; section hidden when none (same guard pattern as CoupsDeCoeur). Crème background, centered kicker « derrière le comptoir », H2 « L'équipe », intro from line 1516, grid of round portraits (`border-radius: 50%`, size from lines 1518–1529; portrait img if `portrait` set, else masked-feather placeholder tinted `--sky`) + Caveat caption `{prenom} — {rayon}`.

- [ ] **Step 3: Write Infos.astro**

Section gradient `#f4eee3 → #efe7d8`; kicker « on vous attend », H2 « Infos pratiques »; 3 cards (radius 10px, padding 34px 32px, shadow `0 18px 40px rgba(24,30,50,.10)`):
1. **Horaires** — rows from `groupHoraires(infos.data.horaires)`:
```astro
{rows.map((r) => (
  <div class="horaires-row" data-jours={r.jours.join(',')}>
    <span>{r.label}</span><span>{r.texte}</span>
  </div>
))}
```
plus Caveat note « le samedi, venez tôt pour les nouveautés ! » (from line 1550 — hardcode; it's editorial flavor, not CMS data). `.horaires-row.today { color: var(--red); font-weight: 500; }` (class added client-side in Task 10).
2. **Adresse & contact** — address lines, `tel:` (`+33` + phone without leading 0/spaces, computed in frontmatter), `mailto:`, pill button « Itinéraire » → `https://www.google.com/maps?q=61+avenue+de+Toulouse+31750+Escalquens`.
3. **Bon à savoir** — the 4 bullets from lines 1560–1565 (hardcoded editorial copy).
Map below the cards:
```astro
<div id="map-escalire" data-lat={infos.data.adresse.lat} data-lng={infos.data.adresse.lng} data-base={base}></div>
<p class="map-caption">au centre commercial Espace 61 — parking gratuit devant la porte</p>
```
`#map-escalire { height: 360px; border-radius: 10px; }` (check exact height at line 1570). Leaflet loads lazily in Task 10 — at this point the div is an empty styled box.

- [ ] **Step 4: Assemble index.astro (final section order)**

```astro
<Hero />
<main>
  <TornEdge color="var(--paper)" />
  <Librairie />
  <CoupsDeCoeur />
  <TornEdge color="var(--night)" />
  <Rencontres />
  <TornEdge color="var(--paper)" />
  <Equipe />
  <Infos />
</main>
```

- [ ] **Step 5: Verify**

`npm run build` → success. Dev: dark section shows the next upcoming event from the archive (2026 dates exist — verify which; if all past at run date, placeholder shows: state which case you observed). Horaires card shows « Mardi — Samedi » / « Dimanche & lundi ». Map div renders as an empty rounded box.

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/pages/index.astro
git commit -m "feat: add rencontres, equipe and infos sections"
```

---

### Task 10: Client script — reveals, parallax, progress, Leaflet, intensity setting

**Files:**
- Create: `src/scripts/site.js`
- Modify: `src/layouts/Base.astro` (wire the script + the blocking intensity snippet), `src/components/Footer.astro` (radio wiring is in site.js)

**Reference:** mockup JS lines 1625–1771 (behaviors), 1677–1692 (Leaflet). The mockup's `intensite` was a build-time knob; here it becomes a client setting: localStorage key `escalire-animations` ∈ {`immersif`,`equilibre`,`discret`}, default `immersif`, `prefers-reduced-motion: reduce` defaults to `discret` unless the user explicitly chose otherwise.

**Interfaces:**
- Consumes: DOM hooks produced by Tasks 6–9 (`#progress-bar`, `#site-nav`, `[data-entrance]`, `[data-reveal]`, `[data-parallax]`, `#hero-bg`, `#hero-art`, `#map-escalire`, `.horaires-row[data-jours]`, `input[name="intensite"]`).
- Produces: `document.documentElement.dataset.intensite` set before first paint; `window` scroll/rAF handlers; amplitude function `amp()` → immersif 1 / equilibre 0.5 / discret 0.

- [ ] **Step 1: Blocking intensity snippet in Base.astro `<head>`** (prevents animation flash):

```html
<script is:inline>
  (function () {
    var stored = localStorage.getItem('escalire-animations');
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.dataset.intensite =
      stored || (reduced ? 'discret' : 'immersif');
  })();
</script>
```

- [ ] **Step 2: Write site.js** — one module, structured as:

```js
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const INTENSITES = { immersif: 1, equilibre: 0.5, discret: 0 };
const amp = () => INTENSITES[document.documentElement.dataset.intensite] ?? 1;
```

then the following blocks, each ported from the cited mockup lines (same constants: thresholds, factors, clamps, easings):
1. **Progress bar + nav shadow + hero parallax + per-element parallax** — single passive scroll handler (port lines 1647–1673): `scaleX(min(1, y/max))` on `#progress-bar`; `.scrolled` on `#site-nav` when `y > 12`; `#hero-art` `translateY(y * 0.26 * amp())`, `#hero-bg` `× 0.14`; each `[data-parallax]` `translateY(clamp(y * f * amp(), ±260))` preserving `data-rot` rotation.
2. **Hero entrance** (port lines 1710–1730): sort `[data-entrance]`, opacity 0 + translateY(26px), double-rAF, stagger `90 + i*140` ms, transition `opacity 1s, transform 1.1s cubic-bezier(.22,.61,.21,1)`. With `amp() === 0`, reveal instantly (no transform).
3. **Reveals** (port lines 1732–1770): IO threshold 0.16, one-shot (unobserve). Kinds: `up` translateY(30px×amp, min 12px), `fade`, `ink` scaleX(0) origin left, `ink-text` blur(10px)+translateY, `pop` scale(.3) rotate(-24deg). Respect `data-delay`. Elements already in view (`rect.top <= innerHeight * 0.9`) reveal immediately.
4. **Leaflet, lazy** — IO on `#map-escalire` (rootMargin `400px`), init once on approach (adapted from lines 1677–1692, no polling — leaflet is bundled):
```js
function initMap(el) {
  const pos = [Number(el.dataset.lat), Number(el.dataset.lng)];
  const map = L.map(el, { scrollWheelZoom: false }).setView(pos, 16);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  const icon = L.icon({
    iconUrl: `${el.dataset.base}assets/feather.png`,
    iconSize: [34, 65], iconAnchor: [17, 62], popupAnchor: [0, -58],
  });
  L.marker(pos, { icon }).addTo(map)
    .bindPopup('<b>Librairie Escalire</b><br>Espace 61 — 61 avenue de Toulouse')
    .openPopup();
}
```
5. **Current-day highlight**: today = `new Date().getDay()` mapped to `['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']`; add `.today` to the `.horaires-row` whose `data-jours` list contains it.
6. **Intensity setting UI**: check the footer radio matching `dataset.intensite`; on change → set dataset + `localStorage.setItem('escalire-animations', value)`; feathers layer rebuilds (Task 11 exposes `rebuildFeathers()`; until then just the dataset/storage write).

- [ ] **Step 3: Wire in Base.astro** before `</body>`:

```astro
<script src="../scripts/site.js"></script>
```
(Astro bundles it; `is:inline` NOT used.)

- [ ] **Step 4: Verify**

`npm run dev`: progress bar fills on scroll; nav gains shadow after 12px; hero elements stagger in; H2s do the « ink dries » blur reveal; underlines scaleX in; map initializes when scrolled near, CARTO tiles + feather marker + open popup, wheel doesn't zoom; today's row highlighted in Horaires; switching the footer radio to « discret » kills parallax and reveals become instant, and the choice survives a reload. Set OS `prefers-reduced-motion` (or devtools emulation) + cleared storage → starts in « discret ».
`npm run build` → success.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/site.js src/layouts/Base.astro src/components/Footer.astro
git commit -m "feat: add scroll behaviors, leaflet map and persisted animation intensity"
```

---

### Task 11: Falling feathers + scroll gust

**Files:**
- Modify: `src/scripts/site.js`

**Reference:** mockup lines 1594–1618 (seeds), 1695–1707 (gust), 1785–1823 (3-wrapper DOM). Containers `#hero-feathers` / `#events-feathers` exist since Tasks 7/9.

**Interfaces:**
- Produces: `rebuildFeathers()` called at init and on intensity change.

- [ ] **Step 1: Port seed generation**

`mkSeeds(n, colors)` per mockup lines 1601–1614: left %, fall duration 15–32s, negative delay 0–30s, sway 3.4–7s, width 26–54px, opacity .55–.95, rotation ±40°, depth 0.45–1.4, 30% blurred 1.4px, random flip. Hero: 20 seeds, palette `['#e8442e','#f08a67','#2b3f77','#4a76b8','#6aa7cc','#23252b']`; events: 14 seeds, palette `['#f08a67','#6aa7cc','#c9dfed','#e8442e','#4a76b8','#faf6ef']`.

- [ ] **Step 2: Port the 3-wrapper builder** (lines 1785–1815) — keep the wrappers separate:

```js
function buildFeather(seed, base) {
  const outer = document.createElement('div');      // position + gust translateY
  outer.style.cssText = `position:absolute; top:0; left:${seed.left}%; will-change:transform;`;
  const fall = document.createElement('div');       // linear fall
  fall.style.animation = `featherFall ${seed.dur}s linear ${seed.delay}s infinite`;
  const sway = document.createElement('div');       // sinusoidal sway
  sway.style.animation = `featherSway ${seed.sway}s ease-in-out ${seed.delay}s infinite`;
  const feather = document.createElement('div');    // tinted mask + own rotation
  feather.style.cssText = [
    `width:${seed.w}px`, 'aspect-ratio:636/1220',
    `background:${seed.color}`,
    `-webkit-mask-image:url(${base}assets/feather-mask.png)`,
    `mask-image:url(${base}assets/feather-mask.png)`,
    '-webkit-mask-size:100% 100%', 'mask-size:100% 100%',
    `opacity:${seed.opacity}`,
    `transform:rotate(${seed.rot}deg)${seed.flip ? ' scaleX(-1)' : ''}`,
    seed.blur ? 'filter:blur(1.4px)' : '',
  ].join(';');
  sway.appendChild(feather); fall.appendChild(sway); outer.appendChild(fall);
  return outer;
}
```
Counts scale with intensity: immersif → all (20/14), équilibré → half, discret → none. In équilibré also apply the `soft = 0.6` opacity factor (mockup line 1783).

- [ ] **Step 3: Port the gust loop** (lines 1647–1651 + 1695–1707)

Scroll handler accumulates `gust = clamp(gust + dy * 0.4, ±150)`; rAF loop decays `gust *= 0.9` and applies `translateY(-gust * seed.depth)` to each feather's outer wrapper; loop idles (no rAF) when `amp() === 0` or `|gust| < 0.1`.

- [ ] **Step 4: `rebuildFeathers()`** — clears both containers, rebuilds per current intensity; call it from the intensity radio handler (Task 10 step 6 hook).

- [ ] **Step 5: Verify**

Dev server: feathers fall and sway in hero (mixed palette) and rencontres (light palette on dark); a fast scroll flick makes them drift upward then settle (gust); « équilibré » → fewer, fainter feathers; « discret » → none; `prefers-reduced-motion` → none. CPU stays reasonable (no layout thrash — transforms only). `npm run build` → success.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/site.js
git commit -m "feat: add falling feathers with scroll gust"
```

---

### Task 12: Mobile layout (DESIGN.md-driven — the mockup is desktop-first)

**Files:**
- Modify: every section component's `<style>`, `Nav.astro`, `global.css`

Mobile is NEW DESIGN work guided by DESIGN.md (clamps already handle type scale). Rules to implement at `@media (max-width: 720px)`:
- `.section { padding: 72px 20px; }`
- Nav: keep logo + collapse the 5 links into a horizontally scrollable row (thin, `overflow-x: auto`, no wrap, `-webkit-overflow-scrolling: touch`, edge fade) — no hamburger/JS menu (keeps the one-page anchor UX).
- Hero: logo `min(540px, 82vw)` already scales; stack CTAs vertically at <400px; reduce feather count on narrow screens (≤720px → half, in `mkLayer`).
- Grids: `auto-fit/minmax` already stack; polaroid rotations reduced to ±0.8°; book cover height ~360px.
- Map height 280px; infos cards padding 26px 22px.
- Verify no horizontal scroll at 360px width (devtools).

- [ ] **Step 1: Implement the rules above across components**
- [ ] **Step 2: Verify at 360/414/768/1024/1440 px** — no horizontal overflow, all sections legible, anchors land correctly under the fixed nav (scroll-margin holds).
- [ ] **Step 3: Run `npm run build` + `npx vitest run`** → green.
- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: add mobile layout"
```

---

### Task 13: A11y, perf and final verification

**Files:**
- Modify: `src/layouts/Base.astro`, components as needed

- [ ] **Step 1: A11y pass**
  - Every `<img>` has `alt` (decorative → `alt=""` + `aria-hidden="true"`).
  - Landmarks: single `<h1>` (hero — if the slogan isn't an h1, make the sr-only h1 « Librairie Escalire, librairie indépendante à Escalquens »), sections carry `aria-labelledby` to their H2.
  - Contrast: Caveat kickers on light backgrounds must hit AA — check « la librairie » kicker color (if `--red` on `--paper` fails for its size, darken to `#c73a26` and note the divergence vs mockup in the commit message).
  - Keyboard: nav links, CTAs, intensity radios reachable and visible-focused (`:focus-visible` outline `2px solid var(--navy)`).

- [ ] **Step 2: Perf pass**
  - `<link rel="preload">` logo (done in Task 6) + the Cormorant Garamond 600 woff2 (display font, used by H2s): find the hashed URL Astro emits, or move the two `@import`s for display font to `<link rel="stylesheet">`... simplest reliable approach: keep @fontsource imports and add `font-display: swap` check (fontsource default = swap — verify in built CSS).
  - All below-fold images `loading="lazy"` (covers, photos, affiches, portraits); hero logo `fetchpriority="high"`, NOT lazy.
  - Leaflet must not appear in the initial JS chunk evaluation before the map is near (it's statically imported — acceptable since Astro bundles one deferred module; if the bundle exceeds ~90KB gzip, switch to `const L = await import('leaflet')` inside `initMap` and verify).

- [ ] **Step 3: Full verification**

```bash
npx vitest run     # 9 tests green
npm run build      # zero errors/warnings
npm run preview    # manual pass on http://localhost:4321/escalire/
```
Side-by-side with `design/escalire.html` in the browser: hero, separators overlap, sections, dark section, footer. List every visual divergence found; fix or justify each (DESIGN.md rule: toute divergence doit être justifiée).

- [ ] **Step 4: Invalid-content guard proof** (spec acceptance): put `citation` of 250 chars in a coup-de-cœur → `npm run build` FAILS with an explicit Zod error naming the file/field; revert.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: a11y and performance pass"
```

---

### Task 14: SP1 acceptance check & handoff

- [ ] **Step 1: Re-read spec § SP1 acceptance criteria** (`docs/superpowers/specs/2026-07-08-site-deploy-admin-design.md` lines 82–85) and check each:
  - parité visuelle maquette (desktop + mobile) — from Task 13 evidence
  - contenu modifié dans une collection → visible au build suivant : edit `textes.json` slogan, rebuild, observe change, revert
  - `npm run build` sans erreur
  - logique passé/à-venir couverte par des tests (Task 3)
- [ ] **Step 2: `git status`** — clean tree, no untracked binaries.
- [ ] **Step 3: Do NOT merge.** Report completion; PR to `main` happens via superpowers:finishing-a-development-branch with Vincent.
