---
name: animations
description: Animations et micro-interactions (CSS, scroll, hover). À utiliser pour "animé", "animation", "effet", "transition", "wow".
triggers: animation, animé, transition, effet, hover, scroll, parallax, micro-interaction
---
# Skill : Animations

## Règles d'or
- Animer UNIQUEMENT transform et opacity (compositor). Jamais width/height/top/left.
- Durées : micro-interactions 150-250ms, entrées 300-500ms. Easing `cubic-bezier(0.16,1,0.3,1)`.
- `@media (prefers-reduced-motion: reduce)` → désactiver les animations décoratives.

## Patterns prêts
- Apparition au scroll : IntersectionObserver qui ajoute `.visible`
  (`opacity:0; transform:translateY(16px); transition:.5s` → `.visible{opacity:1;transform:none}`), `threshold:.15`, unobserve après.
- Stagger : `transition-delay: calc(var(--i) * 60ms)` avec `--i` par item.
- Hover carte : `transform: translateY(-3px); box-shadow +` en 200ms.
- Boutons : `active:scale-[0.97]`.
- Skeleton : gradient animé `background-position` (keyframes shimmer).
