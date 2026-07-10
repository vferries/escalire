// Falling-feather physics — quasi-steady falling-plate model after
// Andersen, Pesavento & Wang, "Unsteady aerodynamics of fluttering and
// tumbling plates", J. Fluid Mech. 541 (2005). Dimensionless units: half-chord
// a = 1, fluid density 1, gravity 1; y axis points UP (screen mapping is done
// by the consumer). Integrated once per feather at page load and baked into
// WAAPI keyframes — no per-frame JS afterwards (see the v3 section of
// docs/superpowers/specs/2026-07-10-natural-feather-motion-design.md).
//
// Plate-frame state: u = velocity along the chord, v = normal velocity,
// th = pitch angle from horizontal, om = angular velocity.
//   mu·u̇ =  mv·om·v − Γ·v − W·sin(th) − D·u
//   mv·v̇ = −mu·om·u + Γ·u − W·cos(th) − D·v
//   I·ω̇  = −K·u·v − (mu1 + mu2·|om|)·om
// with circulation Γ = −Ct·u·v/V + Cr·om (translational + rotational lift),
// drag factor D = (A − B·(u² − v²)/V²)·V and added-mass couple K.

const TAU = Math.PI * 2;

export function defaultParams(rng = Math.random) {
  const j = (spread) => 1 + (rng() * 2 - 1) * spread;
  const m = 1.1 * j(0.25); // plate mass (added masses come on top)
  return {
    m,
    m22: (Math.PI / 4) * j(0.15), // added mass normal to the plate
    I: 0.9 * j(0.3), // effective moment of inertia — low enough to flutter
    W: 0.72 * m * j(0.15), // buoyancy-corrected weight
    Ct: 1.2 * j(0.2), // translational lift (paper's fitted value)
    Cr: Math.PI * j(0.2), // rotational lift (paper's fitted value)
    A: 1.4 * j(0.15), // drag, isotropic part (paper's fitted value)
    B: 1.0 * j(0.15), // drag, orientation part (paper's fitted value)
    mu1: 0.2 * j(0.2), // rotational damping, linear (paper's fitted value)
    mu2: 0.2 * j(0.2), // rotational damping, quadratic (paper's fitted value)
    th0: (rng() * 2 - 1) * 0.35, // initial pitch
    u0: 0.3 + rng() * 0.5, // initial glide kick, random direction
    dir: rng() < 0.5 ? -1 : 1,
    // horizon/step chosen so 34 feathers integrate in a few tens of ms at page
    // load (the system is smooth — RK4 at dt 0.016 stays on the limit cycle)
    T: 90, // integration horizon
    settle: 20, // transient to discard
    dt: 0.016,
  };
}

// Derivative of the plate-frame state (u, v, om, th), written into `out` —
// this runs ~4 × 14k times per feather at page load, so no per-step
// allocations anywhere in the integrator.
function deriv(u, v, om, th, p, out) {
  // Math.sqrt, not Math.hypot: hypot's overflow-safe rounding is ~10× slower
  // in V8 and this is the integrator's hot loop
  const V = Math.sqrt(u * u + v * v) || 1e-9;
  const gamma = -p.Ct * ((u * v) / V) + p.Cr * om;
  const drag = (p.A - (p.B * (u * u - v * v)) / (V * V)) * V;
  const mu = p.m; // added mass along the chord of a thin plate ~ 0
  const mv = p.m + p.m22;
  out[0] = (mv * om * v - gamma * v - p.W * Math.sin(th) - drag * u) / mu;
  out[1] = (-mu * om * u + gamma * u - p.W * Math.cos(th) - drag * v) / mv;
  out[2] = (-p.m22 * u * v - (p.mu1 + p.mu2 * Math.abs(om)) * om) / p.I;
  out[3] = om;
}

