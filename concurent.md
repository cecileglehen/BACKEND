# 🥊 Analyse concurrentielle — Launch vs Bolt.new / Lovable / Base44

> Objectif : faire de **Launch** (launch.deltai.fr) un produit supérieur aux 3 leaders du « vibe coding ».
> Sources : docs & reviews 2026 (liens en bas).

---

## 1. Bolt.new (StackBlitz)

**Positionnement** : IDE full-stack dans le navigateur (WebContainers), orienté développeurs/prototypage rapide.

| Fonction | Détail |
|---|---|
| Exécution | **WebContainers** : Node tourne 100 % in-browser, preview instantanée |
| Agent mode | L'IA **planifie, itère, corrige** seule ; choix de modèles (light/deep, Opus 4.6) |
| **Diffs view** | Montre précisément ce qui a changé entre 2 générations |
| **Discussion mode** | Discuter sans générer de code (économise le budget) |
| Auto-fix | Détecte les erreurs de build et propose/applique des correctifs dans le chat |
| Déploiement | 1-clic → URL live + **SSL** + **domaine custom** (plans payants), sous-domaine Bolt |
| Backend | **Supabase** (DB, auth, storage) + Bolt Cloud |
| **Figma import** | Importe des designs Figma → génère le code |
| **Mobile** | Cibles **Expo** (iOS/Android), preview device |
| Intégrations | GitHub (sync/backup), Supabase, Figma, Netlify/Vercel/Cloudflare |

**Forces** : exécution réelle in-browser, agentique, import Figma, mobile.
**Faiblesses** : orienté dev (moins « no-code »), coûteux en tokens, backend = setup externe.

---

## 2. Lovable.dev

**Positionnement** : prompt-to-app pour fondateurs/designers, le plus « produit ».

| Fonction | Détail |
|---|---|
| **Agent mode** | Dév autonome : exploration du codebase, debug proactif, **web search temps réel** |
| **Chat mode** | Planification/stratégie, raisonnement multi-étapes |
| **Visual Edits** | Interface **façon Figma** : clic sur un élément → modifie couleur/layout/texte **sans prompt et sans consommer de crédits** (étendu en 2026 aux contenus liés à la DB) |
| **GitHub sync** | Bidirectionnel, code ownership total, eject/self-host |
| Backend | **Supabase natif** : DB (tables auto), auth (email + social), storage, **realtime**, **Edge Functions** |
| **Stripe natif** | Génère Edge Functions + tables + UI à partir d'un prompt |
| Déploiement | 1-clic + **Vercel** + domaine custom |
| Sécurité | **Security scan** |
| Collab | **Multiplayer** |

**Forces** : Visual Edits (killer feature), GitHub bidirectionnel, Supabase complet (realtime + edge functions), UX la plus léchée.
**Faiblesses** : dépend de Supabase, modèles limités.

---

## 3. Base44 (Wix)

**Positionnement** : no-code full-managé, le plus « tout-en-un sans config ».

| Fonction | Détail |
|---|---|
| Backend | **DB + auth + storage 100 % auto**, CRUD/filtre/tri, data models |
| **Intégrations (20+)** | Gmail, Google Calendar, Slack, **Stripe**, SMS, email, Drive, **Salesforce**, **Zapier**, APIs externes |
| **AI Agents** | Agents qui **cherchent le web, déclenchent des fonctions, gèrent la data, adoptent des personas** |
| **Discussion mode** | Prototyper en discutant, puis générer pages/flows/logique |
| Workflows | Automatisations, email, SMS |
| Analytics | Tableau de bord par app |
| Hosting | Instantané, domaine custom |
| Dev | GitHub, config avancée |
| Collab | Temps réel multi-users |

**Forces** : zéro config, 20+ intégrations natives, agents, workflows, analytics.
**Faiblesses** : moins de contrôle sur le code, pas d'exécution in-browser type WebContainer.

---

