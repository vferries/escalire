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

describe('natural feather motion (spec 2026-07-10)', () => {
  const css = () => read('src/styles/global.css');
  const js = () => read('src/scripts/site.js');
  it('rocks like a pendulum: max tilt at the swing extremes, level mid-swing', () => {
    expect(css()).toMatch(/featherSway[\s\S]*?0%\s*\{[^}]*rotate\(var\(--swayR\)\)/);
    expect(css()).toMatch(/50%\s*\{[^}]*rotate\(calc\(var\(--swayR\) \* -1\)\)/);
    expect(css()).toMatch(/25%\s*\{[^}]*rotate\(0deg\)/);
  });
  it('descends along a pendulum arc: low point mid-swing, high at the extremes', () => {
    expect(css()).toMatch(/25%\s*\{[^}]*translateY\(var\(--swayY\)\)/);
    expect(css()).toMatch(/featherSway[\s\S]*?0%\s*\{[^}]*translateY\(0\)/);
  });
  it('lays the feathers flat: base rotation near horizontal', () => {
    expect(js()).toMatch(/rot: 74 \+ Math\.random\(\) \* 32/);
  });
  it('gives the fall an aperiodic horizontal drift', () => {
    expect(css()).toMatch(/@keyframes featherFall[\s\S]*?var\(--driftX\)/);
  });
  it('ships the 3D flutter and twirl variants', () => {
    expect(css()).toContain('@keyframes featherFlutter');
    expect(css()).toContain('@keyframes featherTwirl');
  });
  it('seeds per-feather variables and builds the flutter wrapper', () => {
    expect(js()).toContain('--swayX');
    expect(js()).toContain('featherFlutter');
    expect(js()).toContain('featherTwirl');
  });
  it('couples the sway period to the glide amplitude (long pendulum)', () => {
    expect(js()).toMatch(/sway: 2\.6 \+ swayX \* 0\.055/);
  });
});

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
  it('emits the BookStore JSON-LD on the home page only', () => {
    expect(read('src/layouts/Base.astro')).toContain(
      '{isHome && <script type="application/ld+json"'
    );
  });
  it('credits the site author', () => {
    expect(read('src/pages/mentions-legales.astro')).toContain('enveille.info');
  });
});
