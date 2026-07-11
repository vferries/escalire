// Procedural ink-blot sprite generator (spec 2026-07-11).
// Renders vertical sprite strips of an ink stain blooming on paper: polar
// contour driven by periodic angular noise (Washburn-like sqrt growth,
// per-angle creep speed), capillary fingers, satellite droplets. Frames are
// monotone by construction (ink never recedes). White-on-alpha masks, meant
// for the site's mask-image + background-color pipeline.
//
// Usage: node tools/gen-ink.mjs            -> writes public/assets/ink-*.png
//        node tools/gen-ink.mjs --preview  -> also writes ink-preview.png
//                                             (final frames, navy on paper)
// No dependencies: PNG is encoded by hand via node:zlib.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// --- Seeded RNG -----------------------------------------------------------------

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

// Periodic angular noise: random-phase harmonics, amplitude ~ 1/k^falloff.
function angularNoise(rng, { harmonics, amp, falloff = 0.8 }) {
  const terms = [];
  for (let k = 2; k <= harmonics; k++) {
    terms.push({ k, a: (amp / k ** falloff) * (0.5 + rng()), phi: rng() * TAU });
  }
  return (th) => {
    let v = 0;
    for (const { k, a, phi } of terms) v += a * Math.cos(k * th + phi);
    return v;
  };
}

