// Client behaviors: progress bar, nav shadow, parallax, hero entrance, scroll
// reveals, click-to-load Leaflet map (RGPD), current-day highlight, feather field.
//
// Ported from design/escalire-source.html (lines 1647-1770). "intensite" is
// now derived only from prefers-reduced-motion (immersif|discret), no user
// setting: see .superpowers/sdd/task-10-brief.md for the constants table.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
// Ported from design/escalire-source.html:
// - mkSeeds ranges: lines 1601-1614
// - gust accumulation (scroll handler): lines 1647-1651
// - gust decay loop: lines 1695-1707
// - 3-wrapper DOM (outer/fall/sway/tinted-mask): lines 1785-1815
//
// Vincent's decision: fixed look, no user-facing intensity control. Feathers
// are "many + slightly transparent" — full immersif counts, permanent 0.6
// opacity factor applied on top of each seed's own opacity (.55-.95 -> .33-.57).
const FEATHER_OPACITY_FACTOR = 0.6;

const HERO_PALETTE = ['#e8442e', '#f08a67', '#2b3f77', '#4a76b8', '#6aa7cc', '#23252b'];
const EVENTS_PALETTE = ['#f08a67', '#6aa7cc', '#c9dfed', '#e8442e', '#4a76b8', '#faf6ef'];

function mkSeeds(n, colors) {
  return Array.from({ length: n }, (_, i) => ({
    left: 2 + Math.random() * 96,
    dur: 15 + Math.random() * 17,
    delay: -Math.random() * 30,
    sway: 3.4 + Math.random() * 3.6,
    w: 26 + Math.random() * 28,
    o: 0.55 + Math.random() * 0.4,
    rot: -40 + Math.random() * 80,
    depth: 0.45 + Math.random() * 0.95,
    blur: Math.random() < 0.3 ? 1.4 : 0,
    flip: Math.random() < 0.5,
    color: colors[i % colors.length],
  }));
}

// Seeds are generated once and reused across rebuilds: intensity changes only
// change how many are shown (slice) and their opacity (soft factor), not the
// underlying random layout.
const heroSeeds = mkSeeds(20, HERO_PALETTE);
const eventSeeds = mkSeeds(14, EVENTS_PALETTE);

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

// 3 wrappers: outer (position + gust translateY) / fall (linear) / sway
// (sinusoidal) / innermost tinted mask div. Keep them separate — merging the
// transforms breaks the independent animations (see CLAUDE.md).
function buildFeather(seed, maskUrl) {
  const outer = document.createElement('div');
  outer.style.cssText = `position:absolute; top:0; left:${seed.left}%; will-change:transform;`;

  const fall = document.createElement('div');
  fall.style.animation = `featherFall ${seed.dur}s linear ${seed.delay}s infinite`;

  const sway = document.createElement('div');
  sway.style.animation = `featherSway ${seed.sway}s ease-in-out ${seed.delay}s infinite`;

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
    `transform:rotate(${seed.rot}deg)${seed.flip ? ' scaleX(-1)' : ''}`,
    seed.blur ? 'filter:blur(1.4px)' : 'filter:none',
  ].join(';');

  sway.appendChild(feather);
  fall.appendChild(sway);
  outer.appendChild(fall);
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

function rebuildFeathers() {
  const heroContainer = document.getElementById('hero-feathers');
  const eventsContainer = document.getElementById('events-feathers');

  activeFeathers = [];
  if (heroContainer) heroContainer.replaceChildren();
  if (eventsContainer) eventsContainer.replaceChildren();

  if (document.documentElement.dataset.intensite === 'discret') return; // no feathers

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

// --- Init ---------------------------------------------------------------------

const onScroll = setupScroll();
setupHeroEntrance();
setupReveals();
setupMap();
highlightToday();
rebuildFeathers();

// OS-level prefers-reduced-motion can change live (e.g. user toggles it in
// system settings while the page is open): re-apply intensity + re-render.
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  document.documentElement.dataset.intensite = e.matches ? 'discret' : 'immersif';
  onScroll();
  rebuildFeathers();
});