## 4. Tableau récapitulatif

| Capacité | Bolt | Lovable | Base44 | **Launch (nous)** |
|---|:--:|:--:|:--:|:--:|
| Preview live in-browser (WebContainer) | ✅ | ✅ | ⚠️ | ✅ |
| Édition ciblée / diffs | ✅ | ✅ | ⚠️ | ✅ |
| Mode discussion/plan | ✅ | ✅ | ✅ | ✅ |
| Auto-fix erreurs | ✅ (auto) | ✅ (auto) | ✅ | ⚠️ (bouton) |
| Auth managée | ⚠️ | ✅ | ✅ | ✅ |
| DB managée | ⚠️ | ✅ | ✅ | ✅ |
| Paiements (Stripe) | ⚠️ | ✅ | ✅ | ✅ (Connect) |
| Images IA | ⚠️ | ⚠️ | ⚠️ | ✅ (Flux + upload) |
| Déploiement + SSL + sous-domaine | ✅ | ✅ | ✅ | ✅ (`<slug>.deltai.fr`) |
| **Visual Edits (clic-to-edit)** | ❌ | ✅ | ⚠️ | ❌ |
| **GitHub sync bidirectionnel** | ✅ | ✅ | ✅ | ❌ |
| **Figma import** | ✅ | ⚠️ | ❌ | ❌ |
| **Intégrations (Gmail/Slack/…)** | ⚠️ | ⚠️ | ✅ (20+) | ❌ (mais Composio dispo côté DELT) |
| **Realtime / Edge functions** | ⚠️ | ✅ | ⚠️ | ❌ |
| **Mobile / Expo** | ✅ | ⚠️ | ❌ | ❌ |
| **Domaine custom (app du user)** | ✅ | ✅ | ✅ | ❌ |
| **Agent autonome multi-étapes** | ✅ | ✅ | ✅ | ⚠️ |
| **Choix de modèles** | ~3 | ~peu | ~peu | ✅ **64+** |
| **Analytics par app** | ⚠️ | ⚠️ | ✅ | ❌ |
| Templates / starters | ✅ | ✅ | ✅ | ❌ |
| Multiplayer | ❌ | ✅ | ✅ | ❌ |

✅ fort · ⚠️ partiel/externe · ❌ absent

---

## 5. Nos avantages déjà acquis
- **64+ modèles** sélectionnables (vs ~3 chez eux) — gros différenciateur.
- **Stripe Connect : 1 onboarding par créateur**, réutilisé sur tous ses projets (plus propre que « par app »).
- **Images Flux intégrées** (génération + upload + drag&drop + matérialisation en fichiers).
- **Édition fiable en 2 étapes** (pick files → edit_file) : moins de tokens, pas de full-rewrite.
- **Plateforme IA complète derrière** (deltai.fr : Composio, deep search, agents, etc.) — réutilisable.

---

## Sources
- Bolt : [Capacity guide](https://capacity.so/blog/what-is-bolt-new) · [Figma integration](https://support.bolt.new/integrations/figma) · [Bolt V2 mobile test](https://dev.to/aaronksaunders/can-ai-really-build-a-full-stack-mobile-app-a-brutally-honest-test-of-boltnew-v2-4ipp)
- Lovable : [Best vibe coding 2026](https://lovable.dev/guides/best-vibe-coding-tools-2026-build-apps-chatting) · [Bolt vs Replit vs Lovable](https://lovable.dev/guides/bolt-vs-replit-vs-lovable) · [Lovable for designers](https://muz.li/blog/lovable-for-designers-the-complete-guide-to-building-apps-with-ai-2026/)
- Base44 : [No Code MBA guide](https://www.nocode.mba/articles/base44-ultimate-guide) · [AIxploria review](https://www.aixploria.com/en/base44-ai/) · [WaveSpeed](https://wavespeed.ai/blog/posts/what-is-base44-is-it-worth-trying-in-2026/)
