# SP5 — CTA commandes, carte statique, mentions légales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Place des Libraires order path a visible button, show the map instantly as a self-hosted image (zero third-party request at load), and add a design-matched `/mentions-legales/` page.

**Architecture:** Three independent slices over the existing one-page Astro site. The CTA reuses the `.pill-dark` style already in `Infos.astro`. The map placeholder becomes a committed screenshot of the CARTO map (`public/assets/map-escalire.jpg`, captured once via a checked-in Playwright script) with a full-size overlay button that triggers the existing `initMap()` click-to-load path. The legal page is a second Astro page on the `Base` layout, which gains a `path` prop so canonical/og URLs and the JSON-LD gate work per-page; nav anchors become base-absolute so they work from the subpage.

**Tech Stack:** Existing Astro 6 + vitest; Playwright via `npx -p playwright` with system Chrome (dev tooling only, NOT a dependency).

## Global Constraints

- **Commits directly on `main`** (Vincent, 2026-07-10 — no branches/PRs). Every push deploys: `npm test` AND `npm run build` must be green before each push. **No Co-Authored-By/trailer lines.**
- Site copy French; code/comments/commits English. Visual tokens from DESIGN.md (`--paper`, `--navy`, `--ink`, `--red`, fonts var(--font-display/body/hand)); contrasts AA.
- RGPD acceptance (spec § 4 I2): at page load, **zero request to `*.cartocdn.com`** — CARTO tiles only after clicking « Activer la carte interactive ». Attribution « © OpenStreetMap contributors © CARTO » stays visible with the static image (license requirement).
- Legal identifiers (spec § 3, exact): EURL Librairie Escalire, capital 8 000 €, SIRET 752 566 893 00018, Espace commercial 61, 61 avenue de Toulouse, 31750 Escalquens, tél. 05 62 80 68 50, contact@escalire.fr, directrice de la publication **Anne-Sophie Delage** ; hébergeur GitHub Pages (GitHub, Inc.) ; domaine/DNS OVH (domaine seulement, pas l'hébergement).
- Content-layer cache gotcha: if a build behaves oddly, `rm -rf .astro node_modules/.astro` re-validates everything like CI.
- Node 22 (`node --version` → v22.x on PATH).

## File Structure

```
src/components/Infos.astro        ← CTA button (Task 1) + static-map markup/CSS (Task 2)
src/scripts/site.js               ← setupMap removes the static image on activation (Task 2)
tools/capture-map.mjs             ← one-off Playwright capture script, committed (Task 2)
public/assets/map-escalire.jpg    ← committed map screenshot @2x (Task 2)
src/layouts/Base.astro            ← `path` prop for canonical/og + JSON-LD only on home (Task 3)
src/pages/mentions-legales.astro  ← legal page (Task 3)
src/components/Nav.astro          ← base-absolute anchors (Task 3)
src/components/Footer.astro       ← internal legal link (Task 3)
public/sitemap.xml                ← + /mentions-legales/ (Task 3)
docs/DEPLOY.md                    ← checklist updates (Task 3)
src/lib/site.test.ts              ← source-level guards, created Task 1, extended Tasks 2–3
```

---

### Task 1: Order CTA in « Bon à savoir »

**Files:**
- Modify: `src/components/Infos.astro` (savoir card, lines ~83–91)
- Test: `src/lib/site.test.ts` (create)

**Interfaces:**
- Produces: `src/lib/site.test.ts` with helpers `root` and `read(path)` that Tasks 2–3 extend with more describe blocks.

- [ ] **Step 1: Write the failing test**

Create `src/lib/site.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const read = (p: string) => readFileSync(root + p, 'utf8');

describe('order CTA (spec SP5 I1)', () => {
  const infos = () => read('src/components/Infos.astro');
  it('shows a real button to Place des Libraires in « Bon à savoir »', () => {
    expect(infos()).toMatch(
      /<a href=\{placeDesLibraires\} target="_blank" rel="noopener" class="pill-dark">Commander sur Place des Libraires<\/a>/
    );
  });
  it('drops the old inline text link', () => {
    expect(infos()).not.toContain('Commandes en ligne via');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/site.test.ts`
Expected: FAIL — both assertions (button absent, old line present).

- [ ] **Step 3: Edit the savoir card in Infos.astro**

Replace (in the « Bon à savoir » card):

```astro
          <p><span class="savoir-dot" style="background: var(--coral);"></span>Commandes en ligne via <a href={placeDesLibraires} target="_blank" rel="noopener">Place des Libraires</a></p>
        </div>
```

with:

```astro
          <p><span class="savoir-dot" style="background: var(--coral);"></span>Commandes en ligne — livre réservé, on vous prévient dès qu'il arrive</p>
        </div>
        <a href={placeDesLibraires} target="_blank" rel="noopener" class="pill-dark">Commander sur Place des Libraires</a>
```

No CSS to add: `.pill-dark` (defined in this component for the « Itinéraire » button) already carries `margin-top: auto; align-self: flex-start` — the button lands at the bottom of the flex card exactly like « Itinéraire » does in the neighbouring card. Ink background / paper text = AA contrast.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/site.test.ts` — Expected: PASS (2 tests).

- [ ] **Step 5: Full suite, build, visual check, commit, push**

Run: `npm test` then `npm run build` — all green.
Then `npm run preview` and eyeball http://localhost:4321/escalire/#infos : the button sits at the bottom of « Bon à savoir », styled like « Itinéraire ».

```bash
git add src/components/Infos.astro src/lib/site.test.ts
git commit -m "feat: turn Place des Libraires order link into a real CTA button"
git push
```

---

### Task 2: Static map at load, interactive map on click

**Files:**
- Create: `tools/capture-map.mjs`, `public/assets/map-escalire.jpg` (generated)
- Modify: `src/components/Infos.astro` (map-frame markup + styles), `src/scripts/site.js` (`setupMap`)
- Test: `src/lib/site.test.ts` (extend)

**Interfaces:**
- Consumes: `root`/`read` from Task 1's test file; existing `initMap(el)` / `setupMap()` in `site.js` (unchanged API).
- Produces: `.map-static` img element that `setupMap` removes on activation.

- [ ] **Step 1: Write the capture script**

Create `tools/capture-map.mjs`:

```js
// Regenerates public/assets/map-escalire.jpg (the RGPD-friendly static map).
// One-off tool — run it again only if the map look, marker or coords change.
// Usage: `npm run dev` in another terminal, then:
//   npx -y -p playwright node tools/capture-map.mjs
// Requires desktop Chrome (channel: 'chrome' — no browser download).
import { chromium } from 'playwright';

const url = process.env.MAP_URL ?? 'http://localhost:4321/escalire/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 });
await page.goto(url);
const map = page.locator('#map-escalire');
await map.scrollIntoViewIfNeeded();
await page.locator('.map-consent').click();
await page.waitForTimeout(5000); // let CARTO tiles and the marker popup settle
await map.screenshot({ path: 'public/assets/map-escalire.jpg', type: 'jpeg', quality: 80 });
await browser.close();
console.log('wrote public/assets/map-escalire.jpg');
```

- [ ] **Step 2: Capture the image (BEFORE changing the markup)**

Run `npm run dev` (background), then: `npx -y -p playwright node tools/capture-map.mjs`
Expected: `public/assets/map-escalire.jpg` exists, roughly 100–400 KB, 2232×760 px, showing the light CARTO map, the feather marker and its popup. Open the file to verify visually. Stop the dev server.

- [ ] **Step 3: Extend the tests (failing)**

Append to `src/lib/site.test.ts`:

```ts
describe('static map (spec SP5 I2)', () => {
  const infos = () => read('src/components/Infos.astro');
  it('ships a committed map image of a plausible size', () => {
    const { statSync } = require('node:fs');
    expect(statSync(root + 'public/assets/map-escalire.jpg').size).toBeGreaterThan(50_000);
  });
  it('renders the static image with alt text and the license attribution', () => {
    expect(infos()).toContain('assets/map-escalire.jpg');
    expect(infos()).toContain('class="map-static"');
    expect(infos()).toContain('OpenStreetMap');
    expect(infos()).toContain('CARTO');
  });
  it('never references CARTO tile servers at load', () => {
    expect(infos()).not.toContain('cartocdn');
  });
  it('removes the static image when the interactive map is activated', () => {
    expect(read('src/scripts/site.js')).toContain(".querySelector('.map-static')");
  });
});
```

(Use `import { statSync } from 'node:fs'` at the top of the file instead of `require` — shown here inline for locality; put the import with the others.)

Run: `npx vitest run src/lib/site.test.ts` — Expected: the 3 markup/js assertions FAIL (image test passes, captured in Step 2).

- [ ] **Step 4: Rework the map-frame markup in Infos.astro**

Replace the current `#map-escalire` block:

```astro
      <div id="map-escalire" data-lat={data.adresse.lat} data-lng={data.adresse.lng} data-base={base}>
        <button type="button" class="map-consent">
          <span
            class="map-consent-feather"
            aria-hidden="true"
            style={`-webkit-mask-image:url(${featherMask}); mask-image:url(${featherMask});`}
          ></span>
          <span class="map-consent-title">Afficher la carte</span>
          <span class="map-consent-note">Fond de carte CARTO — en affichant la carte, votre adresse IP est transmise à ce service.</span>
        </button>
      </div>
      <p class="map-caption">au centre commercial Espace 61 — parking gratuit devant la porte</p>
```

with:

```astro
      <div id="map-escalire" data-lat={data.adresse.lat} data-lng={data.adresse.lng} data-base={base}>
        <img
          src={`${base}assets/map-escalire.jpg`}
          alt="Plan d'accès : librairie Escalire, Espace 61, 61 avenue de Toulouse à Escalquens"
          class="map-static"
          width="1116"
          height="380"
          loading="lazy"
        />
        <button type="button" class="map-consent">
          <span class="map-consent-title">Activer la carte interactive</span>
        </button>
      </div>
      <p class="map-caption">au centre commercial Espace 61 — parking gratuit devant la porte</p>
      <p class="map-attribution">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors
        © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>
        — la carte interactive charge les tuiles CARTO (adresse IP transmise à ce service).
      </p>
```

- [ ] **Step 5: Adjust the map styles in Infos.astro**

Replace the `.map-consent*` style rules (keep `.map-frame`, `#map-escalire`, `.map-caption` as they are) with:

```css
  .map-static {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .map-consent {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 18px;
    border: none;
    background: transparent;
    cursor: pointer;
  }
  .map-consent-title {
    font-family: var(--font-body);
    font-size: 16px;
    letter-spacing: 0.05em;
    color: var(--paper);
    background: rgba(24, 26, 32, 0.85); /* --ink at 85%: AA on any map background */
    padding: 11px 22px;
    border-radius: 999px;
    transition: background 0.3s ease, transform 0.3s ease;
  }
  .map-consent:hover .map-consent-title,
  .map-consent:focus-visible .map-consent-title {
    background: var(--navy);
    transform: translateY(-2px);
  }
  .map-attribution {
    margin: 2px 8px 4px;
    font-family: var(--font-body);
    font-size: 12.5px;
    color: var(--text-3);
  }
  .map-attribution a {
    color: inherit;
  }
```

(The whole map is the button — big touch target; the visible pill sits bottom-center. `.map-consent-feather` and `.map-consent-note` rules are deleted along with their markup; the RGPD note now lives in `.map-attribution`.)

- [ ] **Step 6: Make setupMap remove the image too**

In `src/scripts/site.js`, inside `setupMap`'s click handler, right before `btn.remove();` add:

```js
    el.querySelector('.map-static')?.remove();
```

- [ ] **Step 7: Tests, build, network check, commit, push**

Run: `npx vitest run src/lib/site.test.ts` — Expected: PASS (6 tests).
Run: `npm test` — all green. Run: `npm run build`, then:

```bash
grep -c cartocdn dist/index.html || echo "0 — OK, no tile URL in the served HTML"
```

Expected: 0 occurrences (tile URLs only live in the bundled JS behind the click).
Then `npm run preview`, open http://localhost:4321/escalire/#infos with the browser devtools Network tab: no `cartocdn` request at load; the static map shows with the pill; clicking it swaps in the live Leaflet map (popup opens, focus moves to the map).

```bash
git add tools/capture-map.mjs public/assets/map-escalire.jpg src/components/Infos.astro src/scripts/site.js src/lib/site.test.ts
git commit -m "feat: show a self-hosted static map at load, CARTO tiles on click only"
git push
```

---

### Task 3: Mentions légales page, internal footer link, nav anchors

**Files:**
- Create: `src/pages/mentions-legales.astro`
- Modify: `src/layouts/Base.astro` (props + canonical + JSON-LD gate), `src/components/Nav.astro` (anchors), `src/components/Footer.astro` (legal link), `public/sitemap.xml`, `docs/DEPLOY.md`
- Test: `src/lib/site.test.ts` (extend)

**Interfaces:**
- Consumes: `root`/`read` from Task 1; `Base` layout props.
- Produces: `Base` gains optional prop `path?: string` (default `''`, e.g. `'mentions-legales/'`) — canonical/og become `new URL(base + path, Astro.site)`, JSON-LD only when `path === ''`.

- [ ] **Step 1: Extend the tests (failing)**

Append to `src/lib/site.test.ts`:

```ts
describe('mentions légales (spec SP5 I3/I4)', () => {
  it('carries the exact legal identifiers', () => {
    const page = read('src/pages/mentions-legales.astro');
    expect(page).toContain('EURL Librairie Escalire');
    expect(page).toContain('752 566 893 00018');
    expect(page).toContain('Anne-Sophie Delage');
    expect(page).toContain('GitHub'); // hébergeur
    expect(page).toContain('OVH'); // domaine/DNS seulement
  });
  it('is linked from the footer instead of the old external page', () => {
    const footer = read('src/components/Footer.astro');
    expect(footer).toContain('mentions-legales/');
    expect(footer).not.toContain('MentionsLegales.html');
  });
  it('is listed in the sitemap', () => {
    expect(read('public/sitemap.xml')).toContain(
      'https://vferries.github.io/escalire/mentions-legales/'
    );
  });
  it('nav anchors are base-absolute so they work from subpages', () => {
    const nav = read('src/components/Nav.astro');
    expect(nav).toContain("`${base}#librairie`");
    expect(nav).toContain('href={`${base}#accueil`}');
  });
});
```

Run: `npx vitest run src/lib/site.test.ts` — Expected: the 4 new tests FAIL.

- [ ] **Step 2: Give Base.astro a `path` prop**

In `src/layouts/Base.astro`:

```ts
interface Props {
  title: string;
  description: string;
  /** page path under the base, e.g. 'mentions-legales/' — '' = home */
  path?: string;
}
const { title, description, path = '' } = Astro.props;
```

and further down:

```ts
const canonical = new URL(base + path, Astro.site).href;
const isHome = path === '';
```

then gate the JSON-LD script (BookStore markup belongs to the home page only) by wrapping the EXISTING line — keep its `set:html={...}` expression byte-identical (it escapes `<` as `<`; do not retype it):

```astro
    {isHome && <script type="application/ld+json" set:html={/* existing expression, unchanged */} />}
