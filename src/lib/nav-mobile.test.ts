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
