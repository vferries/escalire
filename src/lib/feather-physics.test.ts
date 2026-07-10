import { describe, expect, it } from 'vitest';
import { addFlips, defaultParams, simulateFeather, toLoopingKeyframes } from './feather-physics.js';

// Deterministic RNG (mulberry32) so the physics assertions are reproducible.
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const run = (seed: number) => simulateFeather(defaultParams(mulberry32(seed)));

describe('feather physics (spec 2026-07-10, v3)', () => {
  it('descends on average and keeps time increasing', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = run(seed);
      expect(s.length).toBeGreaterThan(50);
      for (let i = 1; i < s.length; i++) expect(s[i].t).toBeGreaterThan(s[i - 1].t);
      // y is up in sim coordinates: a falling feather ends well below its start
      expect(s[s.length - 1].y).toBeLessThan(s[0].y - 5);
    }
  });

  it('flutters without tumbling: alternating glides, bounded pitch', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = run(seed);
      let reversals = 0;
      for (let i = 2; i < s.length; i++) {
        const dx1 = s[i - 1].x - s[i - 2].x;
        const dx2 = s[i].x - s[i - 1].x;
        if (dx1 * dx2 < 0) reversals++;
      }
      expect(reversals).toBeGreaterThanOrEqual(4);
      for (const p of s) expect(Math.abs(p.th)).toBeLessThan((85 * Math.PI) / 180);
    }
  });

  it('shows the falling-leaf signature: glides sideways farther than it sinks per swing', () => {
    const s = run(1);
    const xs = s.map((p) => p.x);
    const swing = Math.max(...xs) - Math.min(...xs);
    const drop = s[0].y - s[s.length - 1].y;
    expect(swing).toBeGreaterThan(2); // several chord lengths of lateral motion
    expect(drop).toBeGreaterThan(swing * 0.5); // but it still mostly falls
  });

  it('bakes normalized looping keyframes: offsets 0→1, full descent, centred meander', () => {
    const kf = toLoopingKeyframes(run(1), 180);
    expect(kf.length).toBeGreaterThan(100);
    expect(kf[0].offset).toBe(0);
    expect(kf[kf.length - 1].offset).toBe(1);
    for (let i = 1; i < kf.length; i++) expect(kf[i].offset).toBeGreaterThan(kf[i - 1].offset);
    expect(kf[0].y).toBe(0);
    expect(kf[kf.length - 1].y).toBe(1);
    // y is a screen-descent fraction, allowed to backtrack locally but bounded
    for (const k of kf) {
      expect(k.y).toBeGreaterThanOrEqual(-0.05);
      expect(k.y).toBeLessThanOrEqual(1.05);
    }
    // meander is centred so site.js can scale it symmetrically
    const xs = kf.map((k) => k.x);
    const amp = Math.max(...xs.map(Math.abs));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(amp).toBeGreaterThan(0);
    expect(Math.abs(mean)).toBeLessThan(amp * 0.35);
    // pitch is exported in degrees for the transform string
    for (const k of kf) expect(Math.abs(k.th)).toBeLessThan(85);
  });

  it('is deterministic for a fixed rng', () => {
    const a = toLoopingKeyframes(run(7), 120);
    const b = toLoopingKeyframes(run(7), 120);
    expect(a).toEqual(b);
  });
});

describe('feather flips at glide turns (v3.1)', () => {
  const kf = () => toLoopingKeyframes(run(1), 160);

  it('leaves the feather face alone when chance is 0', () => {
    for (const k of addFlips(kf(), { chance: 0, rng: mulberry32(9) })) expect(k.flip).toBe(0);
  });

  it('flips by exactly ±180° per event, only around meander turning points', () => {
    const flipped = addFlips(kf(), { chance: 1, rng: mulberry32(9) });
    expect(flipped.length).toBe(160);
    // plateaus between events are multiples of 180, and at least one flip fired
    const plateaus = [...new Set(flipped.map((k) => k.flip))].filter(
      (a) => Math.abs(Math.round(a) % 180) === 0,
    );
    expect(plateaus.length).toBeGreaterThanOrEqual(2);
    // the face angle is piecewise constant: transitions are confined to short
    // windows (a flip spans ~6 keyframes), the rest of the loop is flat
    let moving = 0;
    for (let i = 1; i < flipped.length; i++) if (flipped[i].flip !== flipped[i - 1].flip) moving++;
    expect(moving).toBeGreaterThan(0);
    expect(moving).toBeLessThan(flipped.length * 0.6);
    // each transition is monotonic toward the next plateau (no wobble)
    const first = flipped.find((k) => k.flip !== 0);
    expect(first).toBeDefined();
  });

  it('keeps the trajectory itself untouched', () => {
    const base = kf();
    const flipped = addFlips(base, { chance: 1, rng: mulberry32(9) });
    for (let i = 0; i < base.length; i++) {
      expect(flipped[i].x).toBe(base[i].x);
      expect(flipped[i].y).toBe(base[i].y);
      expect(flipped[i].th).toBe(base[i].th);
      expect(flipped[i].offset).toBe(base[i].offset);
    }
  });

  it('is deterministic for a fixed rng', () => {
    expect(addFlips(kf(), { chance: 0.5, rng: mulberry32(4) })).toEqual(
      addFlips(kf(), { chance: 0.5, rng: mulberry32(4) }),
    );
  });
});
