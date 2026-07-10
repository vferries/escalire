// Fills titre/auteur/editeur of coups de cœur from their ISBN (spec SP4).
// Sources: BnF SRU (primary), Google Books (anonymous fallback — may 429).
// Hand-entered values always win: only missing/empty fields are filled.
// An unresolvable ISBN leaves the file untouched (the site skips entries
// without titre) and emits a ::warning:: annotation — exit code is always 0.
// Usage: node tools/enrich-isbn.mjs [--dry-run]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = 'src/content/coups-de-coeur';
const CAPS = { titre: 120, auteur: 80, editeur: 60 };
const ENRICHABLE = Object.keys(CAPS);

const clamp = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() : s);
const decodeXml = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

export function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return fields;
}

export function missingFields(fields) {
  return ENRICHABLE.filter((k) => !fields[k]);
}

export function parseBnf(xml) {
  const pick = (tag) => {
    const m = xml.match(new RegExp(`<dc:${tag}[^>]*>([^<]+)</dc:${tag}>`));
    return m ? decodeXml(m[1]).trim() : undefined;
  };
  const rawTitle = pick('title');
  if (!rawTitle) return null;
  const meta = { titre: rawTitle.split(' / ')[0].trim() };
  const rawCreator = pick('creator');
  if (rawCreator) {
    // « Panchaud, Martin (1982-....). Auteur du texte » → « Martin Panchaud »
    const cleaned = rawCreator.split(' (')[0].split(/\.\s/)[0].trim();
    const [nom, prenom] = cleaned.split(',').map((s) => s.trim());
    meta.auteur = prenom ? `${prenom} ${nom}` : nom;
  }
  const rawPublisher = pick('publisher');
  if (rawPublisher) meta.editeur = rawPublisher.split(' (')[0].trim(); // strip the place
  return meta;
}

export function parseGoogleBooks(body) {
  const v = body?.items?.[0]?.volumeInfo;
  if (!v?.title) return null;
  const meta = { titre: v.title };
  if (v.authors?.length) meta.auteur = v.authors.join(', ');
  if (v.publisher) meta.editeur = v.publisher;
  return meta;
}

export function applyEnrichment(md, meta, missing) {
  let out = md;
  for (const key of missing) {
    if (!meta[key]) continue;
    const line = `${key}: "${clamp(meta[key], CAPS[key]).replace(/"/g, '\\"')}"`;
    const existing = new RegExp(`^${key}:.*$`, 'm');
    if (existing.test(out)) out = out.replace(existing, line);
    else out = out.replace(/(\r?\n)---/, (_, nl) => `${nl}${line}${nl}---`); // first newline+--- = closing delimiter
  }
  return out;
}

const warn = (file, msg) => console.warn(`::warning file=${file}::${msg}`);

async function fetchBnf(isbn) {
  const query = encodeURIComponent(`bib.isbn adj "${isbn}"`);
  const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${query}&recordSchema=dublincore&maximumRecords=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BnF HTTP ${res.status}`);
  return parseBnf(await res.text());
}

async function fetchGoogle(isbn) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=FR`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google Books HTTP ${res.status}`);
  return parseGoogleBooks(await res.json());
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  for (const name of readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()) {
    const path = join(DIR, name);
    const md = readFileSync(path, 'utf8');
    const fields = parseFrontmatter(md);
    if (!fields?.isbn13) continue;
    let missing = missingFields(fields);
    if (missing.length === 0) continue;

    const meta = {};
    for (const source of [fetchBnf, fetchGoogle]) {
      if (missing.every((k) => meta[k])) break;
      try {
        Object.assign(meta, Object.fromEntries(
          Object.entries((await source(fields.isbn13)) ?? {}).filter(([k, v]) => v && !meta[k])
        ));
      } catch (e) {
        warn(path, `${source.name} failed for ISBN ${fields.isbn13}: ${e.message}`);
      }
    }

    const filled = missing.filter((k) => meta[k]);
    if (missing.includes('titre') && !meta.titre) {
      warn(path, `ISBN ${fields.isbn13} introuvable (BnF + Google Books) — fiche non publiée tant que le titre manque.`);
    }
    if (filled.length === 0) continue;
    console.log(`${path}: filled ${filled.join(', ')} (ISBN ${fields.isbn13})${dryRun ? ' [dry-run]' : ''}`);
    if (!dryRun) writeFileSync(path, applyEnrichment(md, meta, missing));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