// Integrate one feather (classic RK4 — the model is smooth, dt 0.008 stays on
// the flutter limit cycle). Returns world-frame samples {t, x, y, th} (y up),
// transient removed, ~10 samples per time unit.
export function simulateFeather(p) {
  let u = p.u0 * p.dir;
  let v = 0;
  let om = 0;
  let th = p.th0;
  let x = 0;
  let y = 0;
  const k1 = new Float64Array(4);
  const k2 = new Float64Array(4);
  const k3 = new Float64Array(4);
  const k4 = new Float64Array(4);
  const samples = [];
  const dt = p.dt;
  const h2 = dt / 2;
  const stride = Math.max(1, Math.round(0.1 / dt));
  const steps = Math.round(p.T / dt);
  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    if (i % stride === 0 && t >= p.settle) samples.push({ t, x, y, th });
    const c = Math.cos(th);
    const sn = Math.sin(th);
    x += (u * c - v * sn) * dt;
    y += (u * sn + v * c) * dt;
    deriv(u, v, om, th, p, k1);
    deriv(u + k1[0] * h2, v + k1[1] * h2, om + k1[2] * h2, th + k1[3] * h2, p, k2);
    deriv(u + k2[0] * h2, v + k2[1] * h2, om + k2[2] * h2, th + k2[3] * h2, p, k3);
    deriv(u + k3[0] * dt, v + k3[1] * dt, om + k3[2] * dt, th + k3[3] * dt, p, k4);
    u += ((k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * dt) / 6;
    v += ((k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * dt) / 6;
    om += ((k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) * dt) / 6;
    th += ((k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]) * dt) / 6;
    // safety: keep pitch wrapped so a stray tumble cannot run away numerically
    if (th > Math.PI) th -= TAU;
    if (th < -Math.PI) th += TAU;
  }
  return samples;
}

// Resample the trajectory into n keyframes for one full screen traversal:
// offset = time fraction, y = descent fraction 0→1 (may locally backtrack —
// centre-of-mass rise at the turns), x centred around 0 in half-chord units,
// th in degrees. The screen wrap (bottom → top) happens offscreen, so the
// loop needs no blending.
export function toLoopingKeyframes(samples, n = 180) {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const drop = first.y - last.y;
  const t0 = first.t;
  const span = last.t - t0;
  const xs = samples.map((p) => p.x);
  const xMid = (Math.max(...xs) + Math.min(...xs)) / 2;
  const kf = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + (span * i) / (n - 1);
    // locate the sample interval containing t (samples are uniform in time)
    const f = ((t - t0) / span) * (samples.length - 1);
    const lo = Math.min(samples.length - 2, Math.floor(f));
    const w = f - lo;
    const a = samples[lo];
    const b = samples[lo + 1];
    kf.push({
      offset: i / (n - 1),
      x: a.x + (b.x - a.x) * w - xMid,
      y: (first.y - (a.y + (b.y - a.y) * w)) / drop,
      th: ((a.th + (b.th - a.th) * w) * 180) / Math.PI,
    });
  }
  kf[0].y = 0;
  kf[kf.length - 1].y = 1;
  return kf;
}

// Give every feather a small chance to flip over (rotateY half-turn) at each
// glide turn — rather than a few feathers twirling continuously. Turns are
// where the baked meander reverses direction; a flip eases over `span`
// keyframes starting at the turn. The face angle accumulates (0 → ±180 →
// ±360 …) and needs no loop closure: the screen wrap happens offscreen.
export function addFlips(kf, { chance, rng = Math.random, span = 6 } = {}) {
  const events = [];
  const half = Math.floor(span / 2);
  let lastEnd = -1;
  for (let i = 1; i < kf.length - 1; i++) {
    const before = kf[i].x - kf[i - 1].x;
    const after = kf[i + 1].x - kf[i].x;
    if (before * after >= 0) continue; // not a turn
    const start = i - half;
    if (start <= lastEnd || start < 1 || start + span >= kf.length - 1) continue;
    if (rng() >= chance) continue;
    events.push({ start, dir: rng() < 0.5 ? -180 : 180 });
    lastEnd = start + span;
  }
  const smooth = (u) => u * u * (3 - 2 * u);
  let base = 0;
  let e = 0;
  return kf.map((k, i) => {
    if (e < events.length && i >= events[e].start + span) {
      base += events[e].dir;
      e++;
    }
    const ev = events[e];
    const inWindow = ev && i >= ev.start && i < ev.start + span;
    return { ...k, flip: inWindow ? base + ev.dir * smooth((i - ev.start) / (span - 1)) : base };
  });
}