```

(`og:url` already uses `canonical`, so it follows automatically.)

- [ ] **Step 3: Base-absolute nav anchors**

In `src/components/Nav.astro`, change the link table and logo href:

```ts
const allLinks: [string, string, boolean][] = [
  [`${base}#librairie`, 'La librairie', true],
  [`${base}#coups-de-coeur`, 'Coups de cœur', hasCoupsDeCoeur],
  [`${base}#evenements`, 'Rencontres', true],
  [`${base}#equipe`, "L'équipe", hasEquipe],
  [`${base}#infos`, 'Horaires & accès', true],
];
```

and:

```astro
  <a href={`${base}#accueil`} class="nav-logo">
```

(No JS depends on `href^="#"` — verified: `site.js` has no anchor handlers. On the home page the browser treats same-URL-hash links as plain scrolls, unchanged behavior.)

- [ ] **Step 4: Write the legal page**

Create `src/pages/mentions-legales.astro`:

```astro
---
import Base from '../layouts/Base.astro';

const base = import.meta.env.BASE_URL;
---
<Base
  title="Mentions légales — Librairie Escalire"
  description="Mentions légales de la librairie Escalire (Escalquens) : éditeur, hébergement, données personnelles et crédits."
  path="mentions-legales/"
>
  <main class="legal">
    <p class="kicker">pour la forme</p>
    <h1>Mentions légales</h1>

    <section>
      <h2>Éditeur du site</h2>
      <p>
        EURL Librairie Escalire, au capital social de 8 000 €<br />
        SIRET 752 566 893 00018<br />
        Espace commercial 61, 61 avenue de Toulouse, 31750 Escalquens<br />
        Tél. <a href="tel:+33562806850">05 62 80 68 50</a> — <a href="mailto:contact@escalire.fr">contact@escalire.fr</a>
      </p>
      <p>Directrice de la publication : Anne-Sophie Delage.</p>
    </section>

    <section>
      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par GitHub Pages — GitHub, Inc., 88 Colin P. Kelly Jr Street,
        San Francisco, CA 94107, États-Unis.
      </p>
      <p>
        Le nom de domaine et les DNS sont gérés par OVH — 2 rue Kellermann, 59100 Roubaix
        (OVH ne fournit que le domaine, pas l'hébergement du site).
      </p>
    </section>

    <section>
      <h2>Données personnelles</h2>
      <p>
        Ce site n'utilise ni cookies ni outil de mesure d'audience, et ne collecte aucune
        donnée personnelle.
      </p>
      <p>
        Les couvertures de livres sont affichées depuis <code>images.epagine.fr</code> :
        comme pour toute image tierce, l'adresse IP du visiteur est transmise à ce service.
        Le plan d'accès est une image hébergée avec le site ; les tuiles cartographiques
        CARTO ne sont chargées que si vous activez la carte interactive.
      </p>
      <p>
        Pour exercer vos droits (accès, rectification, effacement), écrivez à
        <a href="mailto:contact@escalire.fr">contact@escalire.fr</a>.
      </p>
    </section>

    <section>
      <h2>Propriété intellectuelle</h2>
      <p>
        Les contenus de ce site (textes, photographies, illustrations, identité graphique
        « encre &amp; plume ») sont la propriété de la librairie Escalire ou de leurs auteurs.
        Toute reproduction est soumise à autorisation préalable.
      </p>
    </section>

    <section>
      <h2>Crédits</h2>
      <p>
        Données cartographiques © OpenStreetMap contributors, fond de carte © CARTO.
        Polices EB Garamond, Cormorant Garamond et Caveat, sous licence SIL Open Font
        License (auto-hébergées). Couvertures de livres © leurs éditeurs, via epagine.
      </p>
    </section>

    <p class="legal-back"><a href={base}>← Retour au site</a></p>
  </main>
</Base>

<style>
  .legal {
    max-width: 720px;
    margin: 0 auto;
    /* clears the fixed nav (63px) with breathing room */
    padding: 140px 28px 90px;
  }
  .kicker {
    margin: 0;
    font-family: var(--font-hand);
    font-size: 26px;
    color: var(--navy);
  }
  h1 {
    margin: 6px 0 40px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(36px, 4.6vw, 56px);
    line-height: 1.1;
    color: var(--ink);
  }
  h2 {
    margin: 36px 0 12px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 27px;
    color: var(--ink);
  }
  p {
    margin: 0 0 14px;
    font-family: var(--font-body);
    font-size: 18px;
    line-height: 1.65;
    color: var(--text-2);
  }
  a {
    color: var(--navy);
    text-underline-offset: 3px;
  }
  a:hover {
    color: var(--red);
  }
  code {
    font-size: 16px;
  }
  .legal-back {
    margin-top: 48px;
  }
  .legal-back a {
    font-family: var(--font-hand);
    font-size: 22px;
    text-decoration: none;
  }
</style>
```

- [ ] **Step 5: Footer link and sitemap**

In `src/components/Footer.astro`, replace:

```astro
      <a href="https://escalire.fr/MentionsLegales.html" target="_blank" rel="noopener">Mentions légales</a>
```

with:

```astro
      <a href={`${base}mentions-legales/`}>Mentions légales</a>
```

In `public/sitemap.xml`, add before `</urlset>`:

```xml
  <url>
    <loc>https://vferries.github.io/escalire/mentions-legales/</loc>
    <changefreq>yearly</changefreq>
  </url>
```

- [ ] **Step 6: DEPLOY.md checklist**

In `docs/DEPLOY.md`:
- change `- [ ] Redirections 301 depuis les anciennes URLs de escalire.fr (au minimum `/MentionsLegales.html`)` to `- [ ] Redirections 301 depuis les anciennes URLs de escalire.fr (au minimum `/MentionsLegales.html` → `/mentions-legales/`)`
- change `- [ ] Mentions légales reprises du site actuel` to `- [x] Mentions légales reprises du site actuel — page interne `/mentions-legales/` (SP5, contenu actualisé : hébergeur GitHub Pages, volet données personnelles)`

- [ ] **Step 7: Tests, build, visual check, commit, push**

Run: `npx vitest run src/lib/site.test.ts` — PASS (10 tests). Run: `npm test` — all green.
Run: `npm run build` — expect `dist/mentions-legales/index.html` to exist; check it contains `<link rel="canonical" href="https://vferries.github.io/escalire/mentions-legales/"` and NO `application/ld+json`; check `dist/index.html` still HAS the JSON-LD.
Then `npm run preview`: from http://localhost:4321/escalire/mentions-legales/ the nav links must jump back to the home sections, and the footer link must reach the page.

```bash
git add src/pages/mentions-legales.astro src/layouts/Base.astro src/components/Nav.astro src/components/Footer.astro public/sitemap.xml docs/DEPLOY.md src/lib/site.test.ts
git commit -m "feat: add design-matched legal notice page and wire internal links"
git push
```
