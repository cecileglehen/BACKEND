# Delt AI — Handoff pour la prochaine IA

> Dernière mise à jour : 2026-05-24
> Repo : `cecileglehen/BACKEND` (monorepo client + server malgré le nom)
> Stack : Express Node ESM (server) + React/Vite (client) + Supabase (Postgres + pgvector + auth) + Render (backend) + Hostinger (frontend statique) + Cloudflare tunnel (DELT 33M)

---

## 🔧 Setup local (5 min)

```bash
git clone <repo>
cd DeltaAI
npm run install:all              # racine + server + client
# Copier server/.env.example → server/.env et remplir (au minimum) :
#   DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY, COMPOSIO_API_KEY,
#   PAYPAL_CLIENT_ID/SECRET, SERPER_API_KEY
npm run dev                      # lance server (port 3001) + client (port 5173)
```

**Build client + zip pour Hostinger** :
```bash
cd client && npm run build
cd dist && rm -f /Users/toma/Documents/DeltaAI/delt-ai-hostinger.zip && zip -rq /Users/toma/Documents/DeltaAI/delt-ai-hostinger.zip .
```

**Push backend (Render auto-deploy)** :
```bash
git add -A && git commit -m "..." && git push origin main
```

---

## ✅ Ce qui marche

### Chat multi-modèles
- ~18 providers (OpenAI, Anthropic, Google, Mistral, xAI, Perplexity, Meta, DeepSeek, Arcee, InclusionAI, Venice, Moonshot, Nova, Qwen, ByteDance, Suno, Flux, DELT)
- Tiers PICO/NANO/MINI/NORMAL/EXPERT/PRO + UNCENSORED/FREE
- Familles dans le popup "..." (GPT-5.5, Claude Haiku, Qwen Coder, etc.)
- Auto-routing par level (1-10) ou manuel
- Streaming SSE, abort propagation, retry/fallback chain
- Vision auto-swap, attachements (80+ types fichiers)
- Mobile responsive, scroll non-saccadé, URL persistante `?c=<convId>`

### Skills `%%`
- `%%write_file:X.ext ... %%end` → artifact téléchargeable + viewer side-panel (HTML iframe, MD, CSV table, JSON pretty, code highlighted)
- `%%generate_image:prompt %%end` → image générée via FLUX Schnell (5 Cr)
- `.pptx` : mode CODE uniquement (pptxgenjs JS exécutable, JSON/MD interdits)

### Deep Search v6
Pipeline : PLAN → SEARCH (cache 30min) → SCRAPE (cache 1h + content classify) → EMBED & GLOBAL RANK (pgvector cache) → CLUSTER → LLM RE-RANK → EXTRACT → MULTI-HOP (gap-based) → CROSS-REF → **AGGRESSIVE HOP** (si confidence<0.7) → DETECT VELOCITY → SCORE SOURCES (×typeMultiplier) → SCORE CLAIMS → BUILD REASONING GRAPH (SSE) → WEIGHTED SYNTHESIS
- 11 stages visibles dans l'UI (labels FR sans jargon)
- Section "🧠 Comment ça pense" repliable + chip confiance + badge velocity

### Composio (intégrations OAuth)
- 10 apps : Gmail, Drive, Calendar, Slack, Notion, GitHub, Linear, Trello, Discord, Stripe
- Page `/settings` → "Intégrations" : Connect/Disconnect par app
- Composer : bouton ⚙️ avec toggles par chat (anti "j'ai pas accès")
- Tool-calling loop (max 5 rounds) avant le streaming final
- POOR_TOOL_MODELS regex bloque les modèles FREE/Flash Lite qui hallucinent

### Modèle DELT 33M
- Page `/notre-modele` avec mini-chat live + bouton don PayPal (button ID `GNLL9DWV9ML56`)
- Routé via `delt/delt-33m` modelId → tunnel Cloudflare
- Pages `/thanks` (post-don) et `/goodbye` (annulation)

### Securité / Confidentialité
- Encryption messages **désactivée** par défaut (pas requise RGPD, ralentit la sync)
- Cache localStorage purgé au logout (prévient leak cross-user sur PC partagé)
- `?c=<convId>` 404 propre + redirect si conv pas à toi
- Date+heure (UTC Paris arrondie 10min) injectée dans tous system prompts (anti "nous sommes en 2024")

---

## 🧪 À tester / valider (priorité haute)

### 1. Composio Gmail tool-calling end-to-end
Render vient juste de re-déployer avec `@composio/openai` (provider Chat Completions) au lieu d'Agents SDK. Tester :
1. Settings → Gmail connecté ✓
2. Composer → ⚙️ → toggle Gmail ON
3. Modèle : **Claude Sonnet 4.5** (pas FREE)
4. *"Liste mes 3 derniers emails"* → vérifier chips 🔵 Gmail (pending) → 🟢 done → vraie réponse
5. Logs serveur Render : `[composio] N tools chargés...` doit apparaître

