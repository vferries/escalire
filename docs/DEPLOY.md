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
- [ ] Redirections 301 depuis les anciennes URLs de escalire.fr (au minimum `/MentionsLegales.html`)
- [ ] Mentions légales reprises du site actuel
- [ ] Meta locales + schema.org BookStore + sitemap + robots.txt
- [x] Déclaration RGPD minimale : la carte charge des tuiles CARTO (IP transmise) — bandeau simple ou tuiles proxifiées ; pas d'analytics ou analytics sans cookie (Plausible)
- [ ] Test Lighthouse mobile > 90 perf / 100 a11y sur la page
- [ ] Vérifier l'affichage des couvertures epagine depuis le domaine de prod
- [ ] Bascule escalire.fr : régénérer `robots.txt` (Disallow: /admin/) et `sitemap.xml` (URLs racine), ajuster `site`/`base` dans `astro.config`, mettre à jour `site_url`/`display_url` dans `public/admin/config.yml` et ajouter `escalire.fr` à `ALLOWED_DOMAINS` du Worker OAuth (cf. ADMIN-SETUP.md § 8)

Décision SP2 (2026-07-09) : carte au clic — aucun appel aux tuiles CARTO sans action explicite ; bandeau non nécessaire.

Note : en project page GitHub (`vferries.github.io/escalire/`), robots.txt est servi sous /escalire/ et n'est pas lu par les crawlers (domaine racine requis) — il deviendra effectif à la bascule escalire.fr ; la protection réelle de /admin est la meta noindex (SP3).

## Runbook

Le déploiement est automatisé par le workflow GitHub Actions `.github/workflows/deploy.yml` (« Deploy to GitHub Pages »).

- **Déclencheurs** : push sur `main`, cron quotidien `0 4 * * *` (04:00 UTC — rebuild pour archiver les événements passés, spec S7), ou déclenchement manuel (`workflow_dispatch`).
- **Étapes** : `npm ci` → `npm test` → `npm run build` → publication de `dist/` sur GitHub Pages.
- **Suivi des runs** : onglet Actions du dépôt — https://github.com/vferries/escalire/actions
- **Page en prod** : https://vferries.github.io/escalire/
- **Fichier du workflow** : https://github.com/vferries/escalire/blob/main/.github/workflows/deploy.yml
- GitHub désactive le cron des workflows après 60 jours sans activité sur un dépôt public — le réactiver depuis l'onglet Actions ; tout commit le réarme.

### Baseline Lighthouse

Mesure locale (`astro preview`, 2026-07-09) : a11y 1.00 / seo 1.00 / best-practices 1.00 / perf 0.88 — le score perf est pénalisé par le serveur de preview en HTTP/1.1 (en run non throttlé : perf 1.00, LCP ~40 ms). À re-tester sur https://vferries.github.io/escalire/ après merge, avant de cocher la case « Test Lighthouse » de la checklist ci-dessus.
