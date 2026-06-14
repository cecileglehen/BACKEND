# 🎯 Target — Retards de Launch & plan pour dépasser Bolt/Lovable/Base44

> Ce qui nous manque (retard), puis ce qu'on ajoute pour **passer devant**.
> Priorité : 🔴 critique · 🟠 important · 🟢 différenciateur

---

## A. NOS RETARDS (à combler)

### 🔴 1. Visual Edits (clic-to-edit) — *killer feature de Lovable*
**Manque** : on ne peut modifier l'UI que par prompt.
**Cible** : cliquer sur un élément dans la preview → poignées pour changer **texte, couleur, taille, espacement** en direct, **sans prompt ni crédits**.
**Comment** : injecter un petit agent dans l'iframe preview (postMessage) qui surligne l'élément survolé, renvoie son sélecteur/source map ; un panneau d'édition applique un `edit_file` ciblé (ou patch CSS inline) sans appeler le LLM pour les changements simples.

### ✅ 2. Auto-fix autonome des erreurs — **FAIT**
Quand le dev server WebContainer émet une erreur (compile/runtime), l'IDE la détecte
(patterns dans le flux terminal), débounce 1,5 s, et déclenche une **correction automatique**
via le flux d'édition (max 2 essais par erreur, reset quand l'app redevient saine).
Feedback dans le chat : « 🔧 Erreur détectée — correction automatique… » → « ✅ Correction appliquée ».

### 🔴 3. Intégrations dans les apps générées (Gmail, Slack, Calendar, Stripe…)
**Manque** : les apps Launch n'ont pas d'intégrations tierces. **Mais on a déjà Composio côté DELT** (Gmail, Drive, Calendar, Slack, Notion, GitHub…).
**Cible** : exposer un SDK `LaunchIntegrations` → l'app appelle des actions Composio (envoyer un mail, créer un event…) via le backend.
**Comment** : router les actions vers `/api/launch/:projectId/integrations/*` qui réutilise `lib/composio.js`. → **dépasse Base44** (on a déjà l'infra).

### 🟠 4. Realtime + logique backend custom (Edge Functions)
**Manque** : `LaunchDB` est du CRUD ; pas de temps réel ni de fonctions serveur custom.
**Cible** :
- `LaunchDB.subscribe("collection", cb)` (temps réel via SSE/WebSocket).
- `LaunchFn` : déclarer des fonctions serveur (ex. webhook, calcul) exécutées côté backend.

### 🟠 5. GitHub sync / export de code
**Manque** : seulement un export zip.
**Cible** : « Connecter GitHub » → push du projet dans un repo, sync bidirectionnel (au moins push one-way pour commencer).

### 🟠 6. Domaine custom pour l'app du user
**Manque** : on a `<slug>.deltai.fr` mais pas le domaine propre du créateur.
**Cible** : le créateur ajoute `monapp.com` → CNAME → on sert son site + SSL (via Render custom domains ou Cloudflare for SaaS).

### 🟠 7. Templates / starters
**Manque** : on part toujours de zéro.
**Cible** : galerie de templates (SaaS, dashboard, landing, blog, e-shop, kanban…) → clone + personnalisation.

### 🟢 8. Mobile — **React Native / Expo** (PAS Flutter)
**Note** : pas d'équivalent WebContainer pour Flutter (Dart nécessite une compilation cloud :
Zapp.run/DartPad compilent côté serveur). Comme on est déjà en React, la cible mobile =
**React Native + Expo** (Expo Snack : preview navigateur + device via QR), c'est aussi l'approche de Bolt.

### 🟢 9. Figma import
**Cible** : importer un design Figma → générer l'UI.

### 🟢 10. Analytics par app déployée
**Cible** : compteur de visites, events, conversions par `<slug>` (dashboard créateur).

### 🟢 11. Multiplayer / collab temps réel
**Cible** : plusieurs personnes éditent un projet en même temps.

### 🟢 12. Security scan
**Cible** : audit auto (clés exposées, RLS, deps vulnérables) avant déploiement.

---

## B. CE QUI NOUS FAIT PASSER DEVANT (différenciateurs à pousser)

1. **64+ modèles** — déjà acquis. À mettre en avant : « choisis Claude, GPT, Gemini, Llama… pour CHAQUE app ». Aucun concurrent ne fait ça.
2. **Images IA natives** (Flux) intégrées au pipeline — eux non. Pousser : génération de logo, hero, illustrations en un clic + matérialisées en fichiers.
3. **Intégrations Composio réutilisées** (20+ services déjà branchés sur DELT) → exposées aux apps = on bat Base44 sur son terrain.
4. **Plateforme IA complète derrière** (deep search, agents, RAG) → une app Launch peut appeler ces super-pouvoirs (`LaunchAI.search()`, `LaunchAI.ask()`).
5. **Stripe Connect propre** (1 compte/créateur) — déjà mieux que « par app ».
6. **Édition 2-étapes économe en tokens** — moins cher à l'usage que la concurrence.

---

## C. ROADMAP D'EXÉCUTION SUGGÉRÉE

| Phase | Contenu | Effort | Impact |
|---|---|---|---|
| **P1** | **UI/UX/responsive** de l'IDE (en cours) | Moyen | 🔥 perception produit |
| **P2** | **Auto-fix autonome** (boucle erreur→correction) | Faible | 🔥 fiabilité |
| **P3** | **Visual Edits** (clic-to-edit basique : texte/couleur) | Élevé | 🔥 killer feature |
| **P4** | **Intégrations Composio** dans les apps (`LaunchIntegrations`) | Moyen | 🔥 bat Base44 |
| **P5** | **Templates** + **LaunchAI** (search/ask depuis l'app) | Moyen | 🟢 |
| **P6** | **GitHub export** + **domaine custom** | Moyen | 🟢 |
| **P7** | Realtime/Edge, analytics, mobile, Figma | Élevé | 🟢 long terme |

---

## D. UI/UX — chantier immédiat (P1)
- **Responsive** : l'IDE 3 colonnes doit s'empiler proprement sur tablette/mobile (onglets Chat / Code / Preview).
- **Hiérarchie visuelle** : barre du haut épurée, statut WebContainer clair (booting/install/run/ready) avec barre de progression.
- **Composer** : toggle Code/Plan plus lisible, sélecteur de modèle avec logos, raccourcis.
- **File tree** : icônes par type, badges diff, section « médias » pour les images.
- **Empty state** : hero + exemples + « Mes projets » + (à venir) templates.
- **Micro-interactions** : transitions douces, skeleton pendant le boot, toasts.
- **Cohérence glassmorphism** avec le reste de DELT.
