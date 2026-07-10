# Spec — SP5 : CTA commandes, carte statique RGPD, mentions légales

Date : 2026-07-10. Statut : validée (brainstorming avec Vincent).
Complète la spec 2026-07-08 (site/deploy/admin). SP4 (enrichissement ISBN)
reste un chantier séparé, déjà spécifié (spec 2026-07-08 § 5 SP4).
Workflow : commits directs sur `main` (décision Vincent 2026-07-10, plus de PR).

## 1. Objectif

Trois améliorations du site vitrine :
1. rendre visible le parcours de commande en ligne (Place des Libraires) ;
2. afficher la carte immédiatement sans consentement ni requête tierce ;
3. créer une vraie page de mentions légales assortie au site.

## 2. Décisions

| # | Décision | Pourquoi | Écarté |
|---|---|---|---|
| I1 | **CTA « Bon à savoir »** : la ligne « Commandes en ligne via Place des Libraires » (Infos.astro) devient un bouton pilule plein (`pill pill-fill`, style existant des coups de cœur), libellé « Commander sur Place des Libraires », href = `placeDesLibraires` d'`infos.json` (éditable dans l'admin), en bas de la carte « Bon à savoir » | Demande : rendre ce lien plus visible ; réutilise un style existant | Bouton par livre vers la fiche PdL (non souhaité) ; CTA hero/sticky (surdimensionné) |
| I2 | **Carte statique au chargement** : image des tuiles CARTO + marqueur plume, capturée une fois en local (Playwright) et commitée (`public/assets/map-escalire.png`, ~2× pour le retina), affichée à la place du placeholder clic-pour-charger ; bouton superposé « Activer la carte interactive » qui déclenche l'`initMap()` existant ; attribution « © OpenStreetMap contributors © CARTO » visible sous l'image | Zéro tiers au chargement → affichage direct sans consentement (RGPD) ; coordonnées de la librairie immuables → pas de pipeline de génération au build (YAGNI) | Bandeau de consentement (déplace le clic sans le supprimer) ; tuiles proxifiées par Worker (code à maintenir, quota) ; génération au build (inutile) |
| I3 | **Page `/mentions-legales/`** : page Astro avec le layout du site (nav, papier, typo, footer), contenu § 4 ; lien du footer basculé de `escalire.fr/MentionsLegales.html` vers la page interne ; ajoutée au sitemap | Obligation légale + page assortie au site (l'ancienne est externe et datée) | Reprendre l'ancienne page telle quelle (hébergeur faux, pas de volet données personnelles) |
| I4 | **Ancres de nav absolues** : les liens de la nav passent de `#section` à `{base}#section` | Nécessaire pour que la nav fonctionne depuis la sous-page mentions légales | Nav spécifique à la sous-page (duplication) |

## 3. Contenu des mentions légales (I3)

Repris de l'ancienne page et actualisé :

- **Éditeur** : EURL Librairie Escalire, capital social 8 000 €,
  SIRET 752 566 893 00018, Espace commercial 61, 61 avenue de Toulouse,
  31750 Escalquens — tél. 05 62 80 68 50, contact@escalire.fr.
  Directrice de la publication : **Anne-Sophie Delage**.
- **Hébergement** : site hébergé par GitHub Pages (GitHub, Inc.,
  88 Colin P. Kelly Jr St, San Francisco, CA 94107, USA). Nom de domaine et
  DNS : OVH (2 rue Kellermann, 59100 Roubaix) — OVH ne fournit que le
  domaine/CNAME, pas l'hébergement du site.
- **Données personnelles** : pas de cookies, pas d'outil de mesure
  d'audience ; aucune donnée collectée par le site. Les couvertures de
  livres sont chargées depuis `images.epagine.fr` (l'adresse IP du visiteur
  est transmise à ce service, comme pour toute image tierce). La carte est
  une image auto-hébergée ; les tuiles CARTO ne sont chargées qu'après
  activation manuelle de la carte interactive. Droits (accès, rectification,
  effacement) : contact@escalire.fr.
- **Propriété intellectuelle** : contenus (textes, photos, illustrations,
  identité graphique « encre & plume ») propriété de la librairie ou de
  leurs auteurs ; reproduction soumise à autorisation.
- **Crédits** : données cartographiques © OpenStreetMap contributors,
  fond de carte © CARTO ; polices EB Garamond, Cormorant Garamond et Caveat
  sous licence SIL Open Font License (auto-hébergées) ; couvertures de
  livres © leurs éditeurs, via epagine.

Note polices : la SIL OFL n'impose aucune attribution sur le site (seulement
la conservation de la licence avec les fichiers, assurée par @fontsource) —
la ligne crédits est volontaire, pas une obligation.

## 4. Comportements et acceptation

- **I1** : le bouton est visible sans scroll dans la carte « Bon à savoir »
  (desktop), ouvre PdL dans un nouvel onglet (`rel="noopener"`), contraste AA.
- **I2** : au chargement de la page, **aucune requête** vers `*.cartocdn.com`
  / CARTO (vérifiable dans l'onglet réseau) ; l'image de carte s'affiche avec
  le marqueur et l'attribution ; le clic sur « Activer la carte interactive »
  charge Leaflet + tuiles comme aujourd'hui ; `prefers-reduced-motion` et
  a11y inchangés (alt descriptif sur l'image, bouton focusable).
- **I3** : `/mentions-legales/` accessible depuis le footer, layout du site,
  contenu § 3 ; présente dans `sitemap.xml` ; la nav de la sous-page ramène
  aux sections de l'accueil (I4). DEPLOY.md : case « Mentions légales »
  cochée, mapping 301 `/MentionsLegales.html → /mentions-legales/` noté pour
  la bascule escalire.fr.
- Garde-fous vitest : bouton CTA présent avec le bon href ; attribution carte
  présente ; footer pointe vers la page interne ; sitemap contient la page ;
  aucune URL `cartocdn` dans le HTML rendu au chargement (hors script d'init
  au clic). `npm test` + `npm run build` verts.

## 5. Hors périmètre

- SP4 (enrichissement ISBN au build) — chantier suivant, spec existante.
- Bouton commander par livre (écarté), proxy de tuiles (écarté).
- Redirections 301 effectives (à la bascule de domaine, DEPLOY.md).
