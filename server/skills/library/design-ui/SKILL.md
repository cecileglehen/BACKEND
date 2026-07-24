---
name: design-ui
description: Direction artistique et qualité visuelle d'une interface (landing, dashboard, app). À utiliser pour "beau", "moderne", "design", "pro", "premium", refonte UI.
triggers: design, beau, moderne, premium, élégant, ui, ux, interface, da, refonte, /landing.?page/
---
# Skill : Design UI premium

## Principes (style ChatGPT/Linear/Stripe)
- UNE police (Inter/system-ui), 3 graisses max. Titres : bold/extrabold + letter-spacing négatif (-0.02em).
- Fond blanc cassé chaud (#fafaf9) ou blanc ; texte #0f172a ; secondaire #64748b.
- UNE couleur d'accent maximum, utilisée avec parcimonie (liens, badges, focus).
- CTA principal : bouton NOIR pill (#0f172a, radius 9999px) — pas de dégradés criards.
- Beaucoup d'air : sections py-80px+, marges généreuses, max-width 1100px.
- Bordures subtiles #e2e8f0 plutôt que des ombres lourdes ; ombre = `0 1px 3px rgba(0,0,0,.08)`.

## Landing page (ordre)
1. Nav sticky translucide (backdrop-blur) : logo + 1 CTA.
2. Hero : titre 3-4rem qui vend le BÉNÉFICE, sous-titre gris, CTA noir, preuve sociale (logos).
3. Features en grille de cartes (icône + titre + 2 lignes).
4. Section preuve (chiffres, témoignages).
5. Pricing simple (3 plans, celui du milieu mis en avant, fond noir).
6. CTA final + footer sobre.

## Interdits
- Emojis dans l'UI (icônes SVG inline uniquement), Comic Sans, plus de 2 couleurs vives,
  texte gris clair sur blanc (< 4.5:1), 36 tailles de police différentes.


## Ajouter un élément à un site existant (OBLIGATION)
Un élément ajouté sans le style du site casse toute la page. TOUJOURS :
1. Relire le CSS existant AVANT d'écrire le JSX : repérer les variables (`--couleur`, radius, espacements), les classes utilitaires, la typo.
2. Réutiliser les classes existantes si elles conviennent (`.btn`, `.card`, `.section`…).
3. Nouvelle classe → ses règles CSS dans la MÊME réponse, construites avec les MÊMES valeurs que le reste (copier les couleurs/radius/ombres du CSS existant, jamais une nouvelle palette).
4. Vérifier le rendu responsive de l'élément ajouté comme du reste.
