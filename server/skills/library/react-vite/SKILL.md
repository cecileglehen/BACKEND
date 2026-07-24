---
name: react-vite
description: Créer ou modifier une app React (Vite). À utiliser pour toute demande React, composants, hooks, SPA.
triggers: react, composant, jsx, hook, useState, useEffect, spa, vite
---
# Skill : React + Vite

## Structure
- `src/App.jsx` = orchestration ; composants dans `src/components/<Nom>.jsx` (PascalCase, 1 composant/fichier).
- Props destructurées avec défauts ; état local via `useState`, dérivés calculés SANS useEffect.

## Règles hooks
- JAMAIS de setState dans le corps du rendu. Deps d'useEffect complètes.
- `useEffect` UNIQUEMENT pour synchroniser avec l'extérieur (fetch, listeners, timers) — cleanup systématique (return).
- Listes : `key` stable (id), jamais l'index si la liste bouge.

## Patterns
- Fetch : état `{ data, loading, error }`, AbortController au cleanup.
- Formulaires contrôlés ; `onSubmit` avec `e.preventDefault()`.
- Conditionnels : early return pour loading/error, pas de ternaires imbriqués.
- Context seulement si ≥3 niveaux de prop drilling.

## Performance
- Pas de useMemo/useCallback par défaut — seulement si liste lourde ou prop de memo().
- Images/onglets lourds : `lazy()` + `<Suspense>`.
