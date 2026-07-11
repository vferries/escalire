import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM build tool, no types
import { encodePNG, renderSprite } from '../../tools/gen-ink.mjs';

// Small renders keep the suite fast; invariants hold at any size.
const OPTS = { size: 64, frames: 4 };

describe('ink sprite generator (spec 2026-07-11)', () => {
  it('is deterministic for a given species and seed', () => {
    const a = renderSprite('splat', 7, OPTS);
    const b = renderSprite('splat', 7, OPTS);
    expect(a.width).toBe(64);
    expect(a.height).toBe(64 * 4);
    expect(Buffer.from(a.pixels).equals(Buffer.from(b.pixels))).toBe(true);
    const c = renderSprite('splat', 8, OPTS);
    expect(Buffer.from(a.pixels).equals(Buffer.from(c.pixels))).toBe(false);
  });

  it('grows monotonically: ink never recedes between frames', () => {
    for (const species of ['wash', 'splat', 'accent']) {
      const s = renderSprite(species, 3, OPTS);
      const px = 64 * 64 * 4;
      for (let f = 1; f < 4; f++) {
        for (let i = 3; i < px; i += 4) {
          // alpha of pixel i in frame f vs the same pixel in frame f-1
          expect(s.pixels[f * px + i]).toBeGreaterThanOrEqual(s.pixels[(f - 1) * px + i]);
        }
      }
    }
  });

  it('actually blooms: coverage grows into a sane final footprint', () => {
    const s = renderSprite('splat', 5, OPTS);
    const px = 64 * 64 * 4;
    const coverage = (f: number) => {
      let sum = 0;
      for (let i = 3; i < px; i += 4) sum += s.pixels[f * px + i];
      return sum / (255 * 64 * 64);
    };
    expect(coverage(0)).toBeGreaterThan(0.005);
    expect(coverage(3)).toBeGreaterThan(coverage(0) * 1.5);
    expect(coverage(3)).toBeGreaterThan(0.1);
    expect(coverage(3)).toBeLessThan(0.65);
  });

  it('encodes a valid PNG (signature + IHDR dimensions)', () => {
    const s = renderSprite('accent', 1, OPTS);
    const png = encodePNG(s.width, s.height, s.pixels);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(64); // IHDR width
    expect(png.readUInt32BE(20)).toBe(64 * 4); // IHDR height
  });
});
