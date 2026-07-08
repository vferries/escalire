# DESIGN.md — Système de design Escalire

Référence : `design/escalire.html` (standalone, ouvrable directement). Direction : **« encre & plume »** — librairie indépendante, littéraire et chaleureuse, spectaculaire sans être tape-à-l'œil. Inspiration animations : oneshot-sakura.vercel.app (adapté encre/plumes).

## 1. Palette

| Token | Hex | Usage |
|---|---|---|
| `--paper` | `#faf6ef` | Fond principal crème |
| `--paper-card` | `#fffdf8` | Cartes, polaroids |
| `--sky` | `#c9dfed` | Bleu logo — hero, footer |
| `--sky-soft` | `#e9f1f8` → `#dcebf5` | Dégradé section Coups de cœur |
| `--sand` | `#f4eee3` → `#efe7d8` | Dégradé section Infos |
| `--ink` | `#181a20` | Texte principal, nav CTA |
| `--night` | `#14161c` | Fond section Rencontres (sombre) |
| `--navy` | `#2b3f77` | Accent principal (logo) |
| `--blue` | `#4a76b8`, `--blue-light` `#6aa7cc` | Accents secondaires (logo) |
| `--red` | `#e8442e` | Accent vif (logo) — CTA hover, kickers |
| `--coral` | `#f08a67` | Accent doux (logo) — section sombre |
| Texte secondaire | `#33363f` / `#5a5e69` / `#c8cad2` (sur sombre) | |

Règle : max 2 ambiances de fond par vue (crème/bleu clair + une section sombre). Liens : couleur `--navy`, hover `--red`.

## 2. Typographie

| Rôle | Police | Styles |
|---|---|---|
| Titres H2 | **Cormorant Garamond** 600 | `clamp(36px, 4.6vw, 56px)`, line-height 1.1 |
| Sous-titre hero | Cormorant Garamond 500 italic | `clamp(22px, 3.2vw, 30px)` |
| Corps | **EB Garamond** 400/500 | 17–19px, line-height 1.65 |
| Manuscrit (kickers, légendes, citations) | **Caveat** 500–700 | 21–26px |
| Nav / boutons | EB Garamond | 16–17px, letter-spacing .04–.05em |

Google Fonts. Kickers manuscrits en minuscules (« la librairie », « on vous attend »).

## 3. Assets (design/assets/)

| Fichier | Rôle | Notes |
|---|---|---|
| `logo-escalire.png` | Logo détouré (fond transparent) | 706×347 |
| `feather.png` | Plume du logo, extraction couleur | marqueur carte, carte « Et le vôtre ? », footer |
| `feather-mask.png` | **Masque monochrome haute-rés** de la plume (blanc/alpha, 636×1220) | teindre via `mask-image` + `background` |
| `brush-stroke.png` | Trait de pinceau (masque blanc/alpha 1000×160) | soulignés de titres, fond du slogan |
| `ink-splat.png` | Tache d'encre (masque 600×600) | éclaboussures décoratives |
| `ink-edge.png` | Bord de papier déchiré (masque 1600×160) | séparations de sections |
| `photo-devanture.png`, `photo-interieur.png` | Photos réelles | remplaçables par le client |

Technique de teinte : `background: <couleur>; mask-image: url(...); mask-size: 100% 100%;` — jamais de recoloration de bitmap.

## 4. Structure de page (one-page)

Nav fixe (blur + fond `rgba(250,246,239,.82)`, ombre au scroll) + barre de progression 3px dégradé rouge→navy→bleu en haut.

