# ADMIN.md — Spécification de l'espace d'administration

## Objectif
Permettre à l'équipe de la librairie (non-technique) de mettre à jour le site sans développeur.
Interface simple, en français, utilisable sur tablette.

## Utilisateurs & accès
- 2–4 comptes libraires, un rôle unique « éditeur » (pas de workflow de validation nécessaire).
- Auth simple mais sérieuse : magic link email ou mot de passe + 2FA optionnelle.
- URL non indexée (`/admin`), protégée.

## Contenus éditables

### 1. Coups de cœur (priorité 1)
- Liste ordonnée, 2–6 visibles sur le site.
- Champs : titre*, auteur*, éditeur*, ISBN13 (→ couverture auto via images.epagine.fr, avec aperçu), citation du libraire* (1–2 phrases), prénom du libraire, visible (bool).
- Upload manuel de couverture en secours si l'ISBN ne donne rien.

### 2. Événements / rencontres (priorité 1)
- Champs : titre*, date-heure*, type (rencontre / dédicace / lecture / atelier), description courte, affiche (image), lien externe (billetterie/réseaux), visible (bool).
- Le site affiche le prochain événement à venir dans la section Rencontres (affiche + date) ; les passés sont archivés automatiquement.

### 3. Horaires & infos pratiques (priorité 2)
- Grille horaires par jour (matin/après-midi), champ « annonce exceptionnelle » (ex. « fermé le 15 août ») affichée en bandeau sur le site si non vide.
- Téléphone, email, liens réseaux.

### 4. Équipe (priorité 3)
- Prénom, portrait (recadrage rond à l'upload), « rayon favori », visible (bool), ordre.

### 5. Textes de présentation (priorité 3)
- Les 2 paragraphes de la section « La librairie » et le slogan du hero (rarement modifiés).

## Non-objectifs
- Pas de vente en ligne, pas de gestion de stock (Place des Libraires s'en charge).
- Pas de blog, pas de multilingue.
- Pas d'édition du design (couleurs/typos figées par DESIGN.md).

## Recommandation d'implémentation
- **Option A (recommandée)** : site statique (Astro/Next SSG) + **Decap CMS** ou **Payload** — contenu en Git ou petite DB, rebuild automatique au save. Coût quasi nul, robuste.
- **Option B** : Next.js + DB (SQLite/Postgres) + admin custom minimal si l'option A s'avère trop rigide pour les événements récurrents.
- Images : stockage avec redimensionnement à l'upload (portraits 340px, affiches 800px, couvertures 460px).

## Critères d'acceptation
- Un libraire ajoute un coup de cœur avec ISBN et le voit en ligne en < 5 min sans aide.
- Aucune modification admin ne peut casser la mise en page (champs bornés, images recadrées).
- Le site reste 100 % fonctionnel si l'admin est indisponible (contenu statique en cache).
