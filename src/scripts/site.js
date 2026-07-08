// Client behaviors: progress bar, nav shadow, parallax, hero entrance, scroll
// reveals, lazy Leaflet map, current-day highlight, animation intensity setting.
//
// Ported from design/escalire-source.html (lines 1647-1770), adapted so the
// "intensite" setting is a client-persisted choice instead of a build-time
// prop. See .superpowers/sdd/task-10-brief.md for the constants table.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STORAGE_KEY = 'escalire-animations';
const INTENSITES = { immersif: 1, equilibre: 0.5, discret: 0 };
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
    const base = el.style.transform && el.style.transform !== 'none' ? el.style.transform : '';
    el.dataset.rvBase = base;
    el.dataset.rvOpacity = getComputedStyle(el).opacity;
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = `${base} translateY(26px)`;
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      entries.forEach((el, i) => {
        el.style.transition = `opacity 1s ${EASE}, transform 1.1s ${EASE}`;
        setTimeout(() => {
          el.style.opacity = el.dataset.rvOpacity;
          el.style.transform = el.dataset.rvBase || 'none';
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
          el.style.opacity = el.dataset.rvOpacity || '1';
          el.style.transform = el.dataset.rvBase || 'none';
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
    const base = el.style.transform && el.style.transform !== 'none' ? el.style.transform : '';
    const dist = 30 * a;

    el.dataset.rvBase = base;
    el.dataset.rvOpacity = getComputedStyle(el).opacity;
    el.style.transition = `opacity .9s ${EASE} ${delay}, transform 1s ${EASE} ${delay}, filter 1.1s ${EASE} ${delay}`;
    el.style.opacity = '0';

    if (kind === 'ink') {
      el.style.transformOrigin = 'left center';
      el.style.transform = `${base} scaleX(0)`;
    } else if (kind === 'pop') {
      el.style.transform = `${base} scale(0.3) rotate(-24deg)`;
    } else if (kind === 'ink-text') {
      el.style.filter = 'blur(10px)';
      el.style.transform = `${base} translateY(${dist * 0.5}px)`;
    } else if (kind === 'up') {
      el.style.transform = `${base} translateY(${dist}px)`;
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
  const el = document.getElementById('map-escalire');
  if (!el) return;

  const io = new IntersectionObserver(
    (observed) => {
      observed.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        initMap(el);
      });
    },
    { rootMargin: '400px' },
  );
  io.observe(el);
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

// --- Intensity setting UI -----------------------------------------------------

function rebuildFeathers() {
  // implemented in Task 11 (falling feathers)
}

function setupIntensity(onScroll) {
  const radios = document.querySelectorAll('input[name="intensite"]');
  const current = document.documentElement.dataset.intensite;
  radios.forEach((radio) => {
    radio.checked = radio.value === current;
  });

  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      document.documentElement.dataset.intensite = radio.value;
      localStorage.setItem(STORAGE_KEY, radio.value);
      onScroll();
      rebuildFeathers();
    });
  });
}

// --- Init ---------------------------------------------------------------------

const onScroll = setupScroll();
setupHeroEntrance();
setupReveals();
setupMap();
highlightToday();
setupIntensity(onScroll);
