import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
