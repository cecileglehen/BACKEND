# ⚡ DELT AI

> **The French multi-model AI platform** — one subscription, 64+ frontier models, intelligent routing, an agentic app builder (Launch), background AI agents, a creative studio, and a full Flutter mobile app. Live at **[deltai.fr](https://deltai.fr)** · **[launch.deltai.fr](https://launch.deltai.fr)**.

Direct competitor to Mammouth AI and Poe: one place to talk to GPT-5.6, Claude Fable 5, Gemini, Grok, Mistral, DeepSeek, Qwen, Llama… DELT picks the right engine for each request, bills real usage through a transparent credit system, and encrypts every conversation at rest.

---

## 🏆 OpenAI Build Week — How Codex & GPT-5.6 were used

**GPT-5.6 Sol is both the tool this project was built with, and a core engine inside the product.**

### 1. GPT-5.6 Sol as the development copilot

The vast majority of this codebase was designed and written in pair-programming sessions with **ChatGPT running GPT-5.6 Sol**:

- **Architecture & infrastructure**: the Express ESM backend layout, the Postgres/Supabase schema (encrypted conversations with per-user AES-256-GCM keys, Row Level Security), the SSE streaming protocol (deltas, thinking, tool calls, artifacts, todo lists), the OpenRouter execution layer with automatic fallbacks and 402-retry logic — all iterated with GPT-5.6 Sol.
- **The agentic "Launch" builder** (our Lovable-style app generator): the multi-step Plan → Act → Verify loop, the skills system (progressive-disclosure runbooks matched per request), the WebContainers live preview with COOP/COEP isolation, and the server-side guards (orphan-CSS detection, anti-deflection retry loop) were designed through long GPT-5.6 Sol reasoning sessions.
- **Debugging in production**: streaming edge cases, Google OAuth vs cross-origin isolation conflicts, Stripe webhook reconciliation — GPT-5.6 Sol was the main debugging partner.
- The **Flutter mobile app** (full parity with the web product, iOS + Android) was also built with GPT-5.6 assistance.

### 2. GPT-5.6 inside the product

DELT AI ships the **full GPT-5.6 family** to end users, in production:

| Model | Role in DELT |
|---|---|
| `openai/gpt-5.6-sol` | **EXPERT tier** — top of the intelligent routing, complex reasoning & Deep Search |
| `openai/gpt-5.6-terra` | Balanced chat tier + Launch **Builder** fallback (400k context, vision) |
| `openai/gpt-5.6-luna` | **Prototype profile** of Launch + fast chat tier (400k context, vision) |

The model picker exposes GPT-5.6 as an expandable family (Sol / Terra / Luna), and the cost-based credit system prices each tier on real usage. In short: **GPT-5.6 built the factory, and now GPT-5.6 runs it** — from expert chat routing to Launch's Prototype profile, the GPT-5.6 family serves real users in production.

---

## 🔑 Try it — test account for judges

| | |
|---|---|
| **URL** | **[https://deltai.fr](https://deltai.fr)** (Launch: [https://launch.deltai.fr](https://launch.deltai.fr)) |
| **Email** | `devpost.openai@test.com` |
| **Password** | *provided in the Devpost submission* |

---

## Table of contents

1. [Product surfaces](#product-surfaces)
2. [Architecture](#architecture)
3. [Launch — the agentic app builder](#launch--the-agentic-app-builder)
4. [The skills system](#the-skills-system)
5. [Intelligent routing & model catalog](#intelligent-routing--model-catalog)
6. [Deep Search & background agents](#deep-search--background-agents)
7. [Security & privacy](#security--privacy)
8. [Billing — cost-based credits](#billing--cost-based-credits)
9. [Mobile app (Flutter)](#mobile-app-flutter)
10. [Project structure](#project-structure)
11. [Running locally](#running-locally)
12. [Environment variables](#environment-variables)

---

## Product surfaces

| Surface | What it does |
|---|---|
| **💬 Chat** (deltai.fr) | Multi-model chat with intelligent routing, brand-locked conversations, SSE streaming of answers *and* reasoning ("thinking"), file attachments (PDF, images), web search, live artifacts (code files stream into clickable cards as they're written), generated file downloads |
| **🔎 Deep Search** | Agentic multi-step research: query decomposition, parallel web search (Serper), source scoring, claim verification, LLM reranking, streamed step-by-step progress |
| **🤖 Agents** | User-created background agents that run missions autonomously (Plan → Act → Verify → Deliver) with web access, polled from the UI |
| **🎨 Studio** | Image generation (Gemini Nano Banana family via fal.ai), user-imported reference images in the prompt bar, generation history gallery, music generation (Suno) |
| **🚀 Launch** (launch.deltai.fr) | The agentic app builder — see [below](#launch--the-agentic-app-builder) |
| **📱 Mobile** | Full Flutter app (Android + iOS) mirroring the web product — same model picker, brand lock, studio, deep search, SSE thinking stream |
| **🔌 API** | Per-user API keys to consume DELT models programmatically |

---

## Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │              React 18 + Vite + Tailwind      │
                    │   deltai.fr        launch.deltai.fr          │
                    │   (chat, studio,   (Launch IDE, WebContainer │
                    │    agents, deep     live preview, visual     │
                    │    search)          edits, deploy)           │
                    └────────────┬─────────────────────────────────┘
                                 │ SSE streams + REST
                    ┌────────────▼─────────────────────────────────┐
                    │        Node.js + Express (ESM)               │
                    │                                              │
                    │  router.js ──── Groq (Llama 4 Scout) triage  │
                    │  openrouter.js ─ execution, fallbacks,       │
                    │                  402-retry, reasoning stream │
                    │  codegen.js ──── Launch agentic loop         │
                    │  skillEngine.js─ skills registry & matching  │
                    │  deepSearch.js ─ multi-step research agent   │
                    │  agentRuns.js ── background missions         │
                    │  cryptoBox.js ── AES-256-GCM per-user keys   │
                    │  launchPay.js ── Stripe Connect + webhook    │
                    │                  reconciliation sweep        │
                    │  launchIntegrations.js ─ Notion auto-        │
                    │                  provisioning (Composio)     │
                    └────────────┬─────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────────┐
          │                      │                          │
   ┌──────▼──────┐   ┌───────────▼───────────┐   ┌──────────▼─────────┐
   │  Postgres    │   │  OpenRouter / Groq /  │   │  Stripe · PayPal · │
   │  (Supabase)  │   │  fal.ai / Suno /      │   │  Composio (Notion) │
   │  RLS + AES   │   │  Serper               │   │  Google OAuth      │
   └─────────────┘   └───────────────────────┘   └────────────────────┘
```

**Everything streams.** The SSE protocol carries typed events: `meta`, `delta`, `thinking`, `websearch`, `artifact`, `image`, `tool_call`/`tool_result`, `skill`, `todo_list`, `todo_state`, `status`, `action`, `file`, `done`, `error`. The UI renders each one live — users watch files being written line by line, see which skill the AI is reading, and watch the agent tick off its own todo list.

---

## Launch — the agentic app builder

Launch is DELT's answer to Lovable / Base44: describe an app in French, watch it get built, deploy it in one click to `yourapp.deltai.fr`.

### The agentic loop (Plan → Act → Verify)

1. **Plan**: the request is decomposed into 2–4 concrete build steps (`planTodos`), rendered as a **live todo list with checkboxes** in the IDE.
2. **Act**: each step runs sequentially. The model receives the *real current state* of every project file (inlined, budget-capped), the plan with `[done] / [IN PROGRESS] / [upcoming]` marks, and the relevant skills. Existing files are modified via `edit_file` (exact search/replace) — never blindly overwritten.
3. **Verify**: a dedicated final pass re-reads the whole project against a checklist — imports point to real files, every className has a CSS rule, no orphan components, responsive, request fully covered — and fixes what it finds.
4. **Server-side guards** (because prompts alone are not enough):
   - **Anti-deflection**: a real modification request that returns zero actions is rejected and retried with an explicit "EXECUTE now" instruction.
   - **Orphan-CSS detection**: after every edit, the server statically scans touched JSX/HTML for classes with no CSS rule and forces a corrective styling pass in the site's existing design language.
   - **Read dedup**: a file already provided is never re-read (kills infinite read loops).

### In-flow autonomous reading

The AI decides *itself* when it needs to read a file — a `read_file` action mid-generation triggers a visible « Je lis src/App.jsx » step and the content is injected back. In Plan mode, a local `launch_read_file` tool does the same. The AI never asks the user to paste code.

### The rest of the IDE

- **Live preview** in a **WebContainer** (full Node runtime in the browser) — with a subtlety: the COOP/COEP isolation WebContainers require breaks Google OAuth popups, so isolation headers are **cookie-gated**: login page runs un-isolated (OAuth works), then a one-time reload activates isolation (preview works).
- **Visual edits**: click any element in the preview, change its text/style without touching code.
- **AI images**: `/api/launch/img?prompt=…` — generated, cached, embeddable without any API key. User-imported images are `@referencable` in prompts.
- **Multi-page apps**: `react-router-dom` pre-installed, and the deploy server resolves deep links (`myapp.deltai.fr/contact`), relative-base asset paths at any route depth, and static `about.html`-style pages.
- **One-click deploy**: build streamed to the backend (up to 50 MB), persisted in Postgres, served on `<slug>.deltai.fr` with SPA fallback.
- **Stripe Connect**: each creator connects their own Stripe account; their apps call `LaunchPay.checkout()` (with optional shipping-address collection). A **reconciliation sweep** retries pending payments every 60 s so orders are never lost to a missed webhook.
- **Notion, fully automated**: creator OAuths once → the AI **creates the orders database itself** (11 columns: product, status, amount, client email, name, phone, address, city, postal code, country, date), wires it as the project target, and hands the user the Notion link. Every paid order lands as a typed row. The AI reads the live schema and never asks for a database ID.

---

## The skills system

Claude-Code-style progressive disclosure, in `server/skills/library/` — 12 skills, each a `SKILL.md` with YAML frontmatter (`name`, `description`, `triggers` — keywords or regexes):

`html-css-js` · `react-vite` · `tailwind` · `design-ui` · `animations` · `seo` · `formulaires` · `paiements-stripe` · `notion-sync` · `images-ia` · `images-utilisateur` · `multi-pages`

- **Boot**: only frontmatter is scanned (a few tokens per skill).
- **Per request**: triggers are matched against the prompt, the top skills' bodies are loaded and injected into the system prompt, and the UI shows **« Je lis le skill react-vite/SKILL.md »** as an anchored step — users see exactly which runbooks the AI followed.
- Skills encode hard product rules: never ask for a Notion ID, always style new elements in the site's existing design language, use Stripe's hosted address collection instead of hand-rolled forms, real URLs over hash routing, etc.

---

## Intelligent routing & model catalog

- **Triage**: Groq running Llama 4 Scout classifies each message (ECO / MINI / NORMAL / EXPERT) in milliseconds; the tier maps to the best model of the conversation's brand.
- **Brand lock**: a conversation started with one brand (OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek, Qwen…) stays in that brand — switching mid-conversation is prevented at the UI *and* API level.
- **Curated picker**: each brand exposes its 3–4 best models (not a 64-model wall), with expandable families — GPT-5.6 unfolds into Sol / Terra / Luna.
- **Execution**: OpenRouter with automatic same-brand fallbacks, 402 "can only afford N tokens" auto-retry (`max_tokens = 0.9 × affordable`), and reasoning streamed live for models that expose it (including Claude Fable 5 via `reasoning_details`).

---

## Deep Search & background agents

- **Deep Search**: decomposes the question, fires parallel Serper searches, scores sources (authority + freshness), verifies claims across sources, reranks with an LLM, and streams every step to the UI as it happens.
- **Agents**: users create named agents with a role; missions run server-side in the background (Plan → Act with web access → Verify → Deliver), persisted in `agent_runs`, polled by web and mobile.

---

## Security & privacy

- **Encryption at rest**: every conversation is encrypted with **AES-256-GCM** using a per-user data key (DEK) derived from a master key — a database leak exposes nothing readable. Tolerant decryption handles key rotation.
- **Row Level Security** on Supabase tables.
- **Public endpoint hardening**: rate limits on Launch image generation (per IP) and Notion actions (per project), whitelisted Notion action set, UUID validation everywhere.
- **GDPR**: legal pages (CGU, mentions, privacy, cookies), cookie consent, account deletion with anonymization.

---

## Billing — cost-based credits

- **Real-cost billing**: every request is billed on the *actual* provider cost (`COST_BASED_CR_PER_USD`), not flat rates — expensive reasoning costs more, cheap models cost less.
- **Plans**: FREE (free-tier models only) · BASIC 10 € / 1 000 Cr · PLUS 23 € / 2 500 Cr · PRO 75 € / 8 500 Cr · ULTRA 200 € / 25 000 Cr — plus prepaid PAYG packs (PayPal) with volume bonuses.
- **3-hour rolling window quotas** per plan on top of credits (visible in the top bar), a monthly loss cap tied to net revenue, and per-plan attachment limits.
- Launch, Studio, Agents and Deep Search all bill through the same pipeline — one balance, visible everywhere.

---

## Mobile app (Flutter)

`mobile/` — full-parity Flutter app (Android + iOS, bundle `fr.deltai.deltaiMobile`):

- Same curated model picker (brand logo grid → tap to unfold the family), brand lock, SSE streaming with live thinking, web search, artifacts rendered as code cards, generated file downloads.
- Studio with reference-image import, image history, data-URL image rendering.
- Deep Search screen with streamed steps, Agents screen with mission polling.
- "Refaire avec" (redo with another model): long-press a message → new conversation with hidden context and a "context loaded" banner.
- Google Sign-In on both platforms; App Store-ready IPA build (signed, real icons, permissions declared).

---

## Project structure

```
BACKEND/
├── server/
│   ├── server.js               # Express app — all routes, SSE endpoints, webhooks
│   ├── config/
│   │   ├── models.js           # 64+ model catalog, tiers, families, image models
│   │   └── plans.js            # Plans, credit packs, window quotas, limits
│   ├── skills/
│   │   ├── launch-create.md    # Launch system prompts (create / edit / plan)
│   │   ├── launch-edit.md
│   │   ├── launch-plan.md
│   │   └── library/            # 12 SKILL.md runbooks (progressive disclosure)
│   └── lib/                    # 40+ modules :
│       ├── codegen.js          #   Launch agentic loop (plan/act/verify/guards)
│       ├── skillEngine.js      #   skills registry, matching, injection
│       ├── openrouter.js       #   execution, fallbacks, 402-retry, reasoning
│       ├── router.js           #   Groq triage (ECO→EXPERT)
│       ├── deepSearch.js       #   agentic research pipeline
│       ├── agentRuns.js        #   background missions
│       ├── cryptoBox.js        #   AES-256-GCM per-user encryption
│       ├── launchPay.js        #   Stripe Connect + reconciliation sweep
│       ├── launchIntegrations.js # Notion auto-provisioning (Composio)
│       ├── deploy.js           #   site hosting (deep links, SPA fallback)
│       └── …                   #   auth, quotas, credits, imagegen, suno, …
├── client/                     # React 18 + Vite + Tailwind
│   └── src/
│       ├── pages/              # ChatPage, LaunchIDE, LaunchLanding, Studio, …
│       ├── components/         # ChatMessage (live artifacts), model pickers, …
│       └── lib/                # api.js (SSE client), modelPicker, icons (SVG-only)
└── mobile/                     # Flutter app (Android + iOS)
    └── lib/src/                # screens, api client, curated picker, theme
```

---

## Running locally

```bash
# 1. Backend
cd server && npm install
cp ../.env.example .env        # fill in the keys
node server.js                 # → http://localhost:3001

# 2. Frontend (HTTPS on lvh.me — required for Launch's WebContainers)
cd client && npm install
npm run dev                    # → https://lvh.me:5173  +  https://launch.lvh.me:5173

# 3. Mobile (optional)
cd mobile && flutter run --dart-define=DELT_API=http://10.0.2.2:3001
```

The dev server uses a mkcert wildcard certificate (`*.lvh.me`) and serves cross-origin-isolation headers **only** on `launch.*` and only for authenticated users (cookie-gated) — so Google OAuth and WebContainers coexist.

---

## Environment variables

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Triage router (Llama 4 Scout) |
| `OPENROUTER_API_KEY` | LLM execution (all brands) |
| `DATABASE_URL` | Postgres / Supabase |
| `JWT_SECRET` / `MESSAGE_ENCRYPTION_KEY` | Auth tokens / master encryption key |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Launch Pay (Stripe Connect) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | Subscriptions & credit packs |
| `COMPOSIO_API_KEY` | Notion (and other) integrations |
| `FAL_KEY` / `SUNO_API_KEY` | Image / music generation |
| `SERPER_API_KEY` | Web search & Deep Search |
| `PUBLIC_API_URL` | Public backend URL (embeddable image endpoints) |
| `SITES_DOMAIN` | Deployed-apps domain (`deltai.fr` → `<slug>.deltai.fr`) |

---

## License

Proprietary — © DELT AI. All rights reserved.
