# SP4 — Enrichissement ISBN au build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A coup de cœur entered with only ISBN + citation gets its titre/auteur/éditeur filled automatically at build time (BnF SRU, then Google Books), committed back by a bot; an unresolvable ISBN keeps the entry off the site with a warning, never a broken build.

**Architecture:** One self-contained Node script (`tools/enrich-isbn.mjs`) exports pure, unit-tested functions (parsers, frontmatter injection) plus a `main()` that runs in the deploy workflow before the build; if it changed files, a bot commit with `[skip ci]` pushes them back (anti-loop, spec § 3). Publication rule: the site only renders coups de cœur that have a `titre` — a new `selectCoupsDeCoeurPublies()` wraps the existing selector at the two call sites.

**Tech Stack:** Node 22 built-ins only (global `fetch`, `AbortSignal.timeout`, `node:fs`) — no new dependencies. BnF SRU API (primary, no key), Google Books API (fallback, anonymous — may 429, treated as a miss).

## Global Constraints

- Commits directly on `main`; every push deploys — `npm test` + `npm run build` green before each push. **No Co-Authored-By/trailer lines.** Site copy French; code/comments/commits English.
- Budget 0 € (spec S2): no API keys — Google Books is queried anonymously and its failures (429/network) are soft misses, never build failures.
- Hand-entered values always win (spec S6): the script only fills fields that are missing or empty.
- Unresolvable ISBN → file untouched, entry not published (no `titre`), `::warning::` annotation, **exit code 0** (spec SP4: « build en avertissement, pas en échec »).
- Anti-loop (spec § 3): the bot commit message carries `[skip ci]`; commit happens only if files changed; a failed push is non-fatal (the enriched working tree still gets built and deployed; the commit is retried on the next run).
- Field caps from `src/content.config.ts`: titre ≤ 120, auteur ≤ 80, editeur ≤ 60 — clamp enriched values so the build's Zod validation can never fail on them.
- Real BnF response shape (probed 2026-07-10, ISBN 9782369903086): `<dc:title>La couleur des choses / Martin Panchaud</dc:title>`, `<dc:creator>Panchaud, Martin (1982-....). Auteur du texte</dc:creator>`, `<dc:publisher>Çà et là (Bussy-Saint-Georges)</dc:publisher>` — the fixtures in Task 1 are copied from it, do not "simplify" them.

## File Structure

```
tools/enrich-isbn.mjs             ← parsers + frontmatter injection (exported) + main()
tools/enrich-isbn.test.mjs        ← unit tests with real-shaped fixtures
src/lib/coupsDeCoeur.ts           ← + selectCoupsDeCoeurPublies (titre required)
src/lib/coupsDeCoeur.test.ts      ← + publication-rule tests
src/components/CoupsDeCoeur.astro ← use selectCoupsDeCoeurPublies + build warning
src/components/Nav.astro          ← same selector for the nav link zero-state
.github/workflows/deploy.yml      ← permissions + enrich + bot-commit steps
public/admin/config.yml           ← updated hints for titre/auteur/editeur
docs/GUIDE-ADMIN.md               ← « Ajouter un coup de cœur » step 4 rewritten
docs/DEPLOY.md                    ← runbook: enrichment step + bot commit
```

---

### Task 1: Enrichment script with tested parsers

**Files:**
- Create: `tools/enrich-isbn.mjs`, `tools/enrich-isbn.test.mjs`

**Interfaces:**
- Produces: exported pure functions used by the tests — `parseFrontmatter(md: string): Record<string,string> | null`, `missingFields(fields): string[]`, `parseBnf(xml: string): {titre?, auteur?, editeur?} | null`, `parseGoogleBooks(body: object): {titre?, auteur?, editeur?} | null`, `applyEnrichment(md: string, meta: object, missing: string[]): string`. `main()` is exercised in Task 3, not unit-tested.

- [ ] **Step 1: Write the failing tests**

