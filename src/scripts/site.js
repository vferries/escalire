// Client behaviors: progress bar, nav shadow, parallax, hero entrance, scroll
// reveals, click-to-load Leaflet map (RGPD), current-day highlight, feather field.
//
// Ported from design/escalire-source.html (lines 1647-1770). "intensite" is
// now derived only from prefers-reduced-motion (immersif|discret), no user
// setting: see .superpowers/sdd/task-10-brief.md for the constants table.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { addFlips, defaultParams, simulateFeather, toLoopingKeyframes } from '../lib/feather-physics.js';

const INTENSITES = { immersif: 1, discret: 0 };
const amp = () => INTENSITES[document.documentElement.dataset.intensite] ?? 1;

const EASE = 'cubic-bezier(.22,.61,.21,1)';

// --- Progress bar + nav shadow + hero parallax + per-element parallax ------

function setupScroll() {
  const progressBar = document.getElementById('progress-bar');
  const nav = document.getElementById('site-nav');
  const heroArt = document.getElementById('hero-art');
  const heroBg = document.getElementById('hero-bg');

  const parallaxEls = Array.from(document.querySelectorAll('[data-parallax]')).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      el,
      f: parseFloat(el.dataset.parallax) || 0,
      rot: el.dataset.rot || 0,
      base: rect.top + window.scrollY + rect.height / 2,
    };
  });

  let lastY = window.scrollY;

  const onScroll = () => {
    const a = amp();
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    if (progressBar) progressBar.style.transform = `scaleX(${Math.min(1, y / max)})`;
    if (heroArt) heroArt.style.transform = `translateY(${y * 0.26 * a}px)`;
    if (heroBg) heroBg.style.transform = `translateY(${y * 0.14 * a}px)`;
    if (nav) nav.classList.toggle('scrolled', y > 12);

    const center = y + window.innerHeight / 2;
    for (const p of parallaxEls) {
      if (a > 0) {
        const ty = Math.max(-260, Math.min(260, (center - p.base) * p.f * a));
        p.el.style.transform = `translateY(${ty.toFixed(1)}px) rotate(${p.rot}deg)`;
      } else {
        p.el.style.transform = `rotate(${p.rot}deg)`;
      }
    }

    // scroll-velocity gust: pushes feathers, decays via rAF loop (see accumulateGust)
    const dy = y - lastY;
    lastY = y;
    accumulateGust(dy);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return onScroll;
}

// --- Hero entrance ----------------------------------------------------------

function setupHeroEntrance() {
  if (amp() === 0) return; // instant: leave elements as rendered, no animation

  const entries = Array.from(document.querySelectorAll('[data-entrance]')).sort(
    (a, b) => Number(a.dataset.entrance) - Number(b.dataset.entrance),
  );

  entries.forEach((el) => {
    // Read the stylesheet transform (computed matrix, or 'none') rather than
    // el.style.transform: our tilts live in scoped <style> blocks, not inline
    // attributes, so el.style.transform is empty even when a CSS tilt exists.
    const computed = getComputedStyle(el).transform;
    const base = computed === 'none' ? '' : computed;
    el.dataset.rvBase = base;
    el.dataset.rvOpacity = getComputedStyle(el).opacity;
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = `${base} translateY(26px)`.trim();
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      entries.forEach((el, i) => {
        el.style.transition = `opacity 1s ${EASE}, transform 1.1s ${EASE}`;
        setTimeout(() => {
          el.style.opacity = el.dataset.rvOpacity;
          // Clear the inline transform so the stylesheet value (including any
          // active media-query override) takes over; don't freeze it as 'none'.
          el.style.transform = '';
        }, 90 + i * 140);
      });
    });
  });
}

// --- Scroll reveals ----------------------------------------------------------

