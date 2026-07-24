---
name: html-css-js
description: Créer un site ou une app en HTML/CSS/JS vanilla (sans framework). À utiliser dès que l'utilisateur demande du HTML, CSS, JavaScript pur, une landing page statique ou "sans framework".
triggers: html, css, javascript, js vanilla, vanilla, site statique, landing, page web, /html.?css/
---
# Skill : HTML / CSS / JS vanilla

## Structure de fichiers
- `index.html` + `styles.css` + `app.js` séparés (jamais tout inline sauf demande).
- `<head>` complet : charset, viewport, title descriptif, meta description.
- HTML sémantique : `header/nav/main/section/footer`, UN seul `<h1>`, hiérarchie h2→h3 stricte.

## CSS moderne (obligatoire)
- Variables CSS en `:root` : couleurs, rayons, ombres — JAMAIS de couleurs en dur répétées.
- Layout : `display:grid` pour les grilles, `flex` pour les alignements. Pas de float.
- Responsive SANS media queries quand possible : `clamp()` pour les tailles de police
  (`font-size: clamp(1.8rem, 4vw, 3rem)`), `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`.
- Espacements cohérents : échelle 4/8/12/16/24/32/48/64px.
- `max-width: 1100px; margin-inline: auto; padding-inline: 20px` pour les conteneurs.

## JS propre
- `defer` sur le script, pas de `document.write`, pas de `var`.
- Délégation d'événements sur les listes, `querySelector` ciblés.
- État simple dans un objet + fonctions `render()` — pas de manipulation DOM éparpillée.
- localStorage pour persister (try/catch autour de JSON.parse).

## Accessibilité (non négociable)
- Contraste ≥ 4.5:1, `alt` sur toute image, `aria-label` sur les boutons-icônes,
  focus visible (`:focus-visible { outline: 2px solid … }`), navigation clavier.

## Pièges à éviter
- Images : toujours `width/height` ou `aspect-ratio` (pas de layout shift).
- `box-sizing: border-box` global. `scroll-behavior: smooth` sur html.