Create `tools/enrich-isbn.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter, missingFields, parseBnf, parseGoogleBooks, applyEnrichment,
} from './enrich-isbn.mjs';

// Trimmed copy of the real BnF SRU response for ISBN 9782369903086 (2026-07-10).
const BNF_XML = `<?xml version="1.0" encoding="UTF-8"?><srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
<srw:numberOfRecords>1</srw:numberOfRecords>
<srw:records><srw:record><srw:recordData>
<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier>http://catalogue.bnf.fr/ark:/12148/cb471036825</dc:identifier>
  <dc:title>La couleur des choses / Martin Panchaud</dc:title>
  <dc:creator>Panchaud, Martin (1982-....). Auteur du texte</dc:creator>
  <dc:publisher>Çà et là (Bussy-Saint-Georges)</dc:publisher>
  <dc:date>2022</dc:date>
</oai_dc:dc></srw:recordData></srw:record></srw:records></srw:searchRetrieveResponse>`;

const BNF_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
<srw:numberOfRecords>0</srw:numberOfRecords></srw:searchRetrieveResponse>`;

const GOOGLE_JSON = {
  totalItems: 1,
  items: [{ volumeInfo: { title: 'La couleur des choses', authors: ['Martin Panchaud'], publisher: 'Çà et là' } }],
};

const MD = `---
isbn13: "9782369903086"
citation: "Un roman graphique unique."
libraire: "Vincent"
visible: true
ordre: 0
---
`;

describe('parseFrontmatter / missingFields', () => {
  it('reads scalar fields and strips quotes', () => {
    const fields = parseFrontmatter(MD);
    expect(fields.isbn13).toBe('9782369903086');
    expect(fields.libraire).toBe('Vincent');
  });
  it('lists titre/auteur/editeur as missing when absent', () => {
    expect(missingFields(parseFrontmatter(MD))).toEqual(['titre', 'auteur', 'editeur']);
  });
  it('treats an empty value as missing but a filled one as present', () => {
    const fields = parseFrontmatter(`---\nisbn13: "1"\ntitre: ""\nauteur: "Untel"\n---\n`);
    expect(missingFields(fields)).toEqual(['titre', 'editeur']);
  });
  it('returns null without frontmatter', () => {
    expect(parseFrontmatter('pas de frontmatter')).toBeNull();
  });
});

describe('parseBnf', () => {
  it('extracts and normalizes the real BnF record', () => {
    expect(parseBnf(BNF_XML)).toEqual({
      titre: 'La couleur des choses', // « / Martin Panchaud » stripped
      auteur: 'Martin Panchaud',      // « Nom, Prénom (dates). Rôle » reordered
      editeur: 'Çà et là',            // « (Bussy-Saint-Georges) » stripped
    });
  });
  it('returns null when no record matches', () => {
    expect(parseBnf(BNF_EMPTY)).toBeNull();
  });
  it('decodes XML entities in values', () => {
    const xml = BNF_XML.replace('La couleur des choses / Martin Panchaud', 'Choses &amp; couleurs / X');
    expect(parseBnf(xml).titre).toBe('Choses & couleurs');
  });
});

describe('parseGoogleBooks', () => {
  it('extracts title/authors/publisher', () => {
    expect(parseGoogleBooks(GOOGLE_JSON)).toEqual({
      titre: 'La couleur des choses', auteur: 'Martin Panchaud', editeur: 'Çà et là',
    });
  });
  it('returns null on empty results or error payloads', () => {
    expect(parseGoogleBooks({ totalItems: 0 })).toBeNull();
    expect(parseGoogleBooks({ error: { code: 429 } })).toBeNull();
  });
});