function setupReveals() {
  const a = amp();

  const io = new IntersectionObserver(
    (observed) => {
      observed.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        requestAnimationFrame(() => {
          // user may have switched to "discret" after setup: reveal instantly
          if (amp() === 0) el.style.transition = 'none';
          el.style.opacity = el.dataset.rvOpacity || '1';
          // Clear the inline transform so the stylesheet value (including any
          // active media-query override) takes over; don't freeze it as 'none'.
          el.style.transform = '';
          if (el.dataset.reveal === 'ink-text') el.style.filter = 'blur(0px)';
          if (el.dataset.reveal === 'ink-bloom') {
            // walk the sprite mask to its final frame (see .ink-sprite)
            el.style.setProperty('-webkit-mask-position', '0 100%');
            el.style.setProperty('mask-position', '0 100%');
            el.style.filter = 'blur(0px)';
          }
        });
        io.unobserve(el);
      });
    },
    { threshold: 0.16 },
  );

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top <= window.innerHeight * 0.9;
    if (a === 0 || alreadyVisible) return; // leave as rendered, fully visible

    const kind = el.dataset.reveal;
    const delay = `${el.dataset.delay || 0}ms`;
    // Read the stylesheet transform (computed matrix, or 'none') rather than
    // el.style.transform: our tilts live in scoped <style> blocks, not inline
    // attributes, so el.style.transform is empty even when a CSS tilt exists.
    const computed = getComputedStyle(el).transform;
    const base = computed === 'none' ? '' : computed;
    const dist = 30 * a;

    el.dataset.rvBase = base;
    el.dataset.rvOpacity = getComputedStyle(el).opacity;
    el.style.transition = `opacity .9s ${EASE} ${delay}, transform 1s ${EASE} ${delay}, filter 1.1s ${EASE} ${delay}`;
    el.style.opacity = '0';

    if (kind === 'ink') {
      el.style.transformOrigin = 'left center';
      el.style.transform = `${base} scaleX(0)`.trim();
    } else if (kind === 'ink-bloom') {
      // rewind the ink sprite to frame 0; the reveal steps it back to the
      // final frame, reading as ink soaking into the paper. The settling wet
      // blur smooths the discrete mask steps.
      el.style.transition = `opacity .5s ${EASE} ${delay}, -webkit-mask-position 1.4s steps(20, jump-none) ${delay}, mask-position 1.4s steps(20, jump-none) ${delay}, filter 1.4s ease-out ${delay}`;
      el.style.setProperty('-webkit-mask-position', '0 0%');
      el.style.setProperty('mask-position', '0 0%');
      el.style.filter = 'blur(2.2px)';
    } else if (kind === 'pop') {
      el.style.transform = `${base} scale(0.3) rotate(-24deg)`.trim();
    } else if (kind === 'ink-text') {
      el.style.filter = 'blur(10px)';
      el.style.transform = `${base} translateY(${dist * 0.5}px)`.trim();
    } else if (kind === 'up') {
      el.style.transform = `${base} translateY(${dist}px)`.trim();
    }
    io.observe(el);
  });
}

// --- Leaflet map, lazy init --------------------------------------------------

function initMap(el) {
  const pos = [Number(el.dataset.lat), Number(el.dataset.lng)];
  const map = L.map(el, { scrollWheelZoom: false }).setView(pos, 16);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  const icon = L.icon({
    iconUrl: `${el.dataset.base}assets/feather.png`,
    iconSize: [34, 65],
    iconAnchor: [17, 62],
    popupAnchor: [0, -58],
  });
  L.marker(pos, { icon })
    .addTo(map)
    .bindPopup('<b>Librairie Escalire</b><br>Espace 61 — 61 avenue de Toulouse')
    .openPopup();
}

function setupMap() {
  const el = document.querySelector('#map-escalire');
  if (!el) return;
  const btn = el.querySelector('.map-consent');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    // Leaflet attaches its own click listener to #map-escalire inside initMap();
    // without stopping propagation here, this same click event keeps bubbling
    // into that brand-new listener and is read as "user clicked the map",
    // which auto-closes the popup we just opened.
    e.stopPropagation();
    el.querySelector('.map-static')?.remove();
    btn.remove();
    initMap(el); // Leaflet is bundled; only the CARTO tile requests are deferred
    // The consent button (previous focus target) is gone; move focus to the
    // map container itself so keyboard users aren't dropped back to <body>.
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }, { once: true });
}

// --- Current-day highlight ---------------------------------------------------

function highlightToday() {
  const jourNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const today = jourNames[new Date().getDay()];
  document.querySelectorAll('.horaires-row[data-jours]').forEach((row) => {
    const jours = row.dataset.jours.split(',');
    if (jours.includes(today)) row.classList.add('today');
  });
}