1. **Hero** `#accueil` — dégradé bleu ciel, logo XL, sous-titre italique, slogan Caveat blanc sur trait de pinceau noir incliné (−1.5°), 2 CTA pilule, cue « défiler », grandes plumes parallaxe + plumes qui tombent
2. **La librairie** `#librairie` — crème ; 2 colonnes : texte + chips rayons / 2 polaroids inclinés (photos réelles)
3. **Coups de cœur** `#coups-de-coeur` — dégradé bleu très clair ; 2 cartes livre (vraie couverture, titre, auteur–éditeur, citation Caveat) + carte « Et le vôtre ? » en pointillés
4. **Rencontres** `#evenements` — **sombre** `--night` ; texte + 3 puces + CTA sociaux / polaroid affiche ; plumes qui tombent (teintes claires)
5. **L'équipe** `#equipe` — crème ; 3 portraits ronds + légende Caveat (placeholder)
6. **Infos pratiques** `#infos` — dégradé sable ; 3 cartes (Horaires / Adresse-contact / Bon à savoir) + **carte Leaflet** fond CARTO light_all, marqueur = plume, popup nom+adresse, scrollWheelZoom désactivé
7. **Footer** — bleu ciel ; logo, liens, mentions légales, plume en bas à droite

Séparations : bandes `ink-edge.png` en masque, chevauchement −90px sur la section précédente (crème↔sombre selon contexte).

## 5. Animations (cœur de l'expérience)

Toutes désactivables via un mode (`immersif` / `equilibre` / `discret` — prop `intensite`). `equilibre` = amplitudes ×0.5 ; `discret` = parallaxe/plumes quasi coupées, reveals réduits à 12px. Respecter aussi `prefers-reduced-motion`.

| Effet | Détail |
|---|---|
| Entrée hero | opacity 0→1 + translateY 26px→0, stagger 140ms/élément, easing `cubic-bezier(.22,.61,.21,1)` |
| Reveals au scroll | IntersectionObserver (threshold .16, one-shot). Types : `up` (30px), `fade`, `ink` (scaleX 0→1, origin left — soulignés), `ink-text` (blur 10px→0 + léger translateY : « l'encre sèche »), `pop` (scale .3 + rotate → 1) ; délais échelonnés 60–420ms |
| Parallaxe | Hero art ×0.26, fond hero ×0.14 ; plumes de fond par section, facteurs 0.07–0.16, clamp ±260px, rotation propre conservée |
| Plumes qui tombent | Hero (20 max) + Rencontres (14 max). 3 wrappers imbriqués : chute linéaire 15–32s (translateY −24vh→124vh) / balancement sinusoïdal 3.4–7s / plume teintée (26–54px, rotation −40°..+40°, flip aléatoire, opacité .55–.95, 30% floutées 1.4px). **Rafale** : vélocité de scroll → offset translateY amorti (×0.9/frame) proportionnel à une profondeur aléatoire par plume |
| Divers | Halos radiaux `inkDrift` 16–20s ; cue « défiler » bobbing 2.8s ; hovers boutons : fond + translateY(−2px) |

## 6. Composants

- **Boutons pilule** : radius 999px, padding 13–14px 26–28px ; primaire fond `--ink` → hover `--navy` ; secondaire bordure 1.5px
- **Polaroid** : fond `--paper-card`, padding 14–16px + 18–20px bas, radius 6px, ombre `0 22px 44px rgba(24,30,50,.14)`, rotation ±1.6–1.8°, légende Caveat
- **Carte livre** : radius 8px, ombre douce, rotation ±1.2–1.4°, couverture ~460px de haut
- **Chips rayons** : pilule bordure fine, pastille couleur 8px, fond `--paper-card`
- **Cartes infos** : radius 10px, padding 34px 32px, ombre `0 18px 40px rgba(24,30,50,.10)`

## 7. Échelles & divers

- Conteneur max 1140px ; sections padding 120px 28px ; grilles `repeat(auto-fit, minmax(260–320px, 1fr))`, gap 32–64px
- `scroll-margin-top: 84px` sur chaque section (nav fixe) ; ancres `#librairie`, etc.
- Sélection de texte : fond `--sky` ; `text-wrap: pretty` sur les paragraphes
- Couvertures livres : `images.epagine.fr/{fin ISBN}/{ISBN}_1_75.jpg` (pas de CORS — afficher en `<img>`, ne pas canvasser)
