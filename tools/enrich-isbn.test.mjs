import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter, missingFields, parseBnf, parseGoogleBooks,
  parseSudocPpn, parseSudocRecord, applyEnrichment,
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
  it('tolerates a UTF-8 BOM at the start of the file', () => {
    expect(parseFrontmatter('﻿' + MD).isbn13).toBe('9782369903086');
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

// Trimmed copies of the real SUDOC responses for ISBN 9782925416890 (2026-07-15).
const SUDOC_PPN = `<?xml version="1.0" encoding="UTF-8"?>
<sudoc service="isbn2ppn">
<query><isbn>9782925416890</isbn><result><ppn>297617699</ppn></result></query></sudoc>`;

const SUDOC_PPN_ERROR = `<?xml version="1.0" encoding="UTF-8"?>
<sudoc service="isbn2ppn"><error>Aucune notice n'est associée à cette valeur 9999999999999</error></sudoc>`;

const SUDOC_RECORD = `<?xml version="1.0" encoding="UTF-8"?>
<record>
  <controlfield tag="001">297617699</controlfield>
  <datafield tag="200" ind1="1" ind2="#">
    <subfield code="a">Les grues volent vers le sud</subfield>
    <subfield code="f">Lisa Ridzén</subfield>
    <subfield code="g">traduit du suédois par Catherine Renaud</subfield>
  </datafield>
  <datafield tag="214" ind1="#" ind2="0">
    <subfield code="a">Montréal (Québec)</subfield>
    <subfield code="c">Éditions La Peuplade</subfield>
    <subfield code="d">DL 2026</subfield>
  </datafield>
  <datafield tag="700" ind1="#" ind2="1">
    <subfield code="a">Ridzén</subfield>
    <subfield code="b">Lisa</subfield>
  </datafield>
</record>`;

describe('parseSudocPpn', () => {
  it('extracts the PPN from a hit', () => {
    expect(parseSudocPpn(SUDOC_PPN)).toBe('297617699');
  });
  it('returns null on the error response', () => {
    expect(parseSudocPpn(SUDOC_PPN_ERROR)).toBeNull();
  });
});

describe('parseSudocRecord', () => {
  it('extracts titre/auteur/editeur from the real UNIMARC record', () => {
    expect(parseSudocRecord(SUDOC_RECORD)).toEqual({
      titre: 'Les grues volent vers le sud',
      auteur: 'Lisa Ridzén', // 200$f is already in natural order
      editeur: 'Éditions La Peuplade',
    });
  });
  it('falls back to 700 $b $a when 200$f is absent', () => {
    const xml = SUDOC_RECORD.replace('<subfield code="f">Lisa Ridzén</subfield>', '');
    expect(parseSudocRecord(xml).auteur).toBe('Lisa Ridzén');
  });
  it('falls back to 210$c for older records without a 214', () => {
    const xml = SUDOC_RECORD
      .replace('tag="214" ind1="#" ind2="0"', 'tag="210" ind1="#" ind2="#"');
    expect(parseSudocRecord(xml).editeur).toBe('Éditions La Peuplade');
  });
  it('returns null without a title', () => {
    const xml = SUDOC_RECORD.replace('<subfield code="a">Les grues volent vers le sud</subfield>', '');
    expect(parseSudocRecord(xml)).toBeNull();
  });
  it('decodes XML entities in values', () => {
    const xml = SUDOC_RECORD.replace('Les grues volent vers le sud', 'Grues &amp; brumes');
    expect(parseSudocRecord(xml).titre).toBe('Grues & brumes');
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
  it('preserves CRLF line endings when inserting into a Windows-authored file', () => {
    const md = `---\r\nisbn13: "1"\r\ncitation: "x"\r\n---\r\n`;
    const out = applyEnrichment(md, { titre: 'Test' }, ['titre']);
    expect(out).toBe(`---\r\nisbn13: "1"\r\ncitation: "x"\r\ntitre: "Test"\r\n---\r\n`);
  });
  it('collapses embedded newlines/whitespace in fetched values', () => {
    const out = applyEnrichment(MD, { titre: 'Un titre\n  sur deux lignes' }, ['titre']);
    expect(out).toContain('titre: "Un titre sur deux lignes"');
  });
  it('escapes backslashes so the YAML scalar stays valid', () => {
    const out = applyEnrichment(MD, { titre: 'Anti\\slash' }, ['titre']);
    expect(out).toContain('titre: "Anti\\\\slash"');
  });
  it('does not expand $-replacement patterns when replacing an existing line', () => {
    const md = `---\nisbn13: "1"\ntitre: ""\n---\n`;
    const out = applyEnrichment(md, { titre: 'Prix: 10$& plus' }, ['titre']);
    expect(out).toContain('titre: "Prix: 10$& plus"');
  });
});