// --- Falling feathers + scroll gust -------------------------------------------
//
// Gust interaction ported from design/escalire-source.html (accumulation:
// lines 1647-1651, decay loop: lines 1695-1707). The motion model deliberately
// diverges from the mockup's linear fall + metronome sway (Vincent's request):
// each feather integrates the Andersen–Pesavento–Wang falling-plate model once
// at load (src/lib/feather-physics.js) and plays the baked trajectory as a
// WAAPI animation — compositor-driven, no per-frame JS. See the v3 section of
// docs/superpowers/specs/2026-07-10-natural-feather-motion-design.md.
//
// Vincent's decision: fixed look, no user-facing intensity control. Feathers
// are "many + slightly transparent" — full immersif counts, permanent 0.6
// opacity factor applied on top of each seed's own opacity (.55-.95 -> .33-.57).
const FEATHER_OPACITY_FACTOR = 0.6;

const HERO_PALETTE = ['#e8442e', '#f08a67', '#2b3f77', '#4a76b8', '#6aa7cc', '#23252b'];
const EVENTS_PALETTE = ['#f08a67', '#6aa7cc', '#c9dfed', '#e8442e', '#4a76b8', '#faf6ef'];

function mkSeeds(n, colors) {
  return Array.from({ length: n }, (_, i) => {
    const w = 26 + Math.random() * 28;
    // one physics run per feather: unique, aperiodic flutter trajectory, plus
    // a small chance to flip over (half rotateY turn) at each glide turn
    const path = addFlips(toLoopingKeyframes(simulateFeather(defaultParams()), 160), {
      chance: 0.04 + Math.random() * 0.06,
    });
    const xAmp = Math.max(...path.map((k) => Math.abs(k.x))) || 1;
    return {
      left: 2 + Math.random() * 96,
      // large feathers read denser and fall a bit faster
      dur: 34 - w * 0.25 + Math.random() * 8,
      phase: Math.random(),
      path,
      // normalize the simulated meander to a controlled on-screen swing
      xScale: (30 + Math.random() * 50) / xAmp,
      // aesthetic dampening of the simulated pitch (Vincent wants them flat-ish)
      thScale: 0.55 + Math.random() * 0.2,
      // flat feather: the main quiver is around its long (horizontal) axis (rotateX)
      flutX: 6 + Math.random() * 8,
      flutY: 4 + Math.random() * 6,
      flutDur: 1.8 + Math.random() * 1.8,
      flutDelay: -Math.random() * 8,
      w,
      o: 0.55 + Math.random() * 0.4,
      // quill near horizontal, bulging (convex) side always down — flat feathers
      rot: 254 + Math.random() * 32,
      depth: 0.45 + Math.random() * 0.95,
      blur: Math.random() < 0.3 ? 1.4 : 0,
      // screen-space mirror: tip points left or right, curved side stays down
      mirror: Math.random() < 0.5,
      color: colors[i % colors.length],
    };
  });
}

// Seeds are generated once and reused across rebuilds: intensity changes only
// change how many are shown (slice) and their opacity (soft factor), not the
// underlying random layout. Generation runs the physics (a few tens of ms for
// 34 feathers) — it is lazy so "discret" mode never pays it, and the first
// build is deferred to idle time (see init).
let heroSeeds = null;
let eventSeeds = null;
function ensureSeeds() {
  if (!heroSeeds) {
    heroSeeds = mkSeeds(20, HERO_PALETTE);
    eventSeeds = mkSeeds(14, EVENTS_PALETTE);
  }
}

// Outer wrapper elements currently in the DOM, with their depth, for the gust loop.
let activeFeathers = [];

let gust = 0;
let gustRaf = null;

function stepGust() {
  gust *= 0.9;
  if (Math.abs(gust) < 0.1) gust = 0;
  for (const f of activeFeathers) {
    f.el.style.transform = `translateY(${(-gust * f.depth).toFixed(1)}px)`;
  }
  if (amp() === 0 || gust === 0) {
    // drop any leftover gust: switching back from "discret" must not resume
    // decay from a stale magnitude (rebuilt feathers would visibly jump)
    gust = 0;
    gustRaf = null;
    return;
  }
  gustRaf = requestAnimationFrame(stepGust);
}

function accumulateGust(dy) {
  if (amp() === 0) return; // no feathers in "discret": don't build up stale gust
  gust = Math.max(-150, Math.min(150, gust + dy * 0.4));
  if (Math.abs(gust) >= 0.1 && gustRaf === null) {
    gustRaf = requestAnimationFrame(stepGust);
  }
}

