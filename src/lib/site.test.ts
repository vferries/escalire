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