describe('applyEnrichment', () => {
  const meta = { titre: 'La couleur des choses', auteur: 'Martin Panchaud', editeur: 'Çà et là' };
  it('inserts missing fields before the closing delimiter, quoted', () => {
    const out = applyEnrichment(MD, meta, ['titre', 'auteur', 'editeur']);
    expect(out).toContain('titre: "La couleur des choses"');
    expect(out).toContain('auteur: "Martin Panchaud"');
    expect(out).toContain('editeur: "Çà et là"');
    expect(out.indexOf('editeur:')).toBeLessThan(out.lastIndexOf('---')); // inside the frontmatter
    expect(out.split('---')).toHaveLength(MD.split('---').length); // no extra delimiter
  });
  it('replaces an existing empty line instead of duplicating it', () => {
    const md = `---\nisbn13: "1"\ntitre: ""\n---\n`;
    const out = applyEnrichment(md, meta, ['titre']);
    expect(out.match(/titre:/g)).toHaveLength(1);
    expect(out).toContain('titre: "La couleur des choses"');
  });
  it('never touches fields that are not listed as missing (hand-entered wins)', () => {
    const md = `---\nisbn13: "1"\ntitre: "Mon titre à moi"\n---\n`;
    const out = applyEnrichment(md, { titre: 'Autre' }, []);
    expect(out).toBe(md);
  });
  it('clamps values to the schema caps and escapes quotes', () => {
    const long = 'x'.repeat(200);
    const out = applyEnrichment(MD, { titre: long, auteur: 'Dit "Le Bref"' }, ['titre', 'auteur']);
    expect(out.match(/titre: "(x+)"/)[1]).toHaveLength(120);
    expect(out).toContain('auteur: "Dit \\"Le Bref\\""');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/enrich-isbn.test.mjs`
Expected: FAIL — cannot resolve `./enrich-isbn.mjs`.

- [ ] **Step 3: Write the script**

Create `tools/enrich-isbn.mjs`:

```js
// Fills titre/auteur/editeur of coups de cœur from their ISBN (spec SP4).
// Sources: BnF SRU (primary), Google Books (anonymous fallback — may 429).
// Hand-entered values always win: only missing/empty fields are filled.
// An unresolvable ISBN leaves the file untouched (the site skips entries
// without titre) and emits a ::warning:: annotation — exit code is always 0.
// Usage: node tools/enrich-isbn.mjs [--dry-run]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = 'src/content/coups-de-coeur';
const CAPS = { titre: 120, auteur: 80, editeur: 60 };
const ENRICHABLE = Object.keys(CAPS);

const clamp = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() : s);
const decodeXml = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

export function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return fields;
}

export function missingFields(fields) {
  return ENRICHABLE.filter((k) => !fields[k]);
}

export function parseBnf(xml) {
  const pick = (tag) => {
    const m = xml.match(new RegExp(`<dc:${tag}[^>]*>([^<]+)</dc:${tag}>`));
    return m ? decodeXml(m[1]).trim() : undefined;
  };
  const rawTitle = pick('title');
  if (!rawTitle) return null;
  const meta = { titre: rawTitle.split(' / ')[0].trim() };
  const rawCreator = pick('creator');
  if (rawCreator) {
    // « Panchaud, Martin (1982-....). Auteur du texte » → « Martin Panchaud »
    const cleaned = rawCreator.split(' (')[0].split(/\.\s/)[0].trim();
    const [nom, prenom] = cleaned.split(',').map((s) => s.trim());
    meta.auteur = prenom ? `${prenom} ${nom}` : nom;
  }
  const rawPublisher = pick('publisher');
  if (rawPublisher) meta.editeur = rawPublisher.split(' (')[0].trim(); // strip the place
  return meta;
}

export function parseGoogleBooks(body) {
  const v = body?.items?.[0]?.volumeInfo;
  if (!v?.title) return null;
  const meta = { titre: v.title };
  if (v.authors?.length) meta.auteur = v.authors.join(', ');
  if (v.publisher) meta.editeur = v.publisher;
  return meta;
}

export function applyEnrichment(md, meta, missing) {
  let out = md;
  for (const key of missing) {
    if (!meta[key]) continue;
    const line = `${key}: "${clamp(meta[key], CAPS[key]).replace(/"/g, '\\"')}"`;
    const existing = new RegExp(`^${key}:.*$`, 'm');
    if (existing.test(out)) out = out.replace(existing, line);
    else out = out.replace(/\r?\n---/, `\n${line}\n---`); // first \n--- = closing delimiter
  }
  return out;
}

const warn = (file, msg) => console.warn(`::warning file=${file}::${msg}`);

async function fetchBnf(isbn) {
  const query = encodeURIComponent(`bib.isbn adj "${isbn}"`);
  const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${query}&recordSchema=dublincore&maximumRecords=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BnF HTTP ${res.status}`);
  return parseBnf(await res.text());
}

async function fetchGoogle(isbn) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=FR`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google Books HTTP ${res.status}`);
  return parseGoogleBooks(await res.json());
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  for (const name of readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()) {
    const path = join(DIR, name);
    const md = readFileSync(path, 'utf8');
    const fields = parseFrontmatter(md);
    if (!fields?.isbn13) continue;
    let missing = missingFields(fields);
    if (missing.length === 0) continue;

    const meta = {};
    for (const source of [fetchBnf, fetchGoogle]) {
      if (missing.every((k) => meta[k])) break;
      try {
        Object.assign(meta, Object.fromEntries(
          Object.entries((await source(fields.isbn13)) ?? {}).filter(([k, v]) => v && !meta[k])
        ));
      } catch (e) {
        warn(path, `${source.name} failed for ISBN ${fields.isbn13}: ${e.message}`);
      }
    }

    const filled = missing.filter((k) => meta[k]);
    if (missing.includes('titre') && !meta.titre) {
      warn(path, `ISBN ${fields.isbn13} introuvable (BnF + Google Books) — fiche non publiée tant que le titre manque.`);
    }
    if (filled.length === 0) continue;
    console.log(`${path}: filled ${filled.join(', ')} (ISBN ${fields.isbn13})${dryRun ? ' [dry-run]' : ''}`);
    if (!dryRun) writeFileSync(path, applyEnrichment(md, meta, missing));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/enrich-isbn.test.mjs` — Expected: PASS (13 tests).

- [ ] **Step 5: Live dry-run sanity check**

Run: `node tools/enrich-isbn.mjs --dry-run`
Expected: no output (all current entries have titre/auteur/editeur) OR `[dry-run]` lines only; exit 0; `git status` clean. Then create a scratch entry and check it resolves:

```bash
printf -- '---\nisbn13: "9782070368228"\ncitation: "test"\nlibraire: "test"\n---\n' > src/content/coups-de-coeur/_scratch.md
node tools/enrich-isbn.mjs --dry-run
rm src/content/coups-de-coeur/_scratch.md
```

Expected: a line `...: filled titre, auteur, editeur (ISBN 9782070368228) [dry-run]` (L'Étranger, Gallimard, via BnF).

- [ ] **Step 6: Full suite + commit + push**

Run: `npm test` (expect all green, including the 12 new) and `npm run build`.

```bash
git add tools/enrich-isbn.mjs tools/enrich-isbn.test.mjs
git commit -m "feat: add ISBN enrichment script (BnF SRU + Google Books fallback)"
git push
```

---

### Task 2: Publication rule — no titre, no card

**Files:**
- Modify: `src/lib/coupsDeCoeur.ts`, `src/components/CoupsDeCoeur.astro:2-6`, `src/components/Nav.astro:2-9`
- Test: `src/lib/coupsDeCoeur.test.ts` (extend)

**Interfaces:**
- Consumes: existing `selectCoupsDeCoeur(entries, max = 6)`.
- Produces: `selectCoupsDeCoeurPublies<T>(entries: T[], max = 6): T[]` — same contract, additionally drops entries whose `data.titre` is empty/undefined. `Equipe.astro`/Nav's equipe line keep using plain `selectCoupsDeCoeur` (équipe entries have no titre — do NOT switch those).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/coupsDeCoeur.test.ts` (add `selectCoupsDeCoeurPublies` to the import):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/coupsDeCoeur.test.ts`
Expected: FAIL — `selectCoupsDeCoeurPublies` is not exported.

- [ ] **Step 3: Implement the selector**

Append to `src/lib/coupsDeCoeur.ts`:

```ts
type CoupDeCoeur = Selectable & { data: { titre?: string } };

/** Spec SP4: a coup de cœur whose ISBN never resolved (no titre) is not published. */
export function selectCoupsDeCoeurPublies<T extends CoupDeCoeur>(entries: T[], max = 6): T[] {
  return selectCoupsDeCoeur(entries.filter((e) => e.data.titre), max);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/coupsDeCoeur.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Switch the two call sites**

`src/components/CoupsDeCoeur.astro` — replace:

```ts
import { selectCoupsDeCoeur } from '../lib/coupsDeCoeur';

const entries = selectCoupsDeCoeur(await getCollection('coupsDeCoeur'));
```

with:

```ts
import { selectCoupsDeCoeurPublies } from '../lib/coupsDeCoeur';

const all = await getCollection('coupsDeCoeur');
const entries = selectCoupsDeCoeurPublies(all);
const sansTitre = all.filter((e) => e.data.visible && !e.data.titre);
if (sansTitre.length > 0) {
  // spec SP4: warning, not failure — the entry stays editable in the CMS
  console.warn(`[coups-de-coeur] fiche(s) sans titre non publiée(s) : ${sansTitre.map((e) => e.id).join(', ')}`);
}
```

`src/components/Nav.astro` — replace:

```ts
import { selectCoupsDeCoeur } from '../lib/coupsDeCoeur';
```

with:

```ts
import { selectCoupsDeCoeur, selectCoupsDeCoeurPublies } from '../lib/coupsDeCoeur';
```

and the coups-de-cœur line:

```ts
const hasCoupsDeCoeur = selectCoupsDeCoeurPublies(await getCollection('coupsDeCoeur')).length > 0;
```

(the `hasEquipe` line keeps `selectCoupsDeCoeur` — équipe entries have no titre.)

- [ ] **Step 6: Full suite + build with a titleless entry**

Run: `npm test` — all green. Then prove the rule end-to-end:

```bash
printf -- '---\nisbn13: "9999999999999"\ncitation: "test"\nlibraire: "test"\nvisible: true\n---\n' > src/content/coups-de-coeur/_sans-titre.md
rm -rf .astro node_modules/.astro
npm run build 2>&1 | grep "sans titre"
grep -c "9999999999999" dist/index.html || echo "0 — absent du site, OK"
rm src/content/coups-de-coeur/_sans-titre.md
```

Expected: the warning line appears; grep count is 0 (build succeeds, entry absent).

- [ ] **Step 7: Commit + push**

```bash
git add src/lib/coupsDeCoeur.ts src/lib/coupsDeCoeur.test.ts src/components/CoupsDeCoeur.astro src/components/Nav.astro
git commit -m "feat: publish only coups de coeur with a resolved title"
git push
```

---

### Task 3: Workflow wiring, docs, and live acceptance

**Files:**
- Modify: `.github/workflows/deploy.yml`, `public/admin/config.yml` (3 hints), `docs/GUIDE-ADMIN.md` (« Ajouter un coup de cœur »), `docs/DEPLOY.md` (runbook)

**Interfaces:**
- Consumes: `node tools/enrich-isbn.mjs` (Task 1, exit 0 always) and the publication rule (Task 2).

- [ ] **Step 1: Extend the deploy workflow**

In `.github/workflows/deploy.yml`, change the permissions block:

```yaml
permissions:
  contents: write # bot commit of enriched coups de coeur (SP4); read elsewhere
  pages: write
  id-token: write
```

and insert between `- run: npm ci` and `- run: npm test`:

```yaml
      # SP4: fill titre/auteur/editeur from the ISBN before building
      - run: node tools/enrich-isbn.mjs
      - name: Commit enriched metadata (bot)
        run: |
          if ! git diff --quiet -- src/content/coups-de-coeur; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add src/content/coups-de-coeur
            git commit -m "chore: enrich coups de coeur from ISBN [skip ci]"
            # non-fatal: the enriched tree still builds and deploys below;
            # a lost race with a concurrent push is retried on the next run
            git push || echo "::warning::bot push failed — enrichment deployed anyway, commit retried next run"
          fi
```

- [ ] **Step 2: Update the CMS hints**

In `public/admin/config.yml` (coups-de-coeur collection):
- `titre` hint: `Rempli automatiquement depuis l'ISBN quelques minutes après l'enregistrement — corrigez-le si besoin, votre saisie gagne toujours.`
- `auteur`: add the same style of hint: `Rempli automatiquement depuis l'ISBN — corrigez si besoin.`
- `editeur`: add: `Rempli automatiquement depuis l'ISBN — corrigez si besoin.`

(Only `hint:` lines change — field names/validations are locked by `src/lib/admin.test.ts` and must not move.)

- [ ] **Step 3: Update the team guide**

In `docs/GUIDE-ADMIN.md`, replace step 4 of « Ajouter un coup de cœur »:

```markdown
4. **Titre, auteur, éditeur** : à remplir (le remplissage automatique depuis
   l'ISBN arrivera dans une prochaine étape).
```

with:

```markdown
4. **Titre, auteur, éditeur** : laissez vide — ils sont remplis automatiquement
   depuis l'ISBN quelques minutes après l'enregistrement. Vous pouvez les
   corriger ensuite : votre saisie gagne toujours. Si l'ISBN est introuvable,
   le coup de cœur reste invisible sur le site (et modifiable ici) jusqu'à ce
   qu'un titre soit renseigné.
```

- [ ] **Step 4: Update the runbook**

In `docs/DEPLOY.md`, in the « Runbook » section, after the « Étapes » line, replace:

```markdown
- **Étapes** : `npm ci` → `npm test` → `npm run build` → publication de `dist/` sur GitHub Pages.
```

with:

```markdown
- **Étapes** : `npm ci` → enrichissement ISBN (`tools/enrich-isbn.mjs` : BnF puis Google Books ; commit bot `[skip ci]` si des champs ont été remplis) → `npm test` → `npm run build` → publication de `dist/` sur GitHub Pages.
- Un ISBN introuvable produit une annotation *warning* sur le run (onglet Actions) et la fiche reste hors site jusqu'à correction dans l'admin — le build ne casse jamais pour ça.
```

- [ ] **Step 5: Full suite + build, commit, push**

Run: `npm test` and `npm run build` — green (docs/config changes only affect the admin consistency tests if a field moved — they must still pass).

```bash
git add .github/workflows/deploy.yml public/admin/config.yml docs/GUIDE-ADMIN.md docs/DEPLOY.md
git commit -m "feat: run ISBN enrichment in the deploy workflow with bot commit"
git push
```

- [ ] **Step 6: Live acceptance (spec SP4)**

Push two temporary fiches in one commit:

```bash
printf -- '---\nisbn13: "9782070368228"\ncitation: "Recette SP4 — à supprimer."\nlibraire: "Vincent"\nvisible: false\nordre: 99\n---\n' > src/content/coups-de-coeur/recette-sp4.md
printf -- '---\nisbn13: "9999999999997"\ncitation: "Recette SP4 (ISBN faux) — à supprimer."\nlibraire: "Vincent"\nvisible: true\nordre: 99\n---\n' > src/content/coups-de-coeur/recette-sp4-faux.md
git add src/content/coups-de-coeur && git commit -m "test: SP4 acceptance fixtures" && git push
```

Watch the run (`gh run watch`). Expected, in order:
1. The run succeeds and shows ONE `::warning::` annotation (ISBN 9999999999997 introuvable).
2. A bot commit `chore: enrich coups de coeur from ISBN [skip ci]` lands on main filling `titre`/`auteur`/`editeur` in `recette-sp4.md` (L'Étranger, Albert Camus, Gallimard — exact casing/wording as BnF returns it), and NO second workflow run starts for it.
3. `recette-sp4-faux.md` is unchanged; the deployed site does not contain « Recette SP4 » anywhere.

Then clean up:

```bash
git pull
git rm src/content/coups-de-coeur/recette-sp4.md src/content/coups-de-coeur/recette-sp4-faux.md
git commit -m "test: remove SP4 acceptance fixtures [skip ci]"
git push
```

(`[skip ci]` here too: nothing displayed changed — both fiches were invisible — so no rebuild is needed.)
