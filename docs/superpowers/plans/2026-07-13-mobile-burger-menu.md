# Mobile Burger Menu Implementation Plan

> **Status: COMPLETE (2026-07-13).** Shipped in commits `a4ec345`, `a8ee1cf`, `882e99d` + fix wave `65d73ea`; final review APPROVED, 111/111 tests; merged to `main`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ≤720px horizontally scrollable nav strip with a burger button opening a full-screen cream panel (validated mockup: `docs/superpowers/specs/2026-07-13-mobile-burger-menu-mockup.png`), with a one-shot feather burst on open.

**Architecture:** All markup/styles live in `src/components/Nav.astro` (panel always in DOM, shown ≤720px only). All behavior lives in `src/scripts/site.js` (`setupMobileMenu()`), reusing the existing feather machinery (`ensureSeeds`/`buildFeather`) for the burst — `buildFeather` gains a `{ once }` option, no duplicated physics. Tests follow the project's source-assertion style (`src/lib/*.test.ts`, vitest).

**Tech Stack:** Astro 6, vanilla JS (WAAPI), vitest, playwright (visual verification only, via kiddo's install).

**Spec:** `docs/superpowers/specs/2026-07-13-mobile-burger-menu-design.md`

## Global Constraints

- Work on branch `feat/mobile-burger-menu` (already checked out). Never commit on main. No `Co-Authored-By` lines in commits.
- Every `npm`/`node`/`npx` command MUST be prefixed with `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && ` (system node is v20, Astro needs ≥22).
- Site copy in French; code, comments, commits in English.
- Animations: transforms/opacity only. Reduced motion (`data-intensite="discret"`) cuts feathers and cascade.
- Never `overflow: hidden` on `body`.
- Recolorable art = `mask-image` + `background-color`, never recolored bitmaps. `ink-wash-a.png` is a 20-frame vertical sprite sheet — always pair it with the existing `.ink-sprite` class (final frame). `feather.png` (multicolor logo feather) may be used as a plain `<img>` (it is used as-is elsewhere, e.g. the Leaflet marker).
- Feather wrappers (outer/path/flutter/mask) must stay separate — never merge their transforms.
- Desktop (>720px) must stay visually identical.
- Vitest runs: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test -- run src/lib/nav-mobile.test.ts` (project script is `vitest run`).

---

### Task 1: Burger button + full-screen panel (markup & styles)

**Files:**
- Modify: `src/components/Nav.astro`
- Test: `src/lib/nav-mobile.test.ts` (create)

**Interfaces:**
- Produces (used by Task 2 and 3 JS):
  - `<button id="nav-burger" aria-expanded="false" aria-controls="nav-panel">`
  - `<div id="nav-panel" class="nav-panel" role="dialog" aria-modal="true" inert>` containing `.panel-close` (button), `.panel-links a` (anchor list, each with inline `--i` custom property), `.panel-feathers` (empty burst container with `data-base` attribute), CSS classes `.open` (panel visible) and `.is-current` (highlighted link).

- [x] **Step 1: Write the failing tests**

Create `src/lib/nav-mobile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string) => readFileSync(root + p, 'utf8');

