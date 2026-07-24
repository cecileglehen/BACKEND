---
name: tailwind
description: Styler avec Tailwind CSS. À utiliser quand le projet utilise Tailwind ou que l'utilisateur le demande.
triggers: tailwind, tw, utility, classe utilitaire
---
# Skill : Tailwind CSS

## Règles
- Mobile-first : classes de base = mobile, préfixes `sm: md: lg:` pour élargir.
- Espacement cohérent : s'en tenir à 2/3/4/6/8/12/16 — pas de valeurs arbitraires `[13px]` sauf nécessité.
- Couleurs : UNE couleur d'accent + gamme neutre (slate/zinc). Texte `text-slate-900`, secondaire `text-slate-500`.
- Cartes : `rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`.
- CTA : `rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 transition`.
- Éviter la soupe : extraire en composant dès qu'une combinaison se répète 2+ fois.
- Dark mode : `dark:` seulement si demandé.

## Layout
- Page : `min-h-screen bg-slate-50` ; conteneur `mx-auto max-w-5xl px-5`.
- Grilles : `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`.
- `flex items-center justify-between` pour les barres.
