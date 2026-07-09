import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { HORAIRE_REGEX } from './horaires';

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

describe('admin config ⇆ content.config consistency', () => {
  const config = parse(readFileSync(adminDir + 'config.yml', 'utf8'));
  const byName = Object.fromEntries(config.collections.map((c: any) => [c.name, c]));
  const names = (fields: any[]) => fields.map((f) => f.name);

  it('targets the GitHub repo on main through an OAuth proxy', () => {
    expect(config.backend).toMatchObject({ name: 'github', repo: 'vferries/escalire', branch: 'main' });
    expect(config.backend.base_url).toMatch(/^https:\/\//);
    expect(config.backend.base_url).not.toContain('A-COMPLETER');
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