function featherMaskUrl(container) {
  // data-base (rendered from import.meta.env.BASE_URL) is the primary source;
  // fall back to the same env value directly, in case a container element is
  // ever added without the attribute.
  const base =
    container.dataset.base ?? document.querySelector('#map-escalire')?.dataset.base ?? import.meta.env.BASE_URL;
  return `${base}assets/feather-mask.png`;
}

// 4 wrappers: outer (position + gust translateY + flutter CSS variables) /
// path (baked physics trajectory: descent + meander + pitch, one WAAPI
// animation because it is one physical motion) / flutter (3D quiver or twirl)
// / innermost tinted mask div. Keep them separate — merging the transforms
// breaks the independent animations (see CLAUDE.md).
function buildFeather(seed, maskUrl, { once = false } = {}) {
  const outer = document.createElement('div');
  outer.style.cssText = `position:absolute; top:0; left:${seed.left}%; will-change:transform;`;
  // amplitudes consumed by the flutter/twirl keyframes (inherited); resolved at
  // style time, so the animations stay compositor-driven
  outer.style.setProperty('--flutX', `${seed.flutX.toFixed(1)}deg`);
  outer.style.setProperty('--flutY', `${seed.flutY.toFixed(1)}deg`);

  const path = document.createElement('div');
  // if the feather ever flips, every keyframe carries the perspective+rotateY
  // pair so the transform lists stay interpolation-compatible
  const flips = seed.path.some((k) => k.flip !== 0);
  const anim = path.animate(
    seed.path.map((k) => ({
      offset: k.offset,
      transform:
        `translate(${(k.x * seed.xScale).toFixed(1)}px, ${(-24 + 148 * k.y).toFixed(2)}vh) rotate(${(k.th * seed.thScale).toFixed(1)}deg)` +
        (flips ? ` perspective(600px) rotateY(${k.flip.toFixed(1)}deg)` : ''),
    })),
    once
      ? // burst feather: seed.phase is a stagger delay in seconds, one fall, then gone
        { duration: seed.dur * 1000, iterations: 1, delay: seed.phase * 1000, fill: 'both' }
      : { duration: seed.dur * 1000, iterations: Infinity, delay: -seed.phase * seed.dur * 1000 },
  );

  if (once) {
    // detaching `outer` (menu closed -> replaceChildren) does not cancel this
    // animation: `finished` still resolves after delay+duration and the
    // subsequent outer.remove() is a harmless no-op on the detached node.
    // The catch only guards a future explicit anim.cancel(), which does
    // reject `finished`.
    anim.finished.then(() => outer.remove()).catch(() => {});
  }

  const flutter = document.createElement('div');
  flutter.style.animation = `featherFlutter ${seed.flutDur}s ease-in-out ${seed.flutDelay}s infinite`;

  const feather = document.createElement('div');
  feather.style.cssText = [
    `width:${seed.w}px`,
    'aspect-ratio:636/1220',
    `background:${seed.color}`,
    `-webkit-mask-image:url(${maskUrl})`,
    `mask-image:url(${maskUrl})`,
    '-webkit-mask-size:100% 100%',
    'mask-size:100% 100%',
    '-webkit-mask-repeat:no-repeat',
    'mask-repeat:no-repeat',
    `opacity:${seed.opacity}`,
    // mirror OUTSIDE the rotation (screen space): the curved side stays down
    `transform:${seed.mirror ? 'scaleX(-1) ' : ''}rotate(${seed.rot}deg)`,
    seed.blur ? 'filter:blur(1.4px)' : 'filter:none',
  ].join(';');

  flutter.appendChild(feather);
  path.appendChild(flutter);
  outer.appendChild(path);
  return outer;
}

function fillLayer(container, seeds, count) {
  const maskUrl = featherMaskUrl(container);
  const shown = seeds.slice(0, count);
  const built = shown.map((seed) => {
    const outer = buildFeather({ ...seed, opacity: seed.o * FEATHER_OPACITY_FACTOR }, maskUrl);
    container.appendChild(outer);
    return { el: outer, depth: seed.depth };
  });
  return built;
}

