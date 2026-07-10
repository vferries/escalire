// Regenerates public/assets/map-escalire.jpg (the RGPD-friendly static map).
// One-off tool — run it again only if the map look, marker or coords change.
// Usage: `npm run dev` in another terminal, then:
//   npm install --no-save playwright && node tools/capture-map.mjs
// (`npx -p playwright node ...` does NOT work: the ESM import resolves
// node_modules relative to this file, not the npx cache. `--no-save`
// leaves package.json/lockfile untouched; `npm ci` cleans up afterwards.)
// Requires desktop Chrome (channel: 'chrome' — no browser download).
import { chromium } from 'playwright';

const url = process.env.MAP_URL ?? 'http://localhost:4321/escalire/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 });
await page.goto(url);
const map = page.locator('#map-escalire');
await map.scrollIntoViewIfNeeded();
await page.locator('.map-consent').click();
await page.waitForTimeout(5000); // let CARTO tiles and the marker popup settle
await map.screenshot({ path: 'public/assets/map-escalire.jpg', type: 'jpeg', quality: 80 });
await browser.close();
console.log('wrote public/assets/map-escalire.jpg');