Si toujours pas de tool call → vérifier que le format `t.function.name` est bien passé à OpenRouter (peut nécessiter strip de champs custom).

### 2. PPTX mode code
Tester avec un prompt complexe :
*"Crée une présentation de 8 slides sur l'IA avec une slide cover, une stats avec forEach, une quote, et une conclusion"*

Vérifier que l'IA génère du **JS pptxgenjs** (pas JSON ni markdown) et que `downloadPptx` exécute sans erreur.

### 3. Multi-hop aggressif Deep Search
*"compare DeepSeek 20B vs Llama 3.1 8B en tokens/s"* → sujet ambigu/spécialisé → confidence initiale devrait être < 0.7 → tu dois voir dans logs `aggressiveHopUsed: true`.

---

## 🐛 Bugs / limitations connus

### Composio
- **userId pas retourné dans `connectedAccounts.list()`** — la liste globale ne précise pas l'owner. Notre table SQL `user_integrations` est notre source de vérité.
- **Tools format peut varier** entre versions du SDK. Si les tools ne sont pas reconnus par OpenRouter, vérifier `console.log(composioTools.slice(0,1))` côté server.
- **Pas tous les modèles supportent tools** : regex `POOR_TOOL_MODELS` actuelle dans `server/server.js` à ajuster au fil du temps.

### DELT 33M
- **Tunnel Cloudflare = précaire** : peut tomber sans warning. URL/key hardcodées dans :
  - `server/lib/openrouter.js` (DELT_INFERENCE_URL/KEY)
  - `client/src/pages/OurModelRoute.jsx` (DELT_URL/KEY pour le test live)
- Si tunnel change → MAJ aux 2 endroits + push backend + rebuild client.
- **Long terme** : déployer sur Modal/Replicate/HF Inference Endpoint.

### pgvector
- Table `embedding_cache` créée auto au boot **SI** extension `vector` activée dans Supabase.
- Vérifier : Supabase Dashboard → Database → Extensions → `vector` enabled.
- Si pas activé → fallback transparent (pas de cache, juste plus cher en embeddings).

### Mobile
- La barre BrandPills sous Composer est cachée `hidden sm:block` → user clique le bouton "auto" pour ouvrir le selector full-screen.
- Composer a un bouton "−/+ Masquer" pour replier les pills sur desktop aussi.

### Logos integrations
Logos couleur officiels présents : `gmail-color.png`, `googledrive-color.png`, `googlecalendar-color.png`, `slack-color.png`.

**Manquants** (le user envoie au fur et à mesure depuis `~/Downloads/`) :
- `notion-color.png` (Notion)
- `github-color.png` (GitHub)
- `linear-color.png` (Linear)
- `trello-color.png` (Trello)
- `discord-color.png` (Discord)
- `stripe-color.png` (Stripe)

Quand reçu : copier dans `client/public/brands/<app>-color.png` + ajouter dans `COLOR_LOGOS` de `client/src/components/IntegrationsPage.jsx` ET `INTEG_COLOR_LOGOS` de `client/src/components/Composer.jsx`. Rebuild client + push.

---

## 🚀 Roadmap features (par priorité)

### Court terme (1-2 semaines)
1. **Logos couleur restants** (voir ci-dessus)
2. **Tester tool-calling Composio en prod** + ajuster `POOR_TOOL_MODELS` selon résultats réels
3. **DELT 33M déploiement stable** (Modal ou HF Inference au lieu du tunnel Colab)
4. **GDPR — finitions** : email contact RGPD, ajouter Composio (USA) aux sous-traitants privacy policy, mention durées rétention

### Moyen terme (1-2 mois)
5. **Agent autonome multi-step** : planning → tool calls multiples → synthèse. La fondation est là (Composio tool-calling), à étendre en boucle agent avec décomposition de tâches.
6. **Sandbox JS pour code exec** : E2B ou Daytona pour exécuter du code arbitraire généré par l'IA (Niveau 3 de l'option qu'on a discutée).
7. **Embedding pour Mémoire** : migrer la mémoire utilisateur de SQL plain text vers pgvector + RAG (pertinence ×10).
8. **Mode preview public** : `/billing`, `/code`, `/studio` actuellement derrière AuthGate → Google indexe pas. Faire un mode preview "Connecte-toi pour utiliser".

### Long terme
9. **DELT 100M+** (training local user)
10. **Mobile app native** (le dossier `mobile/` existe — statut Flutter ?)
11. **API publique pricing** (déjà fonctionnelle, à promouvoir)

---

## 📂 Fichiers clés

