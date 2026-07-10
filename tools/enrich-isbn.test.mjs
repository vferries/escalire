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
