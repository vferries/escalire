# Natural feather motion — design

Date: 2026-07-10 · Status: implemented, then revised same day after Vincent's live
feedback (see « Révision » at the end)

## Problem

The falling feathers (hero + rencontres) move mechanically. Vincent: « J'aimerais que
le mouvement des plumes soit beaucoup plus naturel. » The current motion is a faithful
port of the mockup (`design/escalire-source.html` 1334-1335, 1601-1614), whose model is:

- `featherFall`: strictly linear translateY, −24vh → 124vh.
- `featherSway`: pure sinusoid, translateX ±30px with rotation **in phase with
  position** (max tilt at the swing extremes) — reads as a metronome pivoting on a
  fixed axis.
- Same ±30px amplitude and rotation for every feather; the cycle repeats exactly.
- The feather plane itself is frozen (one static base rotation + optional flip).

This is a deliberate divergence from the mockup, requested by Vincent (DESIGN.md rule:
divergences must be justified — this doc is the justification).

## Physical model targeted

A real feather falls in the “falling leaf” flutter regime: it glides sideways, pitched
into the direction of travel; at the end of each glide it stalls (descent nearly
stops, it levels out), tips over, and dives the other way. Superimposed: slow lateral
drift from air movement, and a gentle quiver/twirl of the feather plane.

## Approaches considered

- **A. Enriched CSS keyframes + per-feather CSS variables (chosen).** Stays 100 % on
  the compositor, zero permanent rAF, slots into the existing nested-wrapper
  architecture. Per-segment `animation-timing-function` gives the stall/dive rhythm.
- **B. JS physics loop (rAF).** Full control (noise, turbulence, per-feather gust
  response) but a permanent rAF for ~34 feathers burns CPU/battery and goes against
  the project’s transforms-only animation convention.
- **C. WAAPI with `composite: 'add'`.** Fewer DOM nodes but abandons the established
  wrapper pattern for marginal gain.

## Design (A)

Wrapper stack per feather — separate wrappers, never merged (CLAUDE.md rule):

1. `outer` — position + JS gust translateY (unchanged); carries the per-feather CSS
   custom properties (inherited by the wrappers below).
2. `fall` — linear descent −24vh → 124vh **plus slow horizontal meander**: keyframes at
   irregular stops (0/22/47/71/100 %), X wandering `0 → +driftX → −0.55·driftX →
   +0.8·driftX → 0`, gentle non-flat easing per segment (slight vertical speed
   variation, no visible stops). Y values at each stop stay proportional to progress
   so the average descent is unchanged. Drift and sway periods are incommensurate →
   the combined path never visibly repeats.
3. `sway` — pendulum glide, keyframes at 0/25/50/75/100 %:
   - translateX: −swayX → 0 → +swayX → 0 → −swayX;
   - translateY: 0 at the extremes, +swayY mid-glide (**dive mid-glide, stall at the
     ends** — swayY rates stay well under fall speed, so it reads as a slowdown, not a
     rise);
   - rotate: **velocity-coupled** — ±swayR at mid-glide, ±0.35·swayR at the extremes
     (partial flare-out at the stall, tip-over into the next dive);
   - per-segment easing: out-of-stall `cubic-bezier(.5,.05,.7,.5)` (accelerating
     dive), into-stall `cubic-bezier(.3,.5,.5,.95)` (decelerating flare). Slopes match
     at the joints (no velocity jumps).
   - own negative delay (`swayDelay`), decorrelated from the fall phase.
4. `flutter` — **new wrapper**, 3D quiver of the feather plane:
   - ~78 % of feathers: `featherFlutter`, soft `perspective(600px) rotateX/rotateY`
     seesaw (±4–12° / ±8–22°), 1.8–3.6 s ease-in-out;
   - ~22 %: `featherTwirl`, continuous `rotateY` 360° over 5–11 s, random direction,
     constant small rotateX tilt so it never reads as a flat card flip. The brief
     edge-on sliver twice per turn is intentional (a thin feather catching the air).
5. `feather` — tint/mask/base rotation/flip (unchanged).

Per-feather seed couplings (`mkSeeds`):

- `sway` period ∝ `swayX` amplitude (wide glides swing slower, like a long pendulum):
  `2.6 + swayX·0.055 + rnd·1.4` s, swayX 18–64 px.
- `swayY = swayX · (0.22–0.42)`, `swayR` 10–24°.
- fall duration mildly ∝ size (large feathers read denser, fall a bit faster):
  `34 − w·0.25 + rnd·8` s → ~20.5–35.5 s (was 15–32 s; slightly slower average is
  part of the requested naturalness).
- `driftX`: signed, 10–70 px.

All amplitudes flow into the shared keyframes via CSS custom properties set on
`outer` (`--swayX`, `--swayY`, `--swayR`, `--driftX`, `--flutX`, `--flutY`) — the
variables are resolved at style time, so the animations stay compositor-driven.

Unchanged: gust interaction, palettes, opacity model (0.6 factor), counts (20 + 14,
halved ≤ 720 px), reduced-motion behavior (feathers not built in « discret »).

Cost: one extra animated wrapper per feather (~34 small extra compositor layers) — no
permanent JS work; acceptable.

## Docs & tests

- DESIGN.md §animations table row and CLAUDE.md « pièges » note updated: 4 nested
  wrappers (chute+dérive / balancement / frémissement / rotation-teinte).
- `src/lib/site.test.ts`: content assertions in the repo’s golden-check style
  (velocity-coupled sway keyframes, flutter/twirl keyframes, flutter wrapper and CSS
  variables in site.js).
- Visual verification in the browser (dev server) — the only meaningful test for
  “does it look natural”.

## Révision (même jour) — plumes à plat, balancement pendulaire

Vincent, après avoir vu la première version en local : « j'imaginais plus quelque
chose avec les plumes à plat qui décrivent un mouvement pendulaire en descendant. »

Changements vs le modèle « feuille morte » ci-dessus :

- **Rotation du balancement inversée** : inclinaison max (±swayR) aux extrémités du
  balancement, plume à l'horizontale (0°) au point bas — la plume reste
  perpendiculaire au fil virtuel, comme l'assise d'une balançoire. (L'ancien modèle
  couplait l'inclinaison à la vitesse : max à mi-glisse.)
- **Plumes à plat** : rotation de base 74°–106° (rachis quasi horizontal) au lieu de
  −40°..+40°.
- **Arc conservé** (point bas à mi-balancement, +swayY) ; ratio swayY/swayX resserré
  à 0.18–0.34 pour coller à la géométrie du pendule.
- **Frémissement** : dominante rotateX (6–14°) — battement autour de l'axe long de la
  plume à plat — rotateY réduit (4–10°) ; part de vrilles 22 % → 12 %.
- Inchangé : dérive apériodique de la chute, easings (lent aux extrêmes, rapide au
  point bas), couplage période ∝ amplitude, variables CSS par plume, 4 wrappers.
