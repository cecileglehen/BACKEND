---
name: images-ia
description: Intégrer des images générées par IA dans une app Launch (illustrations, héros, logos). À utiliser pour "image", "illustration", "logo", "photo", "visuel".
triggers: image, illustration, logo, photo, visuel, hero, bannière, icône
---
# Skill : Images IA (Launch)

## Endpoint intégré (aucune clé requise)
```html
<img src="${PUBLIC_API}/api/launch/img?prompt=modern%20minimal%20workspace%2C%20soft%20light"
     alt="Espace de travail" width="800" height="500" loading="lazy" />
```
- Prompt EN ANGLAIS, précis : sujet + style + lumière ("flat illustration, pastel colors, soft shadows").
- TOUJOURS width/height (anti layout-shift) + alt descriptif.
- Cache serveur par prompt : même prompt = même image (stable entre rechargements).
- Héros : précharger (fetchpriority="high", pas de lazy). Vignettes : lazy.
- Ne pas générer plus de ~6 images par page (budget + vitesse).
