# Mobile burger menu — design

**Date:** 2026-07-13
**Status:** validated by Vincent (cream panel, "Horaires & accès" as 5th plain link, feather burst on open)
**Mockup:** [2026-07-13-mobile-burger-menu-mockup.png](./2026-07-13-mobile-burger-menu-mockup.png)

## Problem

At ≤720px the nav links collapse into a horizontally scrollable strip
(`Nav.astro`). The edge fade hides labels, nothing signals scrollability,
and touch targets are small. Vincent judged it hard to read and act on.

## Solution

Replace the mobile strip with a burger button opening a full-screen panel.
Desktop (>720px) is strictly unchanged.

### Trigger (≤720px)

- Logo unchanged on the left; the `.nav-links` strip is no longer shown.
- Burger button on the right: 44×44 hit area, 3 ink-colored bars,
  `aria-expanded`, `aria-controls` pointing at the panel, French
  `aria-label` ("Ouvrir le menu").

### Panel

Matches the validated mockup:

- `position: fixed` full-screen overlay, `--paper` background with a light
  ink-wash decoration (existing asset, per-site masking conventions),
  z-index between the nav (30) and the progress bar (40) so the progress
  bar stays visible above the open panel.
- Header row: logo + close cross (44×44).
- Caveat kicker in `--red-ink`: « Où va-t-on ? ».
- The anchor links (up to 5) in Cormorant Garamond 600 ~40px, separated by
  hairlines; last one has no hairline. Links hidden by content state today
  (coups de cœur / équipe empty) stay hidden here — same `links` array.
- Current-section link highlighted navy + short red dash. Computed **at
  open time** (loop over section anchors vs `scrollY + 84`), not via a
  permanent IntersectionObserver — there is no existing scroll-spy and the
  menu doesn't need a continuous one.
- A decorative feather bottom-right (existing `feather.png`), ~0.5 opacity.
- Close paths: cross, tap on any link, Escape.

### Animations

- Open: panel fade-in + link cascade (translateY + opacity, ~60ms stagger).
  Transforms/opacity only — no layout properties.
- **Feather burst on open**: 6–8 one-shot feathers spawned near the top of
  the panel, each playing a baked trajectory from
  `src/lib/feather-physics.js` (reuse the existing builder — no duplicated
  physics). No looping: one fall, then the node is removed. Opacity ×0.6
  like the site's other feathers.
- `prefers-reduced-motion` or `data-intensite="discret"`: no feathers, no
  cascade, plain fade — consistent with the existing "feathers cut off"
  rule.

### Scroll & accessibility

- No `overflow: hidden` on `body` (project rule). The opaque panel covers
  the viewport and `overscroll-behavior: contain` stops scroll chaining.
- `role="dialog"` + `aria-modal="true"`, focus trapped inside the panel
  while open, focus returned to the burger on close.
- Link tap closes the panel first, then native anchor navigation jumps
  (`scroll-margin-top: 84px` already in place on sections).

## Scope

- `src/components/Nav.astro` — burger + panel markup and styles.
- `src/scripts/site.js` — open/close, current-section computation,
  one-shot feather spawn (reusing feather-physics helpers).
- Nothing else changes; desktop rendering is visually identical (the
  panel markup exists in the DOM but is hidden above 720px).

## Verification

- Screenshots at 390×844: closed nav, open panel (compare to mockup),
  reduced-motion open state.
- Desktop screenshot diff vs `main` — must be identical.
- Keyboard pass: Tab cycles inside the open panel, Escape closes,
  focus returns to burger.