### Backend
- `server/server.js` (~1900 lignes) — tous les endpoints REST + SSE
- `server/lib/openrouter.js` — wrapper LLM (streamChat, chatWithTools, callDeltModel)
- `server/lib/composio.js` — wrapper intégrations (OAuth + execute)
- `server/lib/deepSearch.js` — pipeline Deep Search v6 (623 lignes)
- `server/lib/embeddings.js` — text-embedding-3-small + pgvector cache + clustering
- `server/lib/llmRerank.js` — re-rank LLM batch
- `server/lib/sourceScoring.js` — scoring source quantitatif
- `server/lib/claimScoring.js` — scoring par claim + reportConfidence
- `server/lib/contentClassifier.js` — type detection (benchmark/paper/blog…)
- `server/lib/topicDetector.js` — vélocité du sujet (fast/normal/slow)
- `server/lib/skills.js` — parser %%write_file / %%generate_image
- `server/lib/conversations.js` — save/load convs (encryption legacy supportée)
- `server/lib/db.js` — schema SQL auto-créé au boot
- `server/config/models.js` — catalogue de tous les modèles + familles + image/vidéo/musique
- `server/skills/base.md` — system prompt skills (formats, %% syntax)

### Frontend
- `client/src/pages/ChatPage.jsx` (~800 lignes) — page principale chat
- `client/src/pages/OurModelRoute.jsx` — page DELT 33M
- `client/src/pages/IntroRoute.jsx` — onboarding post-abonnement
- `client/src/pages/ThanksRoute.jsx` / `GoodbyeRoute.jsx` — post-PayPal
- `client/src/components/Composer.jsx` — barre de saisie + ToolsButton (intégrations)
- `client/src/components/ChatMessage.jsx` — render messages + DeepSearchBlock + ArtifactCard + tool chips
- `client/src/components/ArtifactViewer.jsx` — side-panel preview/code/download
- `client/src/components/BrandPills.jsx` — sélecteur de modèles (familles)
- `client/src/components/IntegrationsPage.jsx` — Settings → Intégrations
- `client/src/components/SettingsPage.jsx` — toutes les sections settings
- `client/src/hooks/useChatStream.js` — gestion stream chat + tool events
- `client/src/hooks/useHistory.js` — conversations local + sync server
- `client/src/lib/api.js` — wrapper REST + SSE
- `client/src/lib/pptxBuilder.js` — gen PowerPoint via pptxgenjs (mode code uniquement)
- `client/public/sitemap.xml` + `robots.txt` — SEO

### Skills markdowns
- `server/skills/base.md` — comportement IA pour les commandes %%
- `server/skills/models.md` — catalogue image gen (référence interne IA)

---

## 🔑 Env vars requises (Render + local)

```
# Database
DATABASE_URL=postgresql://postgres.xxx:PASS@aws-1-eu-north-1.pooler.supabase.com:5432/postgres
JWT_SECRET=<long random>
MESSAGE_ENCRYPTION_KEY=<32 chars>   # legacy, gardé pour décrypter anciennes convs

# LLM
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...                 # fallback

# Web search
SERPER_API_KEY=...                   # pour Deep Search

# Paiement
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_PLAN_BASIC=P-...
PAYPAL_PLAN_PLUS=P-...
PAYPAL_PLAN_PRO=P-...
PAYPAL_PLAN_ULTRA=P-...

# Intégrations
COMPOSIO_API_KEY=ak_TEvfYUBA-SeCSoPCaj3E

# DELT 33M (optionnel, hardcoded en fallback)
DELT_INFERENCE_URL=https://bathroom-ultram-usd-offering.trycloudflare.com
DELT_INFERENCE_KEY=myDMpvoCuw1ePElUrbqapiB7sXPfShWGfrSh5WdaSpM

# Génération média
FAL_API_KEY=...                      # FLUX, Seedance
SUNO_API_KEY=...                     # musique
```

---

## 📜 Conventions

- **Commits** : français bref avec Co-Authored-By Claude
- **Branches** : main only (push direct, pas de PR)
- **Style** : pas de TypeScript côté server (JS ESM pur). React JSX côté client.
- **Tests** : aucun. Validation manuelle dans le browser après chaque push.
- **Logs** : `console.log` pour debug, `console.warn` pour erreurs non-fatales, `console.error` pour fatales

---

## 🆘 Si Render crash au boot

1. Logs : `[composio] ...` `[deepsearch] ...` `⚠ ...` te diront où ça plante
2. Le crash le plus courant : env var manquante (cf. liste ci-dessus)
3. La table `embedding_cache` peut échouer si pgvector pas activé → fallback silencieux OK
4. Si erreur d'install npm → vérifier `--legacy-peer-deps` n'est plus nécessaire (composio-openai-agents retiré)

---

## 💬 Communication user

L'utilisateur (Toma) est **non-technique mais ambitieux** :
- Préfère les fixes rapides aux explications longues
- Veut souvent voir le résultat avant comprendre le pourquoi
- Donne souvent des specs partielles → demander clarification si scope ambigu
- Aime quand on push + build + zip en une commande
- Préfère le français
- Critique constructive bienvenue : il challenge volontiers les choix techniques

**Workflow type** :
1. Toma décrit une feature/un bug
2. IA pose 1-2 questions si nécessaire
3. IA code + commit + push + build/zip dans la même session
4. Toma teste, retourne feedback
5. Itération rapide jusqu'à OK
