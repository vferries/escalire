# DEPLOY.md — Hébergement & mise en ligne

## Contraintes
- Domaine existant : escalire.fr (actuellement chez l'hébergeur du site actuel — vérifier le registrar et la main sur les DNS avant tout).
- Budget librairie indépendante : viser < 10 €/mois, idéalement 0.
- HTTPS obligatoire ; email `contact@escalire.fr` à ne pas casser (vérifier où sont les MX avant de toucher aux DNS).

## Pistes par ordre de simplicité
1. **Statique + Decap CMS** : Netlify / Cloudflare Pages (gratuit) — build auto à chaque édition de contenu, admin inclus via Git Gateway ou GitHub OAuth.
2. **Next.js + Payload** : Vercel + base Neon/Supabase (gratuit ou ~5 €/mois selon trafic).
3. **VPS mutualisé français** (o2switch, Infomaniak) si la librairie préfère un interlocuteur FR unique — plus de maintenance manuelle.

## Checklist mise en ligne
- [x] Redirections 301 depuis les anciennes URLs de escalire.fr (au minimum `/MentionsLegales.html` → `/mentions-legales/`) — meta-refresh + canonical, GitHub Pages ne fait pas de vrai 301 (2026-07-16)
- [x] Mentions légales reprises du site actuel — page interne `/mentions-legales/` (SP5, contenu actualisé : hébergeur GitHub Pages, volet données personnelles)
- [ ] Meta locales + schema.org BookStore + sitemap + robots.txt
- [x] Déclaration RGPD minimale : la carte charge des tuiles CARTO (IP transmise) — bandeau simple ou tuiles proxifiées ; pas d'analytics ou analytics sans cookie (Plausible)
- [ ] Test Lighthouse mobile > 90 perf / 100 a11y sur la page
- [x] Vérifier l'affichage des couvertures epagine depuis le domaine de prod (200 avec referer escalire.fr, 2026-07-16)
- [x] Bascule escalire.fr : régénérer `robots.txt` (Disallow: /admin/) et `sitemap.xml` (URLs racine), ajuster `site`/`base` dans `astro.config`, mettre à jour `site_url`/`display_url` dans `public/admin/config.yml` et ajouter `escalire.fr` à `ALLOWED_DOMAINS` du Worker OAuth (cf. ADMIN-SETUP.md § 8) — fait le 2026-07-16 (DNS OVH + custom domain GitHub + Worker vérifié : 302 OAuth pour escalire.fr) ; restait à l'écriture : Enforce HTTPS (cert en émission), 4e A record 185.199.111.153, AAAA

Décision SP2 (2026-07-09) : carte au clic — aucun appel aux tuiles CARTO sans action explicite ; bandeau non nécessaire.

Note : en project page GitHub (`vferries.github.io/escalire/`), robots.txt est servi sous /escalire/ et n'est pas lu par les crawlers (domaine racine requis) — il deviendra effectif à la bascule escalire.fr ; la protection réelle de /admin est la meta noindex (SP3).

## Runbook

Le déploiement est automatisé par le workflow GitHub Actions `.github/workflows/deploy.yml` (« Deploy to GitHub Pages »).

- **Déclencheurs** : push sur `main`, cron quotidien `0 4 * * *` (04:00 UTC — rebuild pour archiver les événements passés, spec S7), ou déclenchement manuel (`workflow_dispatch`).
- **Étapes** : `npm ci` → enrichissement ISBN (`tools/enrich-isbn.mjs` : BnF puis Google Books ; commit bot `[skip ci]` si des champs ont été remplis) → `npm test` → `npm run build` → publication de `dist/` sur GitHub Pages.
- Un ISBN introuvable produit une annotation *warning* sur le run (onglet Actions) et la fiche reste hors site jusqu'à correction dans l'admin — le build ne casse jamais pour ça.
- **Suivi des runs** : onglet Actions du dépôt — https://github.com/vferries/escalire/actions
- **Page en prod** : https://vferries.github.io/escalire/
- **Fichier du workflow** : https://github.com/vferries/escalire/blob/main/.github/workflows/deploy.yml
- GitHub désactive le cron des workflows après 60 jours sans activité sur un dépôt public — le réactiver depuis l'onglet Actions ; tout commit le réarme.

### Bascule DNS escalire.fr

État constaté le 2026-07-16 (zone OVH, NS `ns102.ovh.net`) :

| Enregistrement | Valeur actuelle | Rôle |
|---|---|---|
| `escalire.fr` A | `213.186.33.87` | ancien site (mutualisé OVH) — à remplacer |
| `www` CNAME | `escalire.fr.` | à repointer |
| MX | `mx1.ovh.net`, `mx2.ovh.net`, `mxb.ovh.net` | email OVH — **ne pas toucher** |
| TXT (SPF) | `v=spf1 include:mx.ovh.com ~all` | email — **ne pas toucher** |

L'email `contact@escalire.fr` est hébergé chez OVH via les MX ci-dessus : la bascule ne modifie que A/AAAA/CNAME web, l'email n'est pas impacté tant que MX et TXT restent en place.

Ordre des opérations :

1. **GitHub — vérifier le domaine** (anti-takeover) : profil → Settings → Pages → Verified domains → Add `escalire.fr` ; ajouter le TXT `_github-pages-challenge-vferries` fourni, dans la zone OVH.
2. **GitHub — déclarer le domaine** : repo `escalire` → Settings → Pages → Custom domain : `escalire.fr` → Save. (Déploiement via Actions : pas de fichier `CNAME` à commiter, le réglage Settings suffit.)
3. **OVH — zone DNS** (manager.ovh.com → Domaines → escalire.fr → Zone DNS) :
   - Remplacer le A de l'apex par les 4 IP GitHub Pages : `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` ; optionnel, AAAA : `2606:50c0:8000::153` à `2606:50c0:8003::153`.
   - Repointer le CNAME `www` vers `vferries.github.io.`
4. **Attendre la propagation** (`dig +short escalire.fr` doit renvoyer les IP 185.199.x), puis dans Settings → Pages : vérifier « DNS check successful » et cocher **Enforce HTTPS** dès que le certificat est émis (quelques minutes à ~1 h).
5. **Adapter le site** : dérouler la case « Bascule escalire.fr » de la checklist ci-dessus (`astro.config` `site: 'https://escalire.fr'` + `base: '/'`, `config.yml`, `ALLOWED_DOMAINS` du Worker OAuth, robots.txt/sitemap), merger → le déploiement suit.
6. **Vérifier** : page servie sur https://escalire.fr (l'ancienne URL `vferries.github.io/escalire/` redirige d'elle-même), admin fonctionnel (login OAuth), couvertures epagine OK, et **envoyer un mail test à `contact@escalire.fr`**.
7. **Redirections anciennes URLs** : GitHub Pages ne fait pas de 301 serveur — créer une page `public/MentionsLegales.html` avec meta refresh + `rel=canonical` vers `/mentions-legales/` (cf. checklist).

Rollback : remettre le A de l'apex sur `213.186.33.87` et le CNAME `www` sur `escalire.fr.` — l'ancien hébergement resservira le site dès expiration du TTL.

### Baseline Lighthouse

Mesure locale (`astro preview`, 2026-07-09) : a11y 1.00 / seo 1.00 / best-practices 1.00 / perf 0.88 — le score perf est pénalisé par le serveur de preview en HTTP/1.1 (en run non throttlé : perf 1.00, LCP ~40 ms). À re-tester sur https://vferries.github.io/escalire/ après merge, avant de cocher la case « Test Lighthouse » de la checklist ci-dessus.
