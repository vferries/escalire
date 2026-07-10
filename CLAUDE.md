# CLAUDE.md — Instructions projet pour Claude Code

## Contexte
Productisation du site vitrine de la librairie Escalire (Escalquens) + espace d'administration.
La maquette de référence est `design/escalire.html` (HTML standalone haute-fidélité). **On recrée, on ne copie pas** : le HTML de la maquette utilise un runtime de prototypage qui ne doit pas partir en production.

## Sources de vérité
1. `DESIGN.md` — tokens, typo, effets, structure. Toute divergence visuelle avec la maquette doit être justifiée.
2. `design/escalire.html` — comportement de référence (ouvrir dans un navigateur pour arbitrer un détail d'animation).
3. `docs/ADMIN.md` — périmètre fonctionnel de l'admin.

## Conventions
- **Langue** : site 100 % français ; code et commits en anglais.
- **CSS** : décliner les tokens de DESIGN.md en variables CSS (`--paper`, `--navy`…). Pas de framework UI lourd ; Tailwind acceptable si mappé sur les tokens.
- **Animations** : IntersectionObserver + transforms/opacity uniquement (pas de layout thrash). Respecter `prefers-reduced-motion` (les plumes et animations continues se coupent). Plumes : nombreuses et légèrement transparentes (opacité ×0.6), pas de réglage utilisateur.
- **Images** : assets de `design/assets/` à reprendre tels quels ; masques (plume, pinceau, encre, déchirure) appliqués via `mask-image` + `background-color`, jamais de bitmaps recolorés.
- **Couvertures de livres** : `https://images.epagine.fr/{3 derniers chiffres ISBN}/{ISBN13}_1_75.jpg`. Pas de CORS : `<img>` direct uniquement. Prévoir un fallback typographique (carte navy/crème) si 404.
- **Carte** : Leaflet + tuiles CARTO `light_all`, marqueur `feather.png`, scrollWheelZoom désactivé.
- **SEO / a11y** : one-page avec vraies ancres, balises meta locales (librairie Escalquens), schema.org `Book Store` (adresse, horaires, téléphone), alt sur toutes les images, contrastes AA (attention aux Caveat sur fonds clairs).

## Priorités (dans l'ordre)
1. Parité visuelle avec la maquette (desktop puis mobile — la maquette est desktop-first, le mobile est à concevoir en suivant DESIGN.md)
2. Espace admin (docs/ADMIN.md) : coups de cœur, événements, horaires, équipe
3. Perf : LCP < 2.5s (précharger logo + police display, lazy-load carte et photos sous le fold)

## Pièges connus
- Les séparations « papier déchiré » chevauchent la section précédente de −90px : gérer le z-index (bande au-dessus, contenu des sections en `position: relative`).
- La barre de progression et la nav sont fixes : `scroll-margin-top: 84px` obligatoire sur les sections.
- Les plumes qui tombent sont recréées avec 4 wrappers imbriqués (chute+dérive / balancement / frémissement / rotation-teinte) — ne pas fusionner les transforms.
- Ne pas mettre `overflow: hidden` sur `body` ; chaque section masque ses propres débordements.
