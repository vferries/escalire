# Escalire — Site vitrine + Administration

Site vitrine de la **librairie Escalire** (Escalquens, 31), à productiser à partir des maquettes HTML du dossier [`design/`](design/), avec ajout d'un espace d'administration.

> ⚠️ **Les fichiers de `design/` sont des références de design, pas du code de production.**
> Ce sont des prototypes HTML haute-fidélité montrant le rendu et les comportements attendus.
> Le travail consiste à les **recréer proprement** dans une stack web moderne — pas à copier le HTML tel quel.

## Démarrage

```bash
git init
git add -A
git commit -m "chore: import design handoff"
```

Puis avec Claude Code : le fichier [`CLAUDE.md`](CLAUDE.md) contient les instructions projet, [`DESIGN.md`](DESIGN.md) le système de design complet, [`docs/ADMIN.md`](docs/ADMIN.md) la spec de l'espace d'administration.

## Contenu du repo

| Chemin | Rôle |
|---|---|
| `README.md` | Ce fichier — vue d'ensemble et passation |
| `DESIGN.md` | Système de design : tokens, typo, effets, sections, animations |
| `CLAUDE.md` | Instructions pour Claude Code (conventions, priorités, pièges) |
| `docs/ADMIN.md` | Spécification fonctionnelle de l'espace d'administration |
| `docs/DEPLOY.md` | Pistes d'hébergement et de mise en ligne |
| `design/escalire.html` | **Maquette standalone** — s'ouvre dans un navigateur sans serveur |
| `design/assets/` | Assets prêts à l'emploi (logo, plume, masques d'encre, photos) |

## Choix de stack (recommandation, non imposée)

Le site est un one-page à contenu semi-statique + un besoin d'admin simple (coups de cœur,
événements, horaires, équipe). Recommandation : **Astro ou Next.js** + un CMS headless léger
(**Decap CMS**, Payload, ou Strapi) plutôt qu'un backend custom. Voir `docs/ADMIN.md`.
Si une autre stack est déjà en place chez vous, suivez ses conventions.

## Fidélité

Maquette **haute-fidélité** : couleurs, typos, espacements, animations et copies sont finaux
(sauf mention "à remplacer" dans DESIGN.md). Reproduire au pixel près en réutilisant les
tokens de DESIGN.md.

## Contenu réel vs placeholder

- ✅ Réel : logo, plume extraite, photos devanture/intérieur, horaires, adresse, téléphone, email, liens sociaux, les 2 coups de cœur (titres/auteurs/éditeurs réels, couvertures via images.epagine.fr)
- 🔶 Placeholder : portraits et prénoms de l'équipe, affiche de rencontre, citations des libraires ("le petit mot"), le mot manuscrit sous les photos

## Contacts & sources

- Site actuel : https://escalire.fr (infos pratiques d'origine)
- Fiche Place des Libraires : https://www.placedeslibraires.fr/librairie-6038/escalquens/Escalire/
- Réseaux : Instagram `librairie_escalire`, Facebook `escalirelibrairie`
