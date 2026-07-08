# Spec — Recréation Astro, publication GitHub Pages, admin Sveltia CMS

Date : 2026-07-08. Statut : validée (brainstorming avec Vincent).
Se lit avec les documents de passation : `DESIGN.md` (système de design,
source de vérité visuelle), `docs/ADMIN.md` (périmètre fonctionnel de
l'admin), `docs/DEPLOY.md` (contraintes d'hébergement). Cette spec les
opérationnalise et consigne les écarts assumés.

## 1. Contexte et objectif

Recréer le site vitrine de la librairie Escalire (Escalquens, 31) à partir de
la maquette `design/escalire.html` — sans son runtime de prototypage — puis le
publier gratuitement et le rendre actualisable par l'équipe de la librairie
(non technique) : rencontres et coups de cœur en priorité 1 (cf. ADMIN.md).

## 2. Décisions

| # | Décision | Pourquoi | Écarté |
|---|---|---|---|
| S1 | **Stack : Astro SSG**, sortie 100 % statique, one-page conforme à DESIGN.md § 4 | Voie recommandée par ADMIN.md (option A) ; pipeline d'images intégré (uploads CMS redimensionnés au build), collections de contenu typées = validation de schéma gratuite | Vanilla + build maison (pipeline d'images et dev server à réécrire, dépendance sharp de toute façon) ; Next.js (surdimensionné pour du statique) |
| S2 | **Hébergement : GitHub Pages**, dépôt public, d'abord `vferries.github.io/escalire` (base path), bascule `escalire.fr` plus tard | Gratuit, HTTPS natif, workflow Actions intégré ; le domaine attendra que registrar/DNS/MX soient vérifiés (DEPLOY.md § Contraintes) | Netlify/Cloudflare Pages (équivalents ; GitHub retenu pour tout garder au même endroit) ; VPS (coût/maintenance) |
| S3 | **Admin : Sveltia CMS** servi sur `/admin`, backend GitHub, proxy OAuth `sveltia-cms-auth` en Cloudflare Worker (gratuit) | Successeur maintenu et compatible de Decap (= option A d'ADMIN.md), interface en français, config versionnée, zéro serveur | Pages CMS (service tiers hébergé) ; Payload/admin custom (serveur ou DB à maintenir, contraire au budget 0 €) |
| S4 | **Auth admin : comptes GitHub** (2–4 libraires invités collaborateurs du dépôt) | Seule option robuste et gratuite sans serveur d'auth ; 2FA disponible côté GitHub | Magic link email prévu par ADMIN.md § Utilisateurs — impossible sans backend ; écart assumé, consigné ici |
| S5 | **Couvertures : `images.epagine.fr`** par ISBN13 (convention du projet, CLAUDE.md), `<img>` direct, fallback typographique navy/crème si 404, upload manuel en secours | URL déterministe → couverture immédiate ; c'est le CDN utilisé par Place des Libraires | Récupération/commit des images au build (inutile puisque le hotlink est la convention établie du projet) |
| S6 | **Saisie coup de cœur : ISBN + citation + prénom** ; titre/auteur/éditeur **auto-remplis au build** (BnF SRU puis Google Books), réinjectés par commit bot, corrigeables dans le CMS | Saisie minimale (< 1 min) ; BnF = source la plus fiable pour l'édition française | Champs titre/auteur/éditeur obligatoires à la saisie (ADMIN.md) — conservés en secours : ils restent éditables et priment s'ils sont remplis |
| S7 | **Rebuild planifié quotidien** (cron Actions) en plus du build sur push | L'archivage des rencontres passées (ADMIN.md § 2) se fait au build : sans cron, un événement passé resterait affiché | Filtrage côté client (contenu obsolète dans le HTML) |
| S8 | **Réutilisation sélective d'`old/escalire-bak`** : schéma de collection événements, logique passé/à-venir (testée), archive des rencontres 2021–2026 | Déjà écrit et testé ; le contenu réel a de la valeur | Repartir du dépôt bak (design Fraunces/Inter multi-pages incompatible avec la maquette « encre & plume ») ; zéro réutilisation (gâchis) |

## 3. Architecture

```
libraires ──> vferries.github.io/escalire/admin/   (Sveltia CMS, statique)
                    │  login GitHub (proxy OAuth : Cloudflare Worker)
                    ▼
             dépôt GitHub public ── commits sur src/content/
                    │
                    ▼
             GitHub Actions (push + cron quotidien) :
               1. enrichit les coups de cœur par ISBN (S6) → commit bot
                  (garde-fou anti-boucle : [skip ci] / filtrage de chemins)
               2. astro build (validation des collections, images
                  redimensionnées, événements passés archivés)
               3. déploie dist/ sur GitHub Pages
                    │
                    ▼
             vferries.github.io/escalire/   (statique ; tiers au runtime :
             images.epagine.fr (couvertures) + tuiles CARTO (carte, cf. § 6))
```

- Un contenu invalide fait **échouer le build** (schémas Zod des collections) :
  le site en ligne n'est jamais remplacé par une version cassée — répond au
  critère ADMIN.md « aucune modification admin ne peut casser la mise en page ».
- Base path `/escalire/` géré par `base` dans `astro.config` ; la bascule
  `escalire.fr` = config Pages + DNS + checklist DEPLOY.md (301, mentions
  légales, MX intacts), hors périmètre de cette spec.

## 4. Contenus (collections Astro, éditées par le CMS)

Champs et bornes conformes à ADMIN.md § Contenus éditables. Résumé :

| Collection | Champs saisis | Champs auto |
|---|---|---|
| `coups-de-coeur` | isbn13, citation (≤ 200 car.), prénom du libraire, visible, ordre, couverture manuelle (secours) | titre, auteur, éditeur (S6) ; couverture epagine (S5) |
| `evenements` | titre, date-heure, type (rencontre/dédicace/lecture/atelier), description courte, affiche (image), lien externe, visible | archivage passé/à-venir au build (S7) |
| `equipe` | prénom, portrait, rayon favori, visible, ordre | recadrage rond au build (pipeline Astro) |
| `infos` | grille horaires matin/après-midi par jour, annonce exceptionnelle (bandeau si non vide), téléphone, email, réseaux | surlignage du jour courant côté client |
| `textes` | slogan hero, 2 paragraphes « La librairie » | — |

Règles d'affichage : 2–6 coups de cœur visibles ; section Rencontres =
prochain événement à venir en avant (affiche + date) ; zéro contenu visible
dans une collection → section masquée plutôt que vide.

## 5. Sous-projets (ordre impératif, une branche/PR chacun)

### SP1 — Recréation du site (le gros morceau)
Projet Astro scaffoldé dans ce dépôt, tokens/typo/assets selon DESIGN.md,
sections § 4 de DESIGN.md, animations § 5 (3 intensités + `prefers-reduced-motion`),
contenu servi par les collections § 4 ci-dessus, fontes self-hostées
(`@fontsource`), carte Leaflet (tuiles CARTO, marqueur plume), pièges connus
de CLAUDE.md respectés (z-index papier déchiré, scroll-margin-top 84px,
3 wrappers pour les plumes, pas d'overflow hidden sur body).
**Acceptation :** parité visuelle maquette (desktop puis mobile conçu d'après
DESIGN.md) ; contenu modifié dans une collection → visible au build suivant ;
`npm run build` sans erreur ; logique passé/à-venir des événements couverte
par des tests (reprise d'escalire-bak).

### SP2 — Mise en ligne GitHub Pages
Dépôt poussé sur GitHub (public), workflow Actions (build → deploy, push +
cron quotidien), base path, SEO local (meta, schema.org BookStore, sitemap,
robots.txt avec exclusion de /admin), décision bandeau/clic-pour-charger sur
la carte CARTO (RGPD, cf. § 6).
**Acceptation :** site en ligne sur `vferries.github.io/escalire/` ; un commit
de contenu est en ligne sans action manuelle en < 5 min ; un contenu invalide
bloque le déploiement avec erreur explicite ; Lighthouse mobile > 90 perf /
100 a11y (critère DEPLOY.md) ; couvertures epagine vérifiées depuis l'URL de prod.

### SP3 — Admin Sveltia
`public/admin/` (app + `config.yml`, collections § 4 en français, validations),
proxy OAuth déployé (Cloudflare Worker), comptes GitHub des libraires créés et
invités, `/admin` en noindex et hors sitemap, procédure pas-à-pas rédigée pour
l'équipe (avec captures) + tableau des accès dans les docs de passation.
**Acceptation :** critère ADMIN.md — un libraire ajoute un coup de cœur avec
ISBN et le voit en ligne en < 5 min sans aide ; aucune écriture sans
authentification ; champs bornés dès le CMS.

### SP4 — Enrichissement ISBN au build
Script Node dans le workflow : pour chaque coup de cœur dont titre/auteur/
éditeur sont vides, interroge BnF SRU puis Google Books, réinjecte par commit
bot (anti-boucle testé). ISBN introuvable → fiche non publiée, champs vides
visibles dans le CMS, build en avertissement (pas en échec).
**Acceptation :** fiche saisie avec ISBN + citation seulement → complète en
ligne après le build ; ISBN erroné → site intact, fiche absente ; les champs
remplis à la main priment toujours sur l'enrichissement.

## 6. RGPD et tiers au runtime

- Fontes self-hostées dès SP1 (pas de Google Fonts au runtime).
- `images.epagine.fr` : hotlink d'images produit (IP visiteur transmise) —
  même pratique que les sites de libraires ; mentionné dans les mentions légales.
- Tuiles CARTO (carte Leaflet) : IP transmise → bandeau simple **ou**
  chargement de la carte au clic (décision en SP2, consignée dans DEPLOY.md).
- Pas d'analytics (si besoin plus tard : sans cookie, type Plausible — DEPLOY.md).
- Aucun secret dans le dépôt (secret OAuth dans Cloudflare ; comptes libraires
  dans le coffre partagé).

## 7. Hors périmètre

- Bascule `escalire.fr` (checklist DEPLOY.md, à jouer quand registrar/DNS/MX
  seront vérifiés) — le site doit néanmoins être prêt (301, mentions légales
  reprises, base path paramétrable).
- Vente en ligne, stock, blog, multilingue (non-objectifs ADMIN.md).
- Workflow de validation éditoriale (rôle unique « éditeur », ADMIN.md).

## 8. Risques et parades

| Risque | Parade |
|---|---|
| epagine change son schéma d'URL ou bloque le hotlink | Fallback typographique déjà prévu (S5) + upload manuel ; le site reste entier |
| API BnF/Google Books muettes ou fausses | Multi-sources, champs corrigeables, fiche incomplète jamais publiée (SP4) |
| Un libraire perd son accès GitHub | Vincent owner du dépôt ; procédure de récupération dans la doc de passation |
| Sveltia évolue/casse | Version figée (fichier vendorisé) ; config compatible Decap → bascule possible |
| Commit bot → boucle de workflows | `[skip ci]`/filtrage de chemins, testé en SP4 |
| Écart auth (GitHub vs magic link) mal vécu par l'équipe | Procédure illustrée pas-à-pas, comptes préparés avec les libraires, 2FA guidée |
