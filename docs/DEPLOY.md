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
- [ ] Déclaration RGPD minimale : la carte charge des tuiles CARTO (IP transmise) — bandeau simple ou tuiles proxifiées ; pas d'analytics ou analytics sans cookie (Plausible)
- [ ] Test Lighthouse mobile > 90 perf / 100 a11y sur la page
- [ ] Vérifier l'affichage des couvertures epagine depuis le domaine de prod