describe('mobile burger menu — markup & styles (spec 2026-07-13, task 1)', () => {
  const nav = () => read('src/components/Nav.astro');

  it('has a burger button wired for a11y', () => {
    expect(nav()).toMatch(/<button[^>]*id="nav-burger"/);
    expect(nav()).toMatch(/id="nav-burger"[^>]*aria-expanded="false"/);
    expect(nav()).toMatch(/id="nav-burger"[^>]*aria-controls="nav-panel"/);
    expect(nav()).toContain('aria-label="Ouvrir le menu"');
  });

  it('has a full-screen dialog panel, inert until opened', () => {
    expect(nav()).toMatch(/id="nav-panel"[^>]*role="dialog"/);
    expect(nav()).toMatch(/id="nav-panel"[^>]*aria-modal="true"/);
    expect(nav()).toMatch(/id="nav-panel"[^>]*\binert\b/);
    expect(nav()).toContain('aria-label="Fermer le menu"');
  });

  it('renders the panel links from the same links array as the desktop strip', () => {
    // one links.map for the desktop strip, one for the panel
    expect(nav().match(/links\.map\(/g)?.length).toBe(2);
    expect(nav()).toContain('Où va-t-on ?');
  });

  it('staggers panel links via a per-link --i custom property', () => {
    expect(nav()).toContain('--i:${i}');
  });

  it('drops the horizontally scrollable strip', () => {
    expect(nav()).not.toContain('overflow-x: auto');
    expect(nav()).not.toContain('mask-image: linear-gradient(to right');
  });

  it('uses the ink wash per sprite conventions and never touches body overflow', () => {
    expect(nav()).toMatch(/class="panel-wash ink-sprite"/);
    expect(nav()).not.toMatch(/body\s*\{[^}]*overflow/);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test -- run src/lib/nav-mobile.test.ts`
Expected: FAIL — burger/panel assertions unmatched (Nav.astro still has the strip).

- [x] **Step 3: Implement the markup**

In `src/components/Nav.astro`:

3a. Add the wash import in frontmatter (after `const base = ...`):

```ts
const inkWashA = `${base}assets/ink-wash-a.png`;
```

3b. Inside `<nav id="site-nav">`, after the `.nav-links` div, add the burger:

```astro
  <button id="nav-burger" aria-expanded="false" aria-controls="nav-panel" aria-label="Ouvrir le menu">
    <span></span><span></span><span></span>
  </button>
```

3c. After `</nav>`, add the panel (note: `links` is the already-filtered array; `data-base` mirrors the pattern read by `featherMaskUrl()`):

```astro
<div id="nav-panel" class="nav-panel" role="dialog" aria-modal="true" aria-label="Menu de navigation" inert>
  <div class="panel-wash ink-sprite" aria-hidden="true" style={`-webkit-mask-image:url(${inkWashA}); mask-image:url(${inkWashA});`}></div>
  <div class="panel-feathers" aria-hidden="true" data-base={base}></div>
  <div class="panel-top">
    <a href={`${base}#accueil`} class="nav-logo">
      <img src={`${base}assets/logo-escalire.png`} alt="Librairie Escalire" width="77" height="38" />
    </a>
    <button class="panel-close" aria-label="Fermer le menu"></button>
  </div>
  <p class="panel-kicker" aria-hidden="true">Où va-t-on ?</p>
  <div class="panel-links">
    {links.map(([href, label], i) => (
      <a href={href} style={`--i:${i}`}>{label}</a>
    ))}
  </div>
  <img class="panel-decor" src={`${base}assets/feather.png`} alt="" width="54" height="104" />
</div>
```

- [x] **Step 4: Implement the styles**

In the same file's `<style>` block:

4a. REPLACE the whole existing `@media (max-width: 720px)` block (the scrollable-strip rules, including the `.nav-links::-webkit-scrollbar` and `.nav-links a { white-space: nowrap; }` rules) with:

```css
  @media (max-width: 720px) {
    #site-nav { padding: 12px 16px; gap: 14px; }
    .nav-links { display: none; }
    #nav-burger { display: flex; }
    .nav-panel { display: block; }
  }
```

4b. Add before that media query:

```css
  /* --- Mobile burger + full-screen panel (spec 2026-07-13) ----------------- */
  #nav-burger {
    display: none; /* mobile only, see media query */
    flex-direction: column;
    justify-content: center;
    gap: 7px;
    width: 44px;
    height: 44px;
    padding: 10px;
    border: none;
    background: none;
    cursor: pointer;
  }
  #nav-burger span {
    display: block;
    height: 2px;
    border-radius: 2px;
    background: var(--ink);
  }

  .nav-panel {
    display: none; /* mobile only, see media query */
    position: fixed;
    inset: 0;
    /* above the fixed nav (30), below the progress bar (40) so it stays visible */
    z-index: 35;
    background: var(--paper);
    overflow-y: auto; /* short viewports; body overflow is never touched */
    overscroll-behavior: contain;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.35s ease, visibility 0s linear 0.35s;
  }
  .nav-panel.open {
    opacity: 1;
    visibility: visible;
    transition: opacity 0.35s ease;
  }

  .panel-wash {
    position: absolute;
    right: -80px;
    bottom: -120px;
    width: 420px;
    aspect-ratio: 1;
    background: #f1e9db;
    pointer-events: none;
  }
  .panel-feathers {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .panel-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    position: relative;
  }
  .panel-close {
    position: relative;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    cursor: pointer;
  }
  .panel-close::before,
  .panel-close::after {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    top: 50%;
    height: 2px;
    border-radius: 2px;
    background: var(--ink);
  }
  .panel-close::before { transform: rotate(45deg); }
  .panel-close::after { transform: rotate(-45deg); }

  .panel-kicker {
    margin: 34px 32px 0;
    font-family: var(--font-hand);
    font-weight: 600;
    font-size: 26px;
    color: var(--red-ink);
  }

  .panel-links {
    position: relative;
    padding: 0 32px 40px;
  }
  .panel-links a {
    display: block;
    padding: 12px 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(30px, 9.5vw, 40px);
    line-height: 1.15;
    color: var(--ink);
    text-decoration: none;
    border-bottom: 1px solid rgba(24, 26, 32, 0.09);
  }
  .panel-links a:last-child { border-bottom: none; }
  .panel-links a.is-current { color: var(--navy); }
  .panel-links a.is-current::after {
    content: '';
    display: inline-block;
    width: 34px;
    height: 3px;
    margin-left: 14px;
    vertical-align: 10px;
    border-radius: 2px;
    background: var(--red);
  }

  .panel-decor {
    position: absolute;
    right: 26px;
    bottom: 110px;
    width: 54px;
    height: auto;
    opacity: 0.5;
    transform: rotate(-18deg);
    pointer-events: none;
  }
```

Note: `.nav-cta` styles stay (desktop strip still uses them); the panel renders all links plain, per Vincent's feedback.

- [x] **Step 5: Run tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test -- run src/lib/nav-mobile.test.ts`
Expected: PASS (6 tests). Also run the full suite once: `npm test` — no regressions (site.test.ts asserts on Nav.astro/site.js sources).

- [x] **Step 6: Build + visual check (closed state)**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm run build && npm run preview -- --port 4322 &
```

Then run this playwright script (adapt the URL to what preview prints, including any base path) and READ the screenshots:

```js
import { chromium } from '/home/vincent/projects/kiddo/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:4322/'); // use the exact URL preview printed
await page.waitForTimeout(800);
await page.screenshot({ path: 'nav-mobile-closed.png' });
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto('http://localhost:4322/');
await desktop.waitForTimeout(800);
await desktop.locator('#site-nav').screenshot({ path: 'nav-desktop.png' });
await browser.close();
```

Expected: mobile shows logo + burger (no strip, no panel); desktop nav identical to before (links + pill CTA, no burger).

- [x] **Step 7: Commit**

```bash
git add src/components/Nav.astro src/lib/nav-mobile.test.ts
git commit -m "feat: mobile burger button and full-screen nav panel markup"
```

---

### Task 2: Open/close behavior, focus management, current-section mark

**Files:**
- Modify: `src/scripts/site.js`
- Test: `src/lib/nav-mobile.test.ts` (extend)

**Interfaces:**
- Consumes (Task 1): `#nav-burger`, `#nav-panel`, `.panel-close`, `.panel-links a`, classes `.open` / `.is-current`.
- Produces: `setupMobileMenu()` defined and called in the init section; an internal `openMenu()` that Task 3's burst hooks into (the feather spawn call is added inside `openMenu` in Task 3).

- [x] **Step 1: Write the failing tests**

Append to `src/lib/nav-mobile.test.ts`:

```ts
describe('mobile burger menu — behavior (spec 2026-07-13, task 2)', () => {
  const js = () => read('src/scripts/site.js');

  it('defines and calls setupMobileMenu', () => {
    expect(js()).toContain('function setupMobileMenu()');
    expect(js()).toMatch(/^setupMobileMenu\(\);$/m);
  });

  it('closes on Escape and traps Tab inside the panel', () => {
    expect(js()).toContain("e.key === 'Escape'");
    expect(js()).toContain("e.key === 'Tab'");
  });

  it('syncs inert + aria-expanded with the open state', () => {
    expect(js()).toContain('panel.inert = false');
    expect(js()).toContain('panel.inert = true');
    expect(js()).toContain("burger.setAttribute('aria-expanded', 'true')");
    expect(js()).toContain("burger.setAttribute('aria-expanded', 'false')");
  });

  it('marks the current section at open time, without a permanent observer', () => {
    expect(js()).toContain('function markCurrentSection');
    expect(js()).toContain("classList.toggle('is-current'");
  });

  it('never locks body scroll', () => {
    expect(js()).not.toMatch(/body\.style\.overflow/);
    expect(js()).not.toMatch(/documentElement\.style\.overflow/);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test -- run src/lib/nav-mobile.test.ts`
Expected: FAIL — the 5 new tests (setupMobileMenu does not exist yet).

- [x] **Step 3: Implement**

In `src/scripts/site.js`, add a new section before `// --- Init ---`:

```js
// --- Mobile burger menu --------------------------------------------------------
//
// Full-screen cream panel (spec 2026-07-13). The panel is always in the DOM
// (inert while closed); open/close only toggles classes + inert, never body
// overflow (project rule — the opaque panel plus overscroll-behavior:contain
// covers scroll containment). The current section is computed once at open
// time from the anchor targets — cheaper than a permanent IntersectionObserver
// for something only visible while the menu is open.

function markCurrentSection(links) {
  let current = null;
  for (const a of links) {
    const target = document.getElementById(a.hash.slice(1));
    // 124px = fixed nav (84) + enough of the section actually on screen
    if (target && target.getBoundingClientRect().top <= 124) current = a;
  }
  links.forEach((a) => a.classList.toggle('is-current', a === current));
}

function setupMobileMenu() {
  const burger = document.getElementById('nav-burger');
  const panel = document.getElementById('nav-panel');
  if (!burger || !panel) return;
  const closeBtn = panel.querySelector('.panel-close');
  const links = Array.from(panel.querySelectorAll('.panel-links a'));

  const openMenu = () => {
    markCurrentSection(links);
    panel.inert = false;
    panel.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  };

  const closeMenu = () => {
    panel.classList.remove('open');
    panel.inert = true;
    burger.setAttribute('aria-expanded', 'false');
    burger.focus({ preventScroll: true });
  };

  burger.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  // closing first lets the native anchor jump happen on the revealed page
  links.forEach((a) => a.addEventListener('click', closeMenu));

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(panel.querySelectorAll('a, button'));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}
```

And in the init section, after `highlightToday();`:

```js
setupMobileMenu();
```

- [x] **Step 4: Run tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test`
Expected: PASS, full suite green.

- [x] **Step 5: Interactive visual check**

Rebuild + preview as in Task 1 Step 6, then:

```js
import { chromium } from '/home/vincent/projects/kiddo/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:4322/');
await page.waitForTimeout(600);
// scroll into a section so the current mark is meaningful
await page.evaluate(() => document.getElementById('evenements').scrollIntoView());
await page.waitForTimeout(400);
await page.click('#nav-burger');
await page.waitForTimeout(900); // panel fade
await page.screenshot({ path: 'nav-mobile-open.png' });
// Escape closes and returns focus to the burger
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const state = await page.evaluate(() => ({
  open: document.getElementById('nav-panel').classList.contains('open'),
  focus: document.activeElement?.id,
  expanded: document.getElementById('nav-burger').getAttribute('aria-expanded'),
}));
console.log(state); // { open: false, focus: 'nav-burger', expanded: 'false' }
await page.screenshot({ path: 'nav-mobile-reclosed.png' });
await browser.close();
```

READ `nav-mobile-open.png`: panel matches the mockup, « Rencontres » is navy with the red dash. Compare against `docs/superpowers/specs/2026-07-13-mobile-burger-menu-mockup.png`.

- [x] **Step 6: Commit**

```bash
git add src/scripts/site.js src/lib/nav-mobile.test.ts
git commit -m "feat: burger panel open/close with focus trap and current-section mark"
```

---

### Task 3: Link cascade + one-shot feather burst + reduced motion

**Files:**
- Modify: `src/scripts/site.js`, `src/components/Nav.astro` (cascade CSS only)
- Test: `src/lib/nav-mobile.test.ts` (extend)

**Interfaces:**
- Consumes: `openMenu`/`closeMenu` from Task 2, `.panel-feathers` container from Task 1, existing `ensureSeeds()`, `heroSeeds`, `buildFeather(seed, maskUrl)`, `featherMaskUrl(container)`, `FEATHER_OPACITY_FACTOR`, `amp()`.
- Produces: `buildFeather(seed, maskUrl, { once })` (backward compatible — existing `fillLayer` call is untouched); `spawnFeatherBurst(container)`.

- [x] **Step 1: Write the failing tests**

Append to `src/lib/nav-mobile.test.ts`:

```ts
describe('mobile burger menu — animations (spec 2026-07-13, task 3)', () => {
  const js = () => read('src/scripts/site.js');
  const nav = () => read('src/components/Nav.astro');

  it('buildFeather supports one-shot mode and removes the node when done', () => {
    expect(js()).toContain('function buildFeather(seed, maskUrl, { once = false } = {})');
    expect(js()).toContain('iterations: 1');
    expect(js()).toContain('outer.remove()');
  });

  it('spawns the burst from the baked hero seeds, skipped in discret mode', () => {
    expect(js()).toContain('function spawnFeatherBurst(');
    expect(js()).toMatch(/spawnFeatherBurst[\s\S]{0,200}amp\(\) === 0/);
    expect(js()).toContain('heroSeeds.slice(0, 7)');
  });

  it('clears burst feathers when the menu closes', () => {
    expect(js()).toMatch(/closeMenu[\s\S]{0,300}replaceChildren\(\)/);
  });

  it('staggers the link cascade and disables it in discret mode', () => {
    expect(nav()).toContain('calc(var(--i) * 60ms');
    expect(nav()).toMatch(/data-intensite="discret"[^{]*\{[^}]*transition: none/);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test -- run src/lib/nav-mobile.test.ts`
Expected: FAIL — the 4 new tests.

- [x] **Step 3: Implement the JS**

3a. In `src/scripts/site.js`, change `buildFeather`'s signature and animation call. The signature becomes:

```js
function buildFeather(seed, maskUrl, { once = false } = {}) {
```

and the `path.animate(...)` options argument (currently `{ duration: seed.dur * 1000, iterations: Infinity, delay: -seed.phase * seed.dur * 1000 }`) becomes:

```js
    once
      ? // burst feather: seed.phase is a stagger delay in seconds, one fall, then gone
        { duration: seed.dur * 1000, iterations: 1, delay: seed.phase * 1000, fill: 'both' }
      : { duration: seed.dur * 1000, iterations: Infinity, delay: -seed.phase * seed.dur * 1000 },
```

Capture the animation and clean up after one-shot falls — right after the `path.animate(...)` call:

```js
  if (once) {
    // interrupted (menu closed -> replaceChildren) rejects finished: ignore
    anim.finished.then(() => outer.remove()).catch(() => {});
  }
```

(assign `const anim = path.animate(...)` — the return value is currently unused.)

3b. Add after `fillLayer` in the feathers section:

```js
// One-shot burst for the mobile menu opening: reuse the baked hero seeds
// (physics already paid at idle time), shorter fall, fixed per-index stagger
// so no randomness runs at open time.
function spawnFeatherBurst(container) {
  if (!container || amp() === 0) return;
  ensureSeeds();
  const maskUrl = featherMaskUrl(container);
  heroSeeds.slice(0, 7).forEach((seed, i) => {
    const outer = buildFeather(
      {
        ...seed,
        opacity: seed.o * FEATHER_OPACITY_FACTOR,
        dur: 4.5 + (i % 3) * 1.2,
        phase: i * 0.13,
      },
      maskUrl,
      { once: true },
    );
    container.appendChild(outer);
  });
}
```

3c. In `setupMobileMenu`, wire the burst. Add at the top of the function (after the `links` const):

```js
  const featherLayer = panel.querySelector('.panel-feathers');
```

In `openMenu`, after `burger.setAttribute('aria-expanded', 'true');`:

```js
    spawnFeatherBurst(featherLayer);
```

In `closeMenu`, after `burger.setAttribute('aria-expanded', 'false');`:

```js
    featherLayer.replaceChildren(); // drop in-flight burst feathers
```

- [x] **Step 4: Implement the cascade CSS**

In `src/components/Nav.astro` styles, after the `.panel-links a.is-current::after` rule:

```css
  /* cascade: links rise in as the panel fades (transforms/opacity only) */
  .panel-links a {
    opacity: 0;
    transform: translateY(14px);
  }
  .nav-panel.open .panel-links a {
    opacity: 1;
    transform: none;
    transition:
      opacity 0.5s cubic-bezier(0.22, 0.61, 0.21, 1) calc(var(--i) * 60ms + 100ms),
      transform 0.55s cubic-bezier(0.22, 0.61, 0.21, 1) calc(var(--i) * 60ms + 100ms);
  }
  /* discret: no cascade, no panel fade — everything instant */
  :root[data-intensite="discret"] .nav-panel,
  :root[data-intensite="discret"] .panel-links a {
    transition: none !important;
  }
```

(The duplicate `.panel-links a` selector is intentional: base rules earlier, animation state here — keep them adjacent to the `.open` rule they pair with. `data-intensite` is set from `prefers-reduced-motion` in `Base.astro`/`site.js`, so this also covers OS reduced motion.)

- [x] **Step 5: Run tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test`
Expected: PASS, full suite green (site.test.ts's feather assertions still match — `buildFeather` body is extended, not rewritten).

- [x] **Step 6: Visual check (burst + cascade + reduced motion)**

Rebuild + preview, then:

```js
import { chromium } from '/home/vincent/projects/kiddo/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:4322/');
await page.waitForTimeout(1500); // let idle-time seed generation run
await page.click('#nav-burger');
await page.waitForTimeout(700);
await page.screenshot({ path: 'nav-burst-mid.png' }); // feathers mid-fall + cascade
await page.waitForTimeout(8000);
const leftover = await page.evaluate(() => document.querySelector('.panel-feathers').children.length);
console.log({ leftover }); // 0 — every one-shot feather removed itself
// reduced motion: no burst, instant panel
const rm = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await rm.goto('http://localhost:4322/');
await rm.waitForTimeout(600);
await rm.click('#nav-burger');
await rm.waitForTimeout(300);
const rmFeathers = await rm.evaluate(() => document.querySelector('.panel-feathers').children.length);
console.log({ rmFeathers }); // 0 — burst skipped in discret
await rm.screenshot({ path: 'nav-open-reduced-motion.png' });
await browser.close();
```

READ `nav-burst-mid.png` (feathers visible over the panel) and `nav-open-reduced-motion.png` (panel fully readable, no feathers).

- [x] **Step 7: Commit**

```bash
git add src/scripts/site.js src/components/Nav.astro src/lib/nav-mobile.test.ts
git commit -m "feat: feather burst and link cascade on menu open, cut in reduced motion"
```

---

### Task 4: End-to-end verification pass

**Files:**
- No source changes expected (fix + amend into the relevant task's commit if something surfaces).

**Interfaces:** none — this task gates the branch.

- [x] **Step 1: Full test suite**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test`
Expected: PASS, zero failures.

- [x] **Step 2: Desktop non-regression vs main**

Save this as `shoot-desktop.mjs` in the scratchpad (`SUFFIX` distinguishes the two runs):

```js
import { chromium } from '/home/vincent/projects/kiddo/node_modules/playwright/index.mjs';
const suffix = process.env.SUFFIX; // 'branch' or 'main'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4322/'); // use the exact URL preview printed
await page.waitForTimeout(1200);
await page.locator('#site-nav').screenshot({ path: `nav-desktop-${suffix}.png` });
await browser.close();
```

Then:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
npm run build && (npm run preview -- --port 4322 &) && sleep 2
SUFFIX=branch node shoot-desktop.mjs
kill %1
git status --short   # MUST be clean before switching branches
git checkout main
npm run build && (npm run preview -- --port 4322 &) && sleep 2
SUFFIX=main node shoot-desktop.mjs
kill %1
git checkout feat/mobile-burger-menu
compare -metric AE nav-desktop-main.png nav-desktop-branch.png /dev/null
```

Expected: pixel difference 0 (or trivially small anti-aliasing noise; READ both images if non-zero and judge).

- [x] **Step 3: Keyboard pass (playwright)**

```js
import { chromium } from '/home/vincent/projects/kiddo/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:4322/');
await page.waitForTimeout(600);
await page.evaluate(() => document.getElementById('nav-burger').focus());
await page.keyboard.press('Enter'); // opens the panel
await page.waitForTimeout(600);
const afterOpen = await page.evaluate(() => document.activeElement?.className);
// 8 Tabs from .panel-close: logo -> close -> 5 links -> wraps back inside the panel
const inPanel = [];
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('Tab');
  inPanel.push(await page.evaluate(() => document.getElementById('nav-panel').contains(document.activeElement)));
}
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const afterClose = await page.evaluate(() => ({
  focus: document.activeElement?.id,
  open: document.getElementById('nav-panel').classList.contains('open'),
}));
console.log({ afterOpen, inPanel, afterClose });
// expected: afterOpen 'panel-close', inPanel all true, afterClose { focus: 'nav-burger', open: false }
await browser.close();
```

- [x] **Step 4: Mobile screenshot set for Vincent**

Produce and READ: `nav-mobile-closed.png`, `nav-mobile-open.png` (compare to the spec mockup), `nav-burst-mid.png`, `nav-open-reduced-motion.png`. Copy them to the scratchpad and list the paths in the final report.

- [x] **Step 5: Verify git state**

```bash
git status --short && git log --oneline main..HEAD
```

Expected: clean tree, 4 commits on `feat/mobile-burger-menu` (spec + 3 feature commits). Untracked screenshots must NOT be committed.
