# Encres vivantes « ink on paper » — design

Date: 2026-07-11 · Statut: implémenté — formes validées par Vincent sur planche
contact, puis câblé le jour même. Périmètre élargi en cours de route : les splats
de CoupsDeCoeur et Equipe (oubliés du périmètre initial) sont traités aussi.

## Problème

Vincent : « Dernier truc que je voulais regarder c'est les "tâches d'encre". Dans
l'idée, j'avais quelque chose comme https://oneshot-sakura.vercel.app/ en tête. Pas
une tache statique. Plutôt des effets d'encre sur papier. » Et sur les assets :
« les formes de splat actuelles ne sont pas convaincantes » — la divergence d'assets
vs la maquette est donc demandée par Vincent (règle CLAUDE.md satisfaite).

La référence sakura obtient ses effets d'encre avec une vidéo qui « se peint »
(hero), des vidéos scrubbées au scroll (GSAP) et un grain de papier. Hors budget
perf/assets pour Escalire — on vise le même ressenti avec des masques précalculés.

## Décisions (questions/réponses)

- Comportement : **éclosion à l'apparition + vie lente ensuite**.
- Périmètre : **toutes les encres actuelles** — splats Librairie et Rencontres,
  accent du hero, et les 2 halos `inkDrift` du hero remplacés par de grandes
  aquarelles diluées du même système.
- Approche : **C — séquences de masques précalculées** (les A/B rejetées : A gardait
  les PNG actuels jugés non convaincants, B perdait le pipeline masque+couleur et
  repeint en continu).

## Architecture

### Génération (build, hors runtime) — `tools/gen-ink.mjs`

Sans dépendance (PNG écrit à la main via `node:zlib`). PRNG seedé (mulberry32) →
sortie reproductible, committée dans `public/assets/`.

Modèle de tache procédurale :

- Contour polaire `R(θ, t)` : rayon de base en `√t` (imbibition type Washburn) ×
  bruit périodique en θ (harmoniques 2–24, amplitude en 1/k^α) ;
- vitesse d'avance par angle irrégulière (le bord « rampe ») ;
- doigts capillaires : bosses gaussiennes étroites à des angles épars, longueur
  croissant plus vite que la base, activation progressive ;
- micro-gouttes satellites au-delà du bord (apparition aux frames tardives),
  légèrement allongées radialement ;
- croissance monotone garantie : `frame i ⊆ frame i+1` (l'encre ne recule jamais) ;
- rendu supersamplé ×2 puis réduit (bords nets antialiasés), blanc-sur-alpha,
  léger moutonnement d'alpha interne (0.92–1) pour l'effet lavis.

Espèces (presets) : `wash` (hero, grand, rond, doux, sans satellites), `splat`
(énergique, doigts marqués, 4–7 satellites — Librairie/Rencontres), `accent`
(petit, 2–3 satellites). Chaque espèce = **un sprite vertical de 10 frames**
(~768×7680), plusieurs graines par espèce pour varier les sections.

### Runtime — masque sprite + steps()

Chaque tache est un div `background-color` (couleur de la section) masqué par le
sprite : `mask-size: 100% 1000%` ; l'éclosion anime `mask-position` de la frame 0
à la frame 9 en `steps(9, jump-none)` (~1,4 s), déclenchée par le système
IntersectionObserver existant (nouveau type `data-reveal="ink-bloom"`, one-shot).
Un seul asset, un seul décodage, zéro filtre au runtime.

Vie lente ensuite : respiration scale/rotation/opacité très lente et déphasée
(transforms/opacité uniquement — compositeur), 2 couches superposées pour les
grandes aquarelles du hero (profondeur liquide), désactivée en
`prefers-reduced-motion`. En « discret » : pas d'éclosion, frame finale directe.

## Validation

- Planche contact des formes candidates (rendu navy sur papier) montrée à Vincent
  AVANT tout câblage — gate explicite.
- Tests (style du repo) : invariants du générateur (déterminisme à graine fixée,
  croissance monotone, dimensions/validité PNG du sprite) — pas d'assertions
  esthétiques ; golden checks CSS/JS (steps(), ink-bloom, sprites référencés).
- Vérification visuelle navigateur (éclosion, vie lente, discret).