// Static 2D value noise (bilinear over a hashed lattice) for the wash mottle.
function valueNoise2D(seed) {
  const rand = (x, y) => {
    let h = (x * 374761393 + y * 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = rand(xi, yi);
    const b = rand(xi + 1, yi);
    const c = rand(xi, yi + 1);
    const d = rand(xi + 1, yi + 1);
    return a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy;
  };
}

// --- Blot model -------------------------------------------------------------------

// Species presets. Radii are fractions of the canvas half-size.
const SPECIES = {
  wash: {
    rMax: 0.78,
    rough: { harmonics: 9, amp: 0.1 },
    creep: { harmonics: 7, amp: 0.16 },
    fingers: [2, 4],
    fingerLen: [0.08, 0.18],
    satellites: [0, 0],
    mottle: 0.16,
  },
  splat: {
    rMax: 0.6,
    rough: { harmonics: 16, amp: 0.16 },
    creep: { harmonics: 9, amp: 0.22 },
    fingers: [5, 8],
    fingerLen: [0.18, 0.42],
    satellites: [4, 7],
    mottle: 0.08,
  },
  accent: {
    rMax: 0.52,
    rough: { harmonics: 12, amp: 0.14 },
    creep: { harmonics: 8, amp: 0.2 },
    fingers: [3, 5],
    fingerLen: [0.14, 0.3],
    satellites: [2, 3],
    mottle: 0.08,
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const pick = (rng, [lo, hi]) => lo + rng() * (hi - lo);
const pickInt = (rng, [lo, hi]) => Math.round(pick(rng, [lo, hi]));

// Build per-frame polar radius LUTs (in canvas-half-size units) + satellites.
function makeBlot(species, seed, frames) {
  const p = SPECIES[species];
  if (!p) throw new Error(`unknown species: ${species}`);
  const rng = mulberry32(seed * 2654435761 + 1);
  const rough = angularNoise(rng, p.rough);
  const creep = angularNoise(rng, p.creep);

  // wider sigma = liquid lobes rather than spikes; the tip bulb is added as a
  // satellite droplet riding the finger end (teardrop read)
  const fingers = Array.from({ length: pickInt(rng, p.fingers) }, () => ({
    at: rng() * TAU,
    sigma: 0.09 + rng() * 0.09,
    len: pick(rng, p.fingerLen),
    activate: 0.2 + rng() * 0.5,
  }));

  const N = 720;
  const luts = [];
  let prev = null;
  for (let f = 0; f < frames; f++) {
    const t = (f + 1) / frames;
    const base = Math.sqrt(t);
    const lut = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const th = (i / N) * TAU;
      const speed = 1 + creep(th);
      let r = p.rMax * (1 + rough(th)) * Math.min(1, base * speed);
      for (const fg of fingers) {
        // shortest angular distance to the finger axis
        let d = Math.abs(th - fg.at) % TAU;
        if (d > Math.PI) d = TAU - d;
        r +=
          fg.len *
          Math.exp((-d * d) / (2 * fg.sigma * fg.sigma)) *
          smooth((t - fg.activate) / (1 - fg.activate));
      }
      lut[i] = prev ? Math.max(prev[i], r) : r; // ink never recedes
    }
    luts.push(lut);
    prev = lut;
  }

  const mkSatellite = (th, dist, r, activate) => ({
    th,
    dist,
    r,
    stretch: 1.2 + rng() * 0.8, // elongated along the splash direction
    activate,
    wobble: angularNoise(rng, { harmonics: 5, amp: 0.18 }),
  });
  const satellites = Array.from({ length: pickInt(rng, p.satellites) }, () => {
    const th = rng() * TAU;
    const edge = prev[Math.floor((th / TAU) * N) % N];
    return mkSatellite(th, edge * (1.12 + rng() * 0.4), 0.03 + rng() * 0.06, 0.4 + rng() * 0.45);
  });
  // bulb at the tip of each long finger: reads as a teardrop, not a spike
  for (const fg of fingers) {
    if (fg.len < 0.2) continue;
    const edge = prev[Math.floor((fg.at / TAU) * N) % N];
    satellites.push(mkSatellite(fg.at, edge * 0.99, 0.05 + fg.len * 0.16, fg.activate + 0.1));
  }

  // normalize so any seed fits the canvas with a small margin
  let extent = 0;
  for (const r of prev) extent = Math.max(extent, r);
  for (const s of satellites) extent = Math.max(extent, s.dist + s.r * s.stretch * 1.3);
  const fit = Math.min(1, 0.96 / extent);
  if (fit < 1) {
    for (const lut of luts) for (let i = 0; i < lut.length; i++) lut[i] *= fit;
    for (const s of satellites) {
      s.dist *= fit;
      s.r *= fit;
    }
  }

  return { luts, satellites, mottleAmp: p.mottle };
}

const lutRadius = (lut, th) => {
  const N = lut.length;
  const f = ((th / TAU) * N + N) % N;
  const i = Math.floor(f) % N;
  return lut[i] + (lut[(i + 1) % N] - lut[i]) * (f - Math.floor(f));
};

// --- Rasterizer -------------------------------------------------------------------

// Renders a vertical strip: `frames` stacked square frames of `size` px.
// Returns straight-alpha RGBA (white ink), 2x2 subsampled per pixel.
export function renderSprite(species, seed, { size = 768, frames = 10 } = {}) {
  const { luts, satellites, mottleAmp } = makeBlot(species, seed, frames);
  const mottle = valueNoise2D(seed * 31 + 7);
  const half = size / 2;
  const pixels = new Uint8Array(size * size * frames * 4);
  const SUB = [0.25, 0.75];

  for (let f = 0; f < frames; f++) {
    const t = (f + 1) / frames;
    const lut = luts[f];
    const frameOff = f * size * size * 4;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let cover = 0;
        for (const sy of SUB) {
          for (const sx of SUB) {
            const dx = (x + sx - half) / half;
            const dy = (y + sy - half) / half;
            const r = Math.sqrt(dx * dx + dy * dy);
            const th = Math.atan2(dy, dx);
            if (r < lutRadius(lut, th)) {
              cover++;
              continue;
            }
            for (const s of satellites) {
              const g = smooth((t - s.activate) / (1 - s.activate));
              if (g === 0) continue;
              const cx = Math.cos(s.th) * s.dist;
              const cy = Math.sin(s.th) * s.dist;
              // satellite frame: u along the splash direction (stretched)
              const ux = dx - cx;
              const uy = dy - cy;
              const cos = Math.cos(s.th);
              const sin = Math.sin(s.th);
              const lu = (ux * cos + uy * sin) / s.stretch;
              const lv = -ux * sin + uy * cos;
              const sr = Math.sqrt(lu * lu + lv * lv);
              const sth = Math.atan2(lv, lu);
              if (sr < s.r * g * (1 + s.wobble(sth))) {
                cover++;
                break;
              }
            }
          }
        }
        if (cover === 0) continue;
        // subtle 2-octave mottle, static per (x,y) so growth stays monotone and
        // scaled to the canvas so production renders match the preview
        const g = size * 0.055;
        const n = 0.65 * mottle(x / g, y / g) + 0.35 * mottle((x * 2.3) / g, (y * 2.3) / g);
        let m = 1 - mottleAmp * n;
        // edge pooling on the FINAL frame only (a moving rim would bake
        // "growth rings" into the accumulated frames), like drying ink
        if (f === frames - 1) {
          const dx0 = (x + 0.5 - half) / half;
          const dy0 = (y + 0.5 - half) / half;
          const rr = Math.sqrt(dx0 * dx0 + dy0 * dy0);
          if (rr > lutRadius(lut, Math.atan2(dy0, dx0)) * 0.93) m = Math.min(1, m + 0.06);
        }
        const o = frameOff + (y * size + x) * 4;
        // deposited ink stays: the wet rim sweeps outward but never lightens
        // a pixel it already darkened (keeps frames monotone)
        const prevA = f > 0 ? pixels[o - size * size * 4 + 3] : 0;
        // quantize alpha (32 levels): invisible once tinted, compresses ~3x better
        const q = Math.round(((cover / 4) * 255 * m) / 8) * 8;
        const a = Math.max(Math.min(q, 255) | 0, prevA);
        pixels[o] = 255;
        pixels[o + 1] = 255;
        pixels[o + 2] = 255;
        pixels[o + 3] = a;
      }
    }
  }
  return { width: size, height: size * frames, pixels, frames };
}

