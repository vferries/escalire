# ADMIN-SETUP.md — Mise en service et exploitation de l'admin (SP3)

Public : mainteneur technique (Vincent). Le guide utilisateur est
`GUIDE-ADMIN.md`. Décisions d'architecture : spec
`superpowers/specs/2026-07-08-site-deploy-admin-design.md` (S3, S4, § 8).

Chaîne d'auth : `/admin` (Sveltia CMS statique) → Worker Cloudflare
`sveltia-cms-auth` (proxy OAuth) → OAuth App GitHub → commits sur
`vferries/escalire` avec le compte GitHub du libraire.

## 1. Créer l'OAuth App GitHub (une fois)

1. https://github.com/settings/applications/new (compte `vferries`)
2. Renseigner :
   - **Application name** : `Escalire admin`
   - **Homepage URL** : `https://vferries.github.io/escalire/`
   - **Authorization callback URL** : `https://<WORKER>/callback` — l'URL
     exacte du Worker n'est connue qu'après l'étape 2 ; mettre un placeholder
     et revenir la corriger.
3. **Register application**, puis **Generate a new client secret**. Noter
   Client ID et Client Secret (coffre partagé — jamais dans le dépôt).

## 2. Déployer le Worker sveltia-cms-auth (une fois)

Option A (bouton) : https://github.com/sveltia/sveltia-cms-auth → « Deploy to
Cloudflare Workers ». Option B (CLI) :

```bash
git clone https://github.com/sveltia/sveltia-cms-auth.git
cd sveltia-cms-auth
npx wrangler login
npx wrangler deploy
```

Puis, dans le dashboard Cloudflare (Workers → sveltia-cms-auth → Settings →
Variables) :

| Variable | Valeur | Chiffrée |
|---|---|---|
| `GITHUB_CLIENT_ID` | Client ID de l'étape 1 | non |
| `GITHUB_CLIENT_SECRET` | Client Secret de l'étape 1 | **oui (Encrypt)** |
| `ALLOWED_DOMAINS` | `vferries.github.io` | non |

Récupérer l'URL du Worker (`https://sveltia-cms-auth.<sous-domaine>.workers.dev`)
et reporter `https://<WORKER>/callback` dans l'OAuth App (étape 1).

## 3. Brancher le CMS sur le Worker

Dans `public/admin/config.yml`, remplacer le placeholder :

```yaml
backend:
  base_url: https://sveltia-cms-auth.<sous-domaine>.workers.dev
```

Commit + push : le déploiement GitHub Pages suit (< 5 min).

## 4. Inviter les libraires (2–4 comptes)

1. Chaque libraire crée un compte GitHub personnel (email pro de préférence),
   avec **2FA activée** (Settings → Password and authentication).
2. Dépôt `vferries/escalire` → Settings → Collaborators → **Add people** →
   rôle **Write** (= rôle unique « éditeur », cf. ADMIN.md).
3. Le libraire accepte l'invitation (email), puis se connecte sur
   `/escalire/admin/` — vérifier ensemble un premier coup de cœur
   (GUIDE-ADMIN.md), chronomètre en main : **< 5 min** saisie → en ligne.

### Tableau des accès

| Prénom | Compte GitHub | Rôle | 2FA | Invité le |
|---|---|---|---|---|
| Vincent | `vferries` | owner | oui | — |
| Anne-Sophie | `Escalire` | Write | oui | 2026-07-15 |

Écart assumé (spec S4) : auth par comptes GitHub et non par magic link
(ADMIN.md § Utilisateurs) — pas de backend d'auth possible à budget 0.

## 5. Travailler en local (test / dépannage)

`npm run dev` puis http://localhost:4321/escalire/admin/index.html →
« Work with Local Repository » (Chrome/Edge uniquement) → choisir le dossier
du dépôt. Les enregistrements écrivent directement dans l'arbre de travail,
sans OAuth ni commit : idéal pour tester `config.yml`.

## 6. Mettre à jour Sveltia (version figée, spec § 8)

Le bundle est vendorisé dans `public/admin/sveltia-cms.js` (v0.170.4).

```bash
npm view @sveltia/cms version        # dernière version
curl -fsSL https://unpkg.com/@sveltia/cms@<VERSION>/dist/sveltia-cms.js \
  -o public/admin/sveltia-cms.js
npm test                             # garde-fous page + config
```

Tester en local (§ 5) avant de pousser. En cas de régression Sveltia : la
config est compatible Decap CMS (bascule possible en changeant le script).
À noter : les clés `media_libraries`, `output` et `editor.preview` de
`config.yml` sont propres à Sveltia — Decap les ignore (perte du plafond 5 Mo
et de la conversion webp).

## 7. Récupération d'accès / incidents

- Libraire bloqué (mot de passe, 2FA) : récupération standard GitHub ; en
  dernier recours Vincent retire le collaborateur et le réinvite.
- Worker indisponible : l'admin ne permet plus de se connecter, **le site
  public reste en ligne** ; vérifier le dashboard Cloudflare (quota gratuit).
- Secret OAuth compromis : régénérer le Client Secret (OAuth App) et mettre à
  jour la variable chiffrée du Worker.

## 8. Bascule escalire.fr

Voir la checklist de `DEPLOY.md` — côté admin : `site_url`/`display_url` dans
`config.yml`, et ajouter `escalire.fr` à `ALLOWED_DOMAINS` du Worker.
