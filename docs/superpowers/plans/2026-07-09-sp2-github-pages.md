# SP2 — Mise en ligne GitHub Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the SP1 site to `https://vferries.github.io/escalire/` via GitHub Actions (push + daily cron), with local SEO and the RGPD map decision implemented.

**Architecture:** One workflow (`deploy.yml`) building with Node 22 and publishing `dist/` through the official Pages actions; `actions/configure-pages` with `enablement: true` activates Pages on first run. SEO is build-time only (JSON-LD from the `infos` collection, static `sitemap.xml`/`robots.txt`). The Leaflet map becomes click-to-load (RGPD decision: no third-party request before an explicit user action), recorded in DEPLOY.md.

**Tech Stack:** GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`) · JSON-LD schema.org `BookStore` · no new npm dependencies.

## Global Constraints

- Repo: `vferries/escalire` (public, remote `origin` configured, SSH auth works). Branch for this work: `feat/sp2-deploy` (already created from `feat/sp1-site`).
- **Node in CI:** 22 (`node-version-file: '.nvmrc'`). Locally every npm/npx/node command needs `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`.
- **No new npm dependencies** (sitemap is a static file — do NOT add @astrojs/sitemap). Lighthouse runs via `npx lighthouse` with `CHROME_PATH=/usr/bin/google-chrome` (dev tooling, not a project dependency).
- Site copy French; code/comments/commits English; no co-author lines. Tests: `npx vitest run` (13 green) + `npm run build` after every task.
- RGPD decision (spec § 6, decided): **click-to-load** for the CARTO map — no tile request before an explicit click. Documented in DEPLOY.md.
- The deploy workflow triggers on `push: branches: [main]`, `schedule` (daily cron) and `workflow_dispatch`. Nothing deploys until PR #1 (SP1) and PR #2 (this branch) merge — acceptance on the live URL happens post-merge; local verification must be complete before that.
- Visual changes must be screenshot-verified (recipe in project memory: `npm run preview -- --port 4322`, playwright via `/home/vincent/projects/kiddo/node_modules/playwright/index.mjs` + `executablePath: '/usr/bin/google-chrome'`; script template at the session scratchpad `shoot.mjs`).

## File Structure

```
.github/workflows/deploy.yml     ← build + deploy, push/cron/dispatch
public/robots.txt                ← allow all, Disallow /admin, Sitemap URL
public/sitemap.xml               ← single-URL static sitemap
src/layouts/Base.astro           ← canonical, og/twitter meta, JSON-LD BookStore
src/components/Infos.astro       ← map click-to-load placeholder
src/scripts/site.js              ← initMap on click instead of IO
docs/DEPLOY.md                   ← RGPD decision + deployment runbook section
```

---

### Task 1: Deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: workflow `Deploy to GitHub Pages` — the SP4 enrichment step will later be inserted as a job/step before `build`.

- [ ] **Step 1: Write the workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  schedule:
    # daily rebuild so past events get archived at build time (spec S7)
    - cron: '0 4 * * *'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: npm
      - run: npm ci
      - run: npx vitest run
      - run: npm run build
      - uses: actions/configure-pages@v5
        with:
          enablement: true
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate locally** — `npx vitest run` and `npm run build` still green (workflow file has no local effect; this guards the branch state). Lint the YAML by eye against the snippet above (exact indentation).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build and deploy to GitHub Pages on push and daily cron"
```

---

### Task 2: Local SEO — JSON-LD BookStore, meta, sitemap, robots

**Files:**
- Modify: `src/layouts/Base.astro`
- Create: `public/robots.txt`, `public/sitemap.xml`

**Interfaces:**
- Consumes: `getEntry('infos','infos')` → `data.{telephone,email,adresse{lignes,lat,lng},horaires,instagram,facebook}`; `Astro.site` = `https://vferries.github.io`; `import.meta.env.BASE_URL` = `/escalire/`.

- [ ] **Step 1: Head meta in Base.astro**

Add to `<head>` (after the existing description meta):
```astro
<link rel="canonical" href={new URL(base, Astro.site).href} />
<meta property="og:type" content="website" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={new URL(base, Astro.site).href} />
<meta property="og:image" content={new URL(`${base}assets/logo-escalire.png`, Astro.site).href} />
<meta property="og:locale" content="fr_FR" />
<meta name="twitter:card" content="summary" />
```

