import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
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

describe('static map (spec SP5 I2)', () => {
  const infos = () => read('src/components/Infos.astro');
  it('ships a committed map image of a plausible size', () => {
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

describe('natural feather motion (spec 2026-07-10, v3 physics)', () => {
  const css = () => read('src/styles/global.css');
  const js = () => read('src/scripts/site.js');
  it('bakes the simulated trajectory into a WAAPI animation per feather', () => {
    expect(js()).toContain("from '../lib/feather-physics.js'");
    expect(js()).toContain('toLoopingKeyframes');
    expect(js()).toMatch(/\.animate\(/);
    expect(js()).toMatch(/iterations: Infinity/);
  });
  it('drops the v2 CSS fall/sway keyframes (position+pitch live in the baked path)', () => {
    expect(css()).not.toContain('@keyframes featherFall');
    expect(css()).not.toContain('@keyframes featherSway');
    expect(js()).not.toContain('featherFall');
    expect(js()).not.toContain('featherSway');
  });
  it('keeps the 3D flutter quiver on every feather', () => {
    expect(css()).toContain('@keyframes featherFlutter');
    expect(js()).toContain('featherFlutter');
  });
  it('replaces continuous twirls with a small per-turn flip chance on every feather', () => {
    expect(css()).not.toContain('featherTwirl');
    expect(js()).not.toContain('featherTwirl');
    expect(js()).toContain('addFlips');
    expect(js()).toMatch(/rotateY\(/);
  });
  it('lays the feathers flat and dampens the simulated pitch for the flat look', () => {
    expect(js()).toMatch(/rot: 254 \+ Math\.random\(\) \* 32/);
    expect(js()).toMatch(/thScale/);
  });
  it('mirrors in screen space so the curved side stays down on both variants', () => {
    expect(js()).toMatch(/mirror \? 'scaleX\(-1\) ' : ''/);
    expect(js()).not.toMatch(/rotate\(\$\{seed\.rot\}deg\)\$\{seed\./);
  });
  it('keeps the physics off the critical path: first build deferred to idle', () => {
    expect(js()).toMatch(/requestIdleCallback/);
  });
});

describe('encres vivantes (spec 2026-07-11)', () => {
  const css = () => read('src/styles/global.css');
  const js = () => read('src/scripts/site.js');
  it('adds the ink-bloom reveal: mask-position stepping through the 10-frame sprite', () => {
    expect(js()).toContain("'ink-bloom'");
    expect(js()).toMatch(/steps\(20, jump-none\)/);
    expect(css()).toContain('@keyframes inkBloomIn');
    expect(css()).toMatch(/steps\(20, jump-none\)/);
    expect(css()).toMatch(/mask-size: 100% 2000%/);
    expect(css()).toContain('@keyframes inkWet'); // wet-blur smooths the frame steps
  });
  it('gives the inks a slow compositor-only life, killed in discret', () => {
    expect(css()).toContain('@keyframes inkBreathe');
    expect(css()).toMatch(/discret[^{]*\.ink-alive[\s\S]{0,200}?animation: none/);
  });
  it('wires the generated sprites into the sections', () => {
    const hero = read('src/components/Hero.astro');
    expect(hero).toContain('ink-wash-a.png');
    expect(hero).toContain('ink-wash-b.png');
    expect(hero).toContain('ink-accent.png');
    expect(hero).toContain('ink-splat-hero.png');
    expect(hero).not.toContain('assets/ink-splat.png');
    const librairie = read('src/components/Librairie.astro');
    expect(librairie).toContain('ink-splat-librairie.png');
    expect(librairie).toContain('data-reveal="ink-bloom"');
    expect(librairie).not.toContain('assets/ink-splat.png');
    const rencontres = read('src/components/Rencontres.astro');
    expect(rencontres).toContain('ink-splat-rencontres.png');
    expect(rencontres).toContain('data-reveal="ink-bloom"');
    expect(rencontres).not.toContain('assets/ink-splat.png');
    for (const [file, sprite] of [
      ['CoupsDeCoeur.astro', 'ink-accent-coups.png'],
      ['Equipe.astro', 'ink-accent-equipe.png'],
    ]) {
      const c = read(`src/components/${file}`);
      expect(c).toContain(sprite);
      expect(c).toContain('data-reveal="ink-bloom"');
      expect(c).not.toContain('assets/ink-splat.png');
    }
  });
  it('commits valid production sprites', () => {
    for (const f of [
      'ink-wash-a.png',
      'ink-wash-b.png',
      'ink-splat-hero.png',
      'ink-splat-librairie.png',
      'ink-splat-rencontres.png',
      'ink-accent.png',
      'ink-accent-coups.png',
      'ink-accent-equipe.png',
    ]) {
      const buf = readFileSync(root + 'public/assets/' + f);
      expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(buf.readUInt32BE(20) / buf.readUInt32BE(16)).toBe(20); // 20-frame strip
    }
  });
});

describe('mentions légales (spec SP5 I3/I4)', () => {
  it('carries the exact legal identifiers', () => {
    const page = read('src/pages/mentions-legales.astro');
    expect(page).toContain('SARL Librairie Escalire');
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
      'https://escalire.fr/mentions-legales/'
    );
  });
  it('nav anchors are base-absolute so they work from subpages', () => {
    const nav = read('src/components/Nav.astro');
    expect(nav).toContain("`${base}#librairie`");
    expect(nav).toContain('href={`${base}#accueil`}');
  });
  it('emits the BookStore JSON-LD on the home page only', () => {
    expect(read('src/layouts/Base.astro')).toContain(
      '{isHome && <script type="application/ld+json"'
    );
  });
  it('credits the site author', () => {
    expect(read('src/pages/mentions-legales.astro')).toContain('enveille.info');
  });
});

describe('LCP element vs hero entrance (perf audit 2026-07-13)', () => {
  it('marks the hero logo as the LCP element', () => {
    expect(read('src/components/Hero.astro')).toMatch(
      /<img[^>]*data-entrance="0"[^>]*data-lcp/
    );
  });
  it('never hides the LCP element — transform-only entrance', () => {
    // hiding it with opacity:0 postpones LCP until the JS fade-in completes
    expect(read('src/scripts/site.js')).toContain("'lcp' in el.dataset");
  });
  it('keeps the logo light enough for the slow-4G budget', () => {
    // 139 KB original starved the LCP request; palette-quantized to ~42 KB
    const bytes = readFileSync(root + 'public/assets/logo-escalire.png').length;
    expect(bytes).toBeLessThan(60_000);
  });
  it('does not preload the burger-panel feather decor', () => {
    // panel is closed at load time; eager fetch competed with the LCP image
    expect(read('src/components/Nav.astro')).toMatch(
      /class="panel-decor"[^>]*loading="lazy"/
    );
  });
});

describe('footer feather vs links (mobile audit 2026-07-13)', () => {
  const footer = () => read('src/components/Footer.astro');

  it('never intercepts taps on the links', () => {
    expect(footer()).toMatch(/\.footer-feather\s*\{[^}]*pointer-events: none/);
  });
  it('shrinks into the corner below 1024px where it would cover the link row', () => {
    expect(footer()).toMatch(
      /@media \(max-width: 1023px\)[\s\S]{0,200}\.footer-feather/
    );
  });
});
