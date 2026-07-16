import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { HORAIRE_CMS_PATTERN, HORAIRE_REGEX } from './horaires';

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
      ['title', 'date', 'legende', 'type', 'guest', 'image', 'link', 'published', 'body'].sort()
    );
    // Free text replacing the whole auto caption (« date — titre ») so
    // all-day events or registration notes read naturally; optional because
    // the auto caption is usually enough
    const legende = c.fields.find((f: any) => f.name === 'legende');
    expect(legende.required).toBe(false);
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
        // Sveltia runs `pattern` even on empty optional fields, so the CMS
        // pattern must accept '' (closed day) on top of the strict format.
        expect(creneau.pattern[0]).toBe(HORAIRE_CMS_PATTERN);
      }
    }
  });

  it('CMS hours pattern accepts closed days but stays as strict as the site schema', () => {
    const cms = new RegExp(HORAIRE_CMS_PATTERN);
    expect(cms.test('')).toBe(true);
    expect(cms.test('10h00 – 12h30')).toBe(true);
    // Sveltia stringifies a JSON null into 'null' before testing the pattern
    expect(cms.test('null')).toBe(false);
    expect(cms.test('10h00 - 12h30')).toBe(false); // hyphen, not en-dash
    expect(HORAIRE_REGEX.test('10h00 – 12h30')).toBe(true);
    expect(HORAIRE_REGEX.test('')).toBe(false);
  });

  it('never stores null hours in infos.json (null breaks Sveltia validation)', () => {
    // Closed days/slots are either omitted (Sveltia omit_empty_optional_fields)
    // or empty strings — both fine. A null would become the string 'null' in
    // Sveltia's draft and block every save of the infos entry again.
    const infos = JSON.parse(
      readFileSync(fileURLToPath(new URL('../content/infos.json', import.meta.url)), 'utf8')
    );
    for (const jour of Object.values<any>(infos.horaires)) {
      for (const creneau of [jour.matin, jour.apresMidi]) {
        if (creneau === undefined) continue;
        expect(typeof creneau).toBe('string');
        expect(new RegExp(HORAIRE_CMS_PATTERN).test(creneau)).toBe(true);
      }
    }
  });

  it('edits textes.json with the exact schema fields', () => {
    const f = byName['textes'].files[0];
    expect(f.file).toBe('src/content/textes.json');
    expect(names(f.fields).sort()).toEqual(
      ['slogan', 'sousTitre', 'librairieTitre', 'librairieP1', 'librairieP2', 'rayons'].sort()
    );
    // Optional in the CMS ⇒ the site schema must accept the omitted key too
    // (omit_empty_optional_fields drops it from textes.json on save)
    const slogan = f.fields.find((x: any) => x.name === 'slogan');
    expect(slogan.required).toBe(false);
  });
});