- [ ] **Step 2: JSON-LD BookStore in Base.astro**

Built from the `infos` entry (no hardcoded values except the name). `openingHoursSpecification` derives from `data.horaires`: for each day with hours, emit one spec per open day using schema.org day names (`https://schema.org/Tuesday`…), `opens`/`closes` from the first/last slot — convert `"10h00 – 12h30"`/`"14h30 – 18h30"` to TWO specs per day (morning and afternoon) with `opens: "10:00", closes: "12:30"` and `opens: "14:30", closes: "18:30"` (parse `(\d{2})h(\d{2})`). Compose in frontmatter:

```astro
---
const jourSchema: Record<string, string> = {
  lundi: 'Monday', mardi: 'Tuesday', mercredi: 'Wednesday', jeudi: 'Thursday',
  vendredi: 'Friday', samedi: 'Saturday', dimanche: 'Sunday',
};
const toHM = (s: string) => s.replace(/(\d{2})h(\d{2})/, '$1:$2');
const openingHours = Object.entries(infos?.data.horaires ?? {}).flatMap(([jour, h]) =>
  [h.matin, h.apresMidi].filter(Boolean).map((slot) => {
    const [opens, closes] = (slot as string).split(' – ').map(toHM);
    return {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${jourSchema[jour]}`,
      opens, closes,
    };
  })
);
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BookStore',
  name: 'Librairie Escalire',
  url: new URL(base, Astro.site).href,
  image: new URL(`${base}assets/logo-escalire.png`, Astro.site).href,
  telephone: infos?.data.telephone,
  email: infos?.data.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: infos?.data.adresse.lignes.slice(0, -1).join(', '),
    postalCode: '31750',
    addressLocality: 'Escalquens',
    addressCountry: 'FR',
  },
  geo: { '@type': 'GeoCoordinates', latitude: infos?.data.adresse.lat, longitude: infos?.data.adresse.lng },
  openingHoursSpecification: openingHours,
  sameAs: [infos?.data.instagram, infos?.data.facebook].filter(Boolean),
};
---
```
and in `<head>`: `<script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />`
(postalCode/locality are parsed from `adresse.lignes` last line if you prefer — but the split above is acceptable since the address format is fixed; add a comment saying the last line is "31750 Escalquens".)

- [ ] **Step 3: robots.txt + sitemap.xml**

`public/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /escalire/admin/

Sitemap: https://vferries.github.io/escalire/sitemap.xml
```

`public/sitemap.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://vferries.github.io/escalire/</loc>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
```

Known limitation (state it in the commit body and DEPLOY.md): on a project page, these files are served at `/escalire/robots.txt` — crawlers only read the DOMAIN-ROOT robots.txt (`vferries.github.io/robots.txt`), so the Disallow is not enforced until the `escalire.fr` migration; the real `/admin` protection is SP3's `noindex` meta. The files are still correct to ship now (they become effective on the custom domain).

- [ ] **Step 4: Verify** — `npm run build`; in `dist/index.html` grep for `application/ld+json`, `canonical`, `og:title`; validate the JSON-LD block by parsing it with `node -e` (JSON.parse of the extracted script content); `dist/robots.txt` and `dist/sitemap.xml` present.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Base.astro public/robots.txt public/sitemap.xml
git commit -m "feat: add BookStore JSON-LD, social meta, sitemap and robots"
```

---

### Task 3: Map click-to-load (RGPD)

**Files:**
- Modify: `src/components/Infos.astro`, `src/scripts/site.js`, `docs/DEPLOY.md`

**Interfaces:**
- Consumes: existing `#map-escalire[data-lat][data-lng][data-base]` and `initMap(el)` in site.js.
- Produces: no request to `basemaps.cartocdn.com` until the user clicks the placeholder button.

- [ ] **Step 1: Placeholder markup in Infos.astro**