// One-shot burst for the mobile menu opening: reuse the baked hero seeds
// (physics already paid at idle time), shorter fall, fixed per-index stagger
// so no randomness runs at open time.
function spawnFeatherBurst(container) {
  if (!container || amp() === 0) return;
  ensureSeeds();
  const maskUrl = featherMaskUrl(container);
  heroSeeds.slice(0, 7).forEach((seed, i) => {
    const outer = buildFeather(
      {
        ...seed,
        opacity: seed.o * FEATHER_OPACITY_FACTOR,
        dur: 4.5 + (i % 3) * 1.2,
        phase: i * 0.13,
      },
      maskUrl,
      { once: true },
    );
    container.appendChild(outer);
  });
}

function rebuildFeathers() {
  const heroContainer = document.getElementById('hero-feathers');
  const eventsContainer = document.getElementById('events-feathers');

  activeFeathers = [];
  if (heroContainer) heroContainer.replaceChildren();
  if (eventsContainer) eventsContainer.replaceChildren();

  if (document.documentElement.dataset.intensite === 'discret') return; // no feathers

  ensureSeeds();
  const narrow = window.innerWidth <= 720; // fewer feathers on small screens: less clutter, lighter DOM
  const factor = narrow ? 0.5 : 1;
  const heroCount = Math.round(heroSeeds.length * factor);
  const eventsCount = Math.round(eventSeeds.length * factor);

  if (heroContainer) activeFeathers.push(...fillLayer(heroContainer, heroSeeds, heroCount));
  if (eventsContainer) activeFeathers.push(...fillLayer(eventsContainer, eventSeeds, eventsCount));

  if (amp() > 0 && Math.abs(gust) >= 0.1 && gustRaf === null) {
    gustRaf = requestAnimationFrame(stepGust);
  }
}

// --- Mobile burger menu --------------------------------------------------------
//
// Full-screen cream panel (spec 2026-07-13). The panel is always in the DOM
// (inert while closed); open/close only toggles classes + inert, never body
// overflow (project rule — the opaque panel plus overscroll-behavior:contain
// covers scroll containment). The current section is computed once at open
// time from the anchor targets — cheaper than a permanent IntersectionObserver
// for something only visible while the menu is open.

function markCurrentSection(links) {
  let current = null;
  for (const a of links) {
    const target = document.getElementById(a.hash.slice(1));
    // 124px = fixed nav (84) + enough of the section actually on screen
    if (target && target.getBoundingClientRect().top <= 124) current = a;
  }
  links.forEach((a) => a.classList.toggle('is-current', a === current));
}

function setupMobileMenu() {
  const burger = document.getElementById('nav-burger');
  const panel = document.getElementById('nav-panel');
  if (!burger || !panel) return;
  const closeBtn = panel.querySelector('.panel-close');
  const links = Array.from(panel.querySelectorAll('.panel-links a'));
  const logoLink = panel.querySelector('.panel-top .nav-logo');
  const featherLayer = panel.querySelector('.panel-feathers');

  const openMenu = () => {
    markCurrentSection(links);
    panel.inert = false;
    panel.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    spawnFeatherBurst(featherLayer);
    closeBtn.focus();
  };

  const closeMenu = () => {
    panel.classList.remove('open');
    panel.inert = true;
    burger.setAttribute('aria-expanded', 'false');
    featherLayer.replaceChildren(); // drop in-flight burst feathers
    burger.focus({ preventScroll: true });
  };

  burger.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  // closing first lets the native anchor jump happen on the revealed page
  links.forEach((a) => a.addEventListener('click', closeMenu));
  // the panel logo links to #accueil behind the opaque panel; it must close
  // the menu too, but stays out of `links` — markCurrentSection's is-current
  // toggle is only for the 5 section links, not the logo
  logoLink?.addEventListener('click', closeMenu);

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(panel.querySelectorAll('a, button'));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

// --- Init ---------------------------------------------------------------------

const onScroll = setupScroll();
setupHeroEntrance();
setupReveals();
setupMap();
highlightToday();
setupMobileMenu();
// first feather build runs the physics — defer it past first paint
(window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1)))(rebuildFeathers);

// OS-level prefers-reduced-motion can change live (e.g. user toggles it in
// system settings while the page is open): re-apply intensity + re-render.
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  document.documentElement.dataset.intensite = e.matches ? 'discret' : 'immersif';
  onScroll();
  rebuildFeathers();
});