// --- PNG encoder ------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePNG(width, height, rgba, { grayAlpha = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = grayAlpha ? 4 : 6; // color type: gray+alpha (masks) or RGBA
  const bpp = grayAlpha ? 2 : 4;
  const raw = Buffer.alloc(height * (1 + width * bpp));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * bpp) + 1; // preceded by filter byte 0 (None)
    if (grayAlpha) {
      for (let x = 0; x < width; x++) {
        raw[row + x * 2] = rgba[(y * width + x) * 4];
        raw[row + x * 2 + 1] = rgba[(y * width + x) * 4 + 3];
      }
    } else {
      Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, row);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- CLI --------------------------------------------------------------------------

// Production set: species/seed per site slot (hero washes, section splats, accent).
export const PRODUCTION = [
  { file: 'ink-wash-a.png', species: 'wash', seed: 11 },
  { file: 'ink-wash-b.png', species: 'wash', seed: 23 },
  { file: 'ink-splat-hero.png', species: 'splat', seed: 87 },
  { file: 'ink-splat-librairie.png', species: 'splat', seed: 41 },
  { file: 'ink-splat-rencontres.png', species: 'splat', seed: 57 },
  { file: 'ink-accent.png', species: 'accent', seed: 71 },
  { file: 'ink-accent-coups.png', species: 'accent', seed: 103 },
  { file: 'ink-accent-equipe.png', species: 'accent', seed: 119 },
];

function renderPreview(entries, cell = 360) {
  // final frames only, navy on paper, in a row-per-species grid
  const cols = Math.min(entries.length, 4);
  const rows = Math.ceil(entries.length / cols);
  const W = cols * cell;
  const H = rows * cell;
  const img = new Uint8Array(W * H * 4);
  const paper = [0xfa, 0xf6, 0xef];
  const navy = [0x2b, 0x3f, 0x77];
  for (let i = 0; i < W * H; i++) {
    img[i * 4] = paper[0];
    img[i * 4 + 1] = paper[1];
    img[i * 4 + 2] = paper[2];
    img[i * 4 + 3] = 255;
  }
  entries.forEach(({ species, seed, frame }, idx) => {
    const s = renderSprite(species, seed, { size: cell, frames: 5 });
    const shown = (frame ?? 4) * cell * cell * 4;
    const ox = (idx % cols) * cell;
    const oy = Math.floor(idx / cols) * cell;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const a = s.pixels[shown + (y * cell + x) * 4 + 3] / 255;
        if (a === 0) continue;
        const o = ((oy + y) * W + ox + x) * 4;
        img[o] = lerp(img[o], navy[0], a);
        img[o + 1] = lerp(img[o + 1], navy[1], a);
        img[o + 2] = lerp(img[o + 2], navy[2], a);
      }
    }
  });
  return encodePNG(W, H, img);
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  if (process.argv.includes('--preview')) {
    const variants = [];
    for (const species of ['wash', 'splat', 'accent']) {
      for (const seed of [11, 23, 41, 57]) variants.push({ species, seed });
    }
    // last row: the bloom itself, frames 1..5 of one splat
    for (let frame = 0; frame < 4; frame++) variants.push({ species: 'splat', seed: 41, frame });
    writeFileSync('ink-preview.png', renderPreview(variants));
    console.log('wrote ink-preview.png');
  } else {
    // optional args: only regenerate the named sprites (e.g. ink-accent-coups.png)
    const only = process.argv.slice(2).filter((a) => a.endsWith('.png'));
    for (const { file, species, seed } of PRODUCTION) {
      if (only.length && !only.includes(file)) continue;
      const s = renderSprite(species, seed);
      const png = encodePNG(s.width, s.height, s.pixels, { grayAlpha: true });
      writeFileSync(`public/assets/${file}`, png);
      console.log(`wrote public/assets/${file} (${s.width}x${s.height}, ${(png.length / 1024).toFixed(0)} KB)`);
    }
  }
}