Inside `#map-escalire` (which keeps its size/radius/background), add a centered button:
```astro
<div id="map-escalire" data-lat={...} data-lng={...} data-base={base}>
  <button type="button" class="map-consent">
    <span class="map-consent-title">Afficher la carte</span>
    <span class="map-consent-note">Fond de carte CARTO — en affichant la carte, votre adresse IP est transmise à ce service.</span>
  </button>
</div>
```
Style: full-size flex center on the existing `#dcebf5` background; title EB Garamond 19px `--navy`; note Caveat 18px `--text-3` max-width 340px; hover raises the card slightly; `:focus-visible` outline. A small static feather (masked div, `--blue-light`, ~40px) above the title keeps it in the design language.

- [ ] **Step 2: site.js — click instead of IO**

Replace the map IntersectionObserver block: keep `initMap(el)` as is; new wiring:
```js
function setupMap() {
  const el = document.querySelector('#map-escalire');
  if (!el) return;
  const btn = el.querySelector('.map-consent');
  if (!btn) return;
  btn.addEventListener('click', () => {
    btn.remove();
    initMap(el); // Leaflet is bundled; only the CARTO tile requests are deferred
  }, { once: true });
}
```
Delete the now-unused IO/rootMargin code for the map. (Leaflet stays statically imported — bundle size was measured fine in SP1; only the third-party tile fetch needed gating.)

- [ ] **Step 3: DEPLOY.md** — check the RGPD checklist line and append a short decision note: « Décision SP2 (2026-07-09) : carte au clic — aucun appel aux tuiles CARTO sans action explicite ; bandeau non nécessaire. » Also append a **Runbook** section: how the deploy works (workflow name, triggers incl. cron 04:00 UTC, where to see runs), and the two URLs (prod page, workflow file).

- [ ] **Step 4: Verify (screenshots + network)** — build, preview on 4322, playwright script: (a) screenshot of the infos section shows the placeholder button styled correctly; (b) capture `page.on('request')` URLs while scrolling to the map: NO request to `basemaps.cartocdn.com`; (c) `page.click('.map-consent')` then wait, screenshot: tiles + feather marker + popup visible, and requests to cartocdn now present. Read the screenshots.

- [ ] **Step 5: Commit**

```bash
git add src/components/Infos.astro src/scripts/site.js docs/DEPLOY.md
git commit -m "feat: gate CARTO map behind explicit click (RGPD)"
```

---

### Task 4: Lighthouse + acceptance + PR handoff

- [ ] **Step 1: Lighthouse local** — build + preview, then:
```bash
CHROME_PATH=/usr/bin/google-chrome npx --yes lighthouse http://localhost:4322/escalire/ \
  --preset=perf --form-factor=mobile --screenEmulation.mobile \
  --chrome-flags="--headless=new" --output=json --output-path=/tmp/lh.json
node -e "const r=require('/tmp/lh.json').categories; console.log('perf', r.performance.score)"
CHROME_PATH=/usr/bin/google-chrome npx --yes lighthouse http://localhost:4322/escalire/ \
  --only-categories=accessibility,seo,best-practices --form-factor=mobile --screenEmulation.mobile \
  --chrome-flags="--headless=new" --output=json --output-path=/tmp/lh2.json
node -e "const r=require('/tmp/lh2.json').categories; console.log('a11y', r.accessibility.score, 'seo', r.seo.score)"
```
Targets (DEPLOY.md): perf > 0.90, accessibility = 1.0 on mobile. If a11y < 1.0 or perf ≤ 0.90: read the failing audits from the JSON, fix what is actionable (each fix = its own commit), re-run. Report the final numbers. (Local numbers approximate prod but the page is static — treat a local pass as the gate, re-check on prod URL after merge.)
- [ ] **Step 2: Full suite** — `npx vitest run` 13 green, `npm run build` clean, `git status` clean.
- [ ] **Step 3: Push branch** — `git push -u origin feat/sp2-deploy`. Do NOT merge anything.
- [ ] **Step 4: Report** — final numbers, commits list, and remind: PR #1 (`feat/sp1-site`→main) must merge first, then PR #2 (`feat/sp2-deploy`→main); first deploy run enables Pages automatically; verify epagine covers + map + live URL after merge (post-merge checklist in DEPLOY.md runbook).
