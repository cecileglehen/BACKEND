import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useT, useLocale } from "../lib/i18n.jsx";

// ─── Structure bilingue : 14 sections couvrant TOUTES les fonctions ──────────
const SECTIONS = {
  fr: [
    {
      id: "chat",
      icon: "💬",
      title: "Le Chat — 80+ modèles",
      intro: "Le cœur de Delt AI. 80+ modèles répartis sur 18 providers : GPT-5.5/5.4/4.1/o3, Claude Opus 4.8/Sonnet 4.5/Haiku 4.5, Gemini 3.5/3.1/2.5, Grok 4.20/4.3, Mistral Small 4/Large/Medium/Mixtral 8x22B, Llama 4, Qwen 3.7/Coder, Kimi K2.6, Nova, DeepSeek V4, Perplexity Sonar + notre modèle DELT 33M.",
      items: [
        { label: "🇫🇷 Tokens gratuits Mistral (FR)", body: "Pour tester sans payer, on offre chaque mois sur le plan FREE : 50 000 tokens sur Mistral Small 4 (le sommet de l'IA française, open-weights, multimodal, 262K ctx), 15 000 tokens sur Mistral Large (le flagship), et 3 000 tokens sur Mixtral 8x22B Instruct (le MoE 141B). Soutiens l'IA souveraine européenne." },
        { label: "Routeur automatique", body: "L'étoile ⭐ = full auto. Delt analyse ta question et choisit le tier optimal (PICO pour les triviales, EXPERT pour les complexes). Tu peux aussi forcer une famille (GPT-5.4, Claude Sonnet…) via les pastilles." },
        { label: "Tiers (catégories)", body: "PICO/NANO = ultra rapide et cheap. MINI = bon compromis. NORMAL = qualité standard. EXPERT = raisonnement profond. PRO = le top du top (GPT-5.5 Pro, Opus, Grok 4.20 Multi-Agent)." },
        { label: "Familles (popover ...)", body: "Click sur les 3 points d'une marque pour choisir la famille (ex: GPT-5.4 ou GPT-5.5). Le routeur pickera la version exacte (nano/mini/full/pro) selon la difficulté." },
        { label: "Vision auto-swap", body: "Joins une image → si le modèle est text-only, Delt switche automatiquement vers un modèle vision-compatible du même tier (GPT-5.4 → GPT-5.4 vision)." },
        { label: "Fichiers", body: "80+ formats reconnus : PDF, code (.py .js .ts .dart .rs .go .java .swift .kt…), Word, Excel, .md, .csv, .json. Contenu extrait + envoyé au modèle automatiquement." }
      ]
    },
    {
      id: "deepsearch",
      icon: "🧠",
      title: "Deep Search v6 — pipeline complet",
      intro: "Recherche approfondie de niveau Perplexity Pro. 11 étapes en temps réel avec embeddings, clustering, re-ranking LLM, multi-hop, scoring quantitatif et synthèse pondérée.",
      items: [
        { label: "Pipeline détaillé", body: "1) Décomposition de la question → 2) Recherche web parallèle (10 requêtes) → 3) Scraping de 12 pages avec fallback Jina → 4) Embeddings de tous les chunks (text-embedding-3-small) → 5) Sélection top-50 globale → 6) Clustering anti-doublons → 7) Re-ranking LLM → 8) Extraction des faits → 9) Multi-hop si gaps → 10) Vérification croisée → 11) Synthèse pondérée." },
        { label: "Cache pgvector", body: "Embeddings stockés en DB Supabase (pgvector) → 2e recherche sur même sujet = quasi-gratuit. Pages scrapées en cache LRU 1h." },
        { label: "Reasoning graph visible", body: "Section repliable \"🧠 Comment ça pense\" sous le rapport : chaque claim avec ses sources de support, désaccords entre sources, niveau de confiance (Confirmée/Probable/Incertaine)." },
        { label: "Scoring quantitatif", body: "Chaque source notée 0-100 sur 4 dimensions : autorité (TLD, host), fraîcheur (année détectée), cohérence (% claims confirmés), citations. + multiplicateur de type (benchmark ×1.3, paper ×1.2, reddit ×0.5, social ×0.3)." },
        { label: "Multi-hop agressif", body: "Si la confiance initiale est < 70%, Delt relance automatiquement 5 requêtes ciblées sur les contradictions, exclut les domaines déjà scrapés, et re-synthétise. \"Le système insiste jusqu'à comprendre\"." },
        { label: "Zones incertaines", body: "Section dédiée dans le rapport qui liste explicitement les désaccords entre sources avec citations [1] vs [3,5]. Pas de fake confidence." }
      ]
    },
    {
      id: "integrations",
      icon: "🔌",
      title: "Intégrations — Gmail, Drive, Notion…",
      intro: "10 apps connectables en OAuth : Gmail, Google Drive, Google Calendar, Slack, Notion, GitHub, Linear, Trello, Discord, Stripe. L'IA peut LIRE et AGIR sur tes comptes directement dans le chat.",
      items: [
        { label: "Connexion en 1 click", body: "Paramètres → Intégrations → Connecter. OAuth standard Google/Slack/etc., tokens chiffrés chez Composio. Déconnexion à tout moment." },
        { label: "Permissions par chat", body: "Bouton ⚙️ dans le composer → toggle quelles apps l'IA peut utiliser dans CE chat. Le serveur ne charge que les tools cochés." },
        { label: "Exécution visible", body: "Quand l'IA appelle une intégration, tu vois un chip live : 🔵 Gmail · fetch mails (pending) → 🟢 done. Pas de magie noire." },
        { label: "Exemples d'usages", body: "\"Résume mes 5 derniers emails\" · \"Crée un événement demain 14h pour ma réunion avec Léa\" · \"Cherche dans mes Drive les docs sur le projet X\" · \"Crée une page Notion avec le brief\"." },
        { label: "Anti-hallucination", body: "Système strict : si l'IA n'appelle pas réellement le tool, elle DOIT dire \"je n'ai pas accédé\". Pas d'invention de mails/events. Permission explicite injectée en system prompt." }
      ]
    },
    {
      id: "skills",
      icon: "✨",
      title: "Skills — Fichiers, images, PowerPoint",
      intro: "L'IA peut écrire des fichiers téléchargeables, générer des images inline et créer de vraies présentations PowerPoint via du code pptxgenjs.",
      items: [
        { label: "Fichiers téléchargeables", body: "L'IA utilise %%write_file:script.py … %%end → tu vois une carte cliquable avec preview live (HTML iframe, Markdown rendu, CSV en tableau, JSON pretty, code coloré). Formats : .md .txt .csv .json .html .py .js .ts .dart .go .rs .java .cpp et 15+ autres." },
        { label: "Génération d'image inline", body: "L'IA peut intégrer %%generate_image:prompt directement dans sa réponse → image vraiment générée via FLUX Schnell et affichée dans le chat. 5 Cr / image." },
        { label: "Vrai PowerPoint (.pptx)", body: "L'IA écrit du code JavaScript pptxgenjs (centaines de lignes possibles) → exécuté côté navigateur → vrai fichier .pptx avec shapes, charts, tableaux, gradients, layouts custom. Pas une fake conversion." },
        { label: "Split view artifacts", body: "Click sur un fichier généré → l'écran se split [CHAT | ARTIFACT]. HTML preview live, code source à droite, bouton télécharger/copier." }
      ]
    },
    {
      id: "studio",
      icon: "🎨",
      title: "Studio créatif — Image, Vidéo, Musique",
      intro: "Génère des images, des vidéos HD et de la musique avec les meilleurs modèles créatifs du marché.",
      items: [
        { label: "Images (7 modèles)", body: "FLUX Schnell (rapide, 5 Cr) · Nano Banana (qualité, 8 Cr) · GPT Image Mini (10 Cr) · Nano Banana 2 (20 Cr) · Nano Banana Pro (35 Cr) · GPT Image (50 Cr) · GPT Image 2 (120 Cr, texte parfait)." },
        { label: "Vidéo (2 modèles)", body: "Veo 3.1 Lite (Google, ~18 Cr/sec — le moins cher) · Seedance 2 (ByteDance, ~50 Cr/sec — qualité supérieure). Texte → vidéo 720p en quelques minutes." },
        { label: "Musique", body: "Suno V5.5 — 1-3 min de musique avec voix, 2 pistes générées par requête. 25 Cr par génération." },
        { label: "Prompt tips", body: "Sois précis : style (cinematic, anime, photoréaliste), sujet, composition, lumière, palette. Plus tu détailles, mieux c'est." }
      ]
    },
    {
      id: "debate",
      icon: "🎭",
      title: "Mode Débat — IA × IA × IA",
      intro: "Plusieurs IA débattent ta question puis synthétisent. Idéal pour les décisions importantes ou les sujets controversés.",
      items: [
        { label: "Comment ça marche", body: "1) Une IA PROPOSE une réponse → 2) Une autre CRITIQUE → 3) Une 3e OPTIMISE → 4) Une dernière SYNTHÉTISE. Tu vois la timeline complète." },
        { label: "Mode itératif", body: "Active jusqu'à 12 rounds de débat. Chaque IA voit les arguments des précédentes. Convergence garantie sur les questions complexes." },
        { label: "Choix des agents", body: "Tu peux choisir 4 agents distincts (ex: Claude + GPT-5 + Gemini + Mistral) pour avoir des perspectives variées." }
      ]
    },
    {
      id: "parallel",
      icon: "⚖️",
      title: "Mode Parallèle — Comparaison côte à côte",
      intro: "Pose une question à 3-5 modèles en même temps et compare les réponses dans une vue côte à côte.",
      items: [
        { label: "Choix des modèles", body: "Bouton \"Multi\" dans le composer → sélectionne 2 à 5 modèles. Idéal pour comparer GPT vs Claude vs Gemini sur le même prompt." },
        { label: "Bouton Merge", body: "Une fois les réponses reçues, click \"Merge\" → une IA synthétise les meilleures parties de chaque réponse en une seule." }
      ]
    },
    {
      id: "code",
      icon: "👨‍💻",
      title: "Code Studio",
      intro: "Génère, édite et lance des projets de code entiers avec preview live et téléchargement ZIP.",
      items: [
        { label: "Génération multi-fichiers", body: "Décris ton projet → l'IA génère TOUS les fichiers (HTML/CSS/JS, ou Python, ou Node Express, etc.) organisés en structure complète." },
        { label: "Modèles spécialisés", body: "Codestral 2508 (Mistral) · Gemini 3 Flash (Google) · Ring 2.6 (gratuit). Pour du code production, ajoute Claude Sonnet ou GPT-5.3 Codex via le chat." },
        { label: "Preview & ZIP", body: "Preview HTML live dans le panneau de droite. Téléchargement ZIP du projet complet. Édition par instructions \"Ajoute une section tarifs\", \"Change les couleurs en violet\"." },
        { label: "Inspirations", body: "Catégories Web / App / Backend / Jeux avec exemples cliquables." }
      ]
    },
    {
      id: "projects",
      icon: "📁",
      title: "Projets",
      intro: "Regroupe plusieurs conversations sous un même contexte avec system prompt, mémoire et modèle par défaut commun.",
      items: [
        { label: "System prompt projet", body: "Chaque projet a son instruction permanente (ex: \"Tu es coach Python, réponds en français, code propre avec commentaires\"). Hérité par tous les chats du projet." },
        { label: "Mémoire projet", body: "Faits clés (un par ligne) + contexte libre → injectés dans chaque chat. Plus besoin de re-expliquer ton stack à chaque fois." },
        { label: "Modèle par défaut", body: "Choisis un modèle spécifique pour ce projet (ex: Claude Opus pour du droit, Codestral pour du code)." },
        { label: "Couleur & icône", body: "Personnalise visuellement chaque projet (18 icônes, 12 couleurs). Affiché dans la sidebar." }
      ]
    },
    {
      id: "memory",
      icon: "🧩",
      title: "Mémoire utilisateur",
      intro: "Delt retient qui tu es entre les conversations : nom, métier, intérêts, ton préféré, contexte personnel.",
      items: [
        { label: "Profil", body: "Settings → Mémoire. Nom, rôle (\"développeur full-stack\"), 20 centres d'intérêt suggérés + custom, ton (Neutre, Amical, Concis, Détaillé, Créatif, Humour)." },
        { label: "Activation auto", body: "Quand tu dis dans un chat \"je m'appelle X\" / \"je suis dev React\" → mémorisé pour les futures conversations." },
        { label: "Édition / suppression", body: "Tu peux voir, modifier ou supprimer chaque souvenir à tout moment depuis Settings → Mémoire." }
      ]
    },
    {
      id: "our-model",
      icon: "🇫🇷",
      title: "DELT 33M — notre modèle propriétaire",
      intro: "Un mini-LLM entraîné from scratch en France sur GPU local. 33M paramètres, 1024 tokens de contexte. Imparfait mais à 100% maison.",
      items: [
        { label: "Pourquoi", body: "On apprend à entraîner, servir, scaler. C'est notre première brique d'IA souveraine. Chaque abonnement Delt finance la prochaine version (100M → 750M → 5B)." },
        { label: "Test live", body: "Page /notre-modele : envoie un prompt directement, streaming gratuit, pas besoin d'abonnement." },
        { label: "Soutiens-nous", body: "Bouton de don PayPal sur la page : 5€, 10€, 25€ ou libre. Chaque euro finance du GPU d'entraînement." }
      ]
    },
    {
      id: "api",
      icon: "🔌",
      title: "API REST — Compatible OpenAI",
      intro: "Accède à tous les modèles via une API REST 100% compatible avec le SDK OpenAI. Change juste la base URL et ta clé.",
      items: [
        { label: "Créer une clé", body: "Settings → API → \"Nouvelle clé\" (sk-delt-...). Visible une seule fois, à copier immédiatement." },
        { label: "Endpoint", body: "https://deltai-backend.onrender.com/v1/chat/completions — format OpenAI standard. Marche avec OpenAI SDK Python/Node, LangChain, LlamaIndex, n'importe quel client." },
        { label: "Streaming SSE", body: "Param stream:true → réponses token-par-token comme OpenAI." },
        { label: "Vision multimodal", body: "Format messages avec image_url support natif sur GPT-5.x, Claude 4.5, Gemini, Grok." },
        { label: "Documentation", body: "Settings → Docs : exemples curl, Python, Node, gestion erreurs, cookbook, FAQ." }
      ]
    },
    {
      id: "credits",
      icon: "💎",
      title: "Crédits & abonnement",
      intro: "Tout est facturé en crédits (1€ = 100 Cr). Ton abonnement t'en donne chaque mois.",
      items: [
        { label: "Coût par tier", body: "PICO ≈ 0.1 Cr / msg court · NANO ≈ 0.2 · MINI ≈ 0.4 · NORMAL ≈ 4 · EXPERT ≈ 8 · PRO ≈ 50. Plus tu utilises de tokens, plus ça coûte." },
        { label: "Plans", body: "STARTER 10€/mois · STANDARD 23€ (×2.5 usage) · EXPERT 75€ (×8.5) · ENTREPRISE 200€. Tous incluent TOUS les modèles + image/vidéo/musique + API." },
        { label: "Top-up", body: "Si tu épuises tes crédits avant la fin du mois → rachète un pack ponctuel sans changer d'abonnement." },
        { label: "Solde live", body: "Affiché en haut à droite de la navbar + Settings → Utilisation pour les détails (par modèle, par tier, par jour)." }
      ]
    },
    {
      id: "privacy",
      icon: "🔒",
      title: "Confidentialité & RGPD",
      intro: "Hébergement EU (Render Frankfurt + Supabase). Conforme RGPD. Aucune donnée utilisée pour entraîner les modèles.",
      items: [
        { label: "Pas de training", body: "Aucune de tes données n'est utilisée pour entraîner les modèles (ni les nôtres, ni ceux des partenaires OpenAI/Anthropic/etc.)." },
        { label: "Export & suppression", body: "Settings → Confidentialité. Bouton \"Exporter mes données\" → JSON complet. Bouton \"Supprimer mon compte\" → effacement total en 24h." },
        { label: "Tokens OAuth", body: "Pour les intégrations Gmail/Drive/etc., les tokens sont stockés et chiffrés chez Composio. Delt AI ne les voit JAMAIS." },
        { label: "Sous-traitants", body: "Render (hébergement EU), Supabase (DB EU), Composio (intégrations US — clauses contractuelles types), OpenRouter (gateway modèles), PayPal (paiement)." }
      ]
    }
  ],
  en: [
    {
      id: "chat",
      icon: "💬",
      title: "Chat — 80+ models",
      intro: "The core of Delt AI. 80+ models across 18 providers: GPT-5.5/5.4/4.1/o3, Claude Opus 4.8/Sonnet 4.5/Haiku 4.5, Gemini 3.5/3.1/2.5, Grok 4.20/4.3, Mistral Small 4/Large/Medium/Mixtral 8x22B, Llama 4, Qwen 3.7/Coder, Kimi K2.6, Nova, DeepSeek V4, Perplexity Sonar + our DELT 33M model.",
      items: [
        { label: "🇫🇷 Free Mistral tokens (French AI)", body: "To let you test without paying, every month on the FREE plan we give you: 50,000 tokens on Mistral Small 4 (the pinnacle of French AI — open-weights, multimodal, 262K ctx), 15,000 tokens on Mistral Large (the flagship), and 3,000 tokens on Mixtral 8x22B Instruct (the 141B MoE). Support sovereign European AI." },
        { label: "Auto router", body: "The ⭐ star = full auto. Delt analyzes your question and picks the optimal tier (PICO for trivial, EXPERT for complex). You can also force a family (GPT-5.4, Claude Sonnet…) via the pills." },
        { label: "Tiers (categories)", body: "PICO/NANO = ultra fast and cheap. MINI = good compromise. NORMAL = standard quality. EXPERT = deep reasoning. PRO = the very best (GPT-5.5 Pro, Opus, Grok 4.20 Multi-Agent)." },
        { label: "Families (... popover)", body: "Click the 3 dots on a brand to pick a family (e.g. GPT-5.4 or GPT-5.5). The router will select the exact version (nano/mini/full/pro) based on difficulty." },
        { label: "Vision auto-swap", body: "Attach an image → if the model is text-only, Delt automatically switches to a vision-compatible model of the same tier (GPT-5.4 → GPT-5.4 vision)." },
        { label: "Files", body: "80+ formats supported: PDF, code (.py .js .ts .dart .rs .go .java .swift .kt…), Word, Excel, .md, .csv, .json. Content extracted + sent to the model automatically." }
      ]
    },
    {
      id: "deepsearch",
      icon: "🧠",
      title: "Deep Search v6 — full pipeline",
      intro: "Perplexity Pro-level deep research. 11 live stages with embeddings, clustering, LLM re-ranking, multi-hop reasoning, quantitative scoring and weighted synthesis.",
      items: [
        { label: "Detailed pipeline", body: "1) Decompose the question → 2) Parallel web search (10 queries) → 3) Scrape 12 pages with Jina fallback → 4) Embed all chunks (text-embedding-3-small) → 5) Global top-50 selection → 6) Anti-duplicate clustering → 7) LLM re-ranking → 8) Fact extraction → 9) Multi-hop if gaps → 10) Cross-reference → 11) Weighted synthesis." },
        { label: "pgvector cache", body: "Embeddings stored in Supabase DB (pgvector) → 2nd search on same topic = nearly free. Scraped pages in 1h LRU cache." },
        { label: "Visible reasoning graph", body: "Collapsible \"🧠 How it thinks\" section under the report: each claim with its supporting sources, source disagreements, confidence level (Confirmed/Probable/Uncertain)." },
        { label: "Quantitative scoring", body: "Each source rated 0-100 on 4 dimensions: authority (TLD, host), freshness (detected year), coherence (% claims confirmed), citations. + type multiplier (benchmark ×1.3, paper ×1.2, reddit ×0.5, social ×0.3)." },
        { label: "Aggressive multi-hop", body: "If initial confidence < 70%, Delt automatically launches 5 targeted queries on contradictions, excludes already-scraped domains, and re-synthesizes. \"The system insists until it understands\"." },
        { label: "Uncertainty zones", body: "Dedicated section in the report explicitly listing source disagreements with citations [1] vs [3,5]. No fake confidence." }
      ]
    },
    {
      id: "integrations",
      icon: "🔌",
      title: "Integrations — Gmail, Drive, Notion…",
      intro: "10 OAuth-connectable apps: Gmail, Google Drive, Google Calendar, Slack, Notion, GitHub, Linear, Trello, Discord, Stripe. The AI can READ and ACT on your accounts directly in chat.",
      items: [
        { label: "1-click connect", body: "Settings → Integrations → Connect. Standard OAuth via Google/Slack/etc., tokens encrypted by Composio. Disconnect anytime." },
        { label: "Per-chat permissions", body: "⚙️ button in the composer → toggle which apps the AI can use in THIS chat. The server only loads checked tools." },
        { label: "Visible execution", body: "When the AI calls an integration, you see a live chip: 🔵 Gmail · fetch mails (pending) → 🟢 done. No black magic." },
        { label: "Example uses", body: "\"Summarize my last 5 emails\" · \"Create an event tomorrow 2pm for my meeting with Léa\" · \"Search my Drive for docs about project X\" · \"Create a Notion page with the brief\"." },
        { label: "Anti-hallucination", body: "Strict system: if the AI doesn't actually call the tool, it MUST say \"I didn't access\". No making up emails/events. Explicit permission injected in system prompt." }
      ]
    },
    {
      id: "skills",
      icon: "✨",
      title: "Skills — Files, images, PowerPoint",
      intro: "The AI can write downloadable files, generate inline images, and create real PowerPoint presentations via pptxgenjs code.",
      items: [
        { label: "Downloadable files", body: "The AI uses %%write_file:script.py … %%end → you get a clickable card with live preview (HTML iframe, rendered Markdown, CSV table, pretty JSON, syntax-highlighted code). Formats: .md .txt .csv .json .html .py .js .ts .dart .go .rs .java .cpp and 15+ more." },
        { label: "Inline image generation", body: "The AI can embed %%generate_image:prompt directly in its response → really generated image via FLUX Schnell, displayed in chat. 5 Cr / image." },
        { label: "Real PowerPoint (.pptx)", body: "The AI writes pptxgenjs JavaScript code (hundreds of lines possible) → executed in your browser → real .pptx file with shapes, charts, tables, gradients, custom layouts. Not a fake conversion." },
        { label: "Split view artifacts", body: "Click on a generated file → the screen splits [CHAT | ARTIFACT]. Live HTML preview, source code on the right, download/copy buttons." }
      ]
    },
    {
      id: "studio",
      icon: "🎨",
      title: "Creative Studio — Image, Video, Music",
      intro: "Generate images, HD videos and music with the best creative models on the market.",
      items: [
        { label: "Images (7 models)", body: "FLUX Schnell (fast, 5 Cr) · Nano Banana (quality, 8 Cr) · GPT Image Mini (10 Cr) · Nano Banana 2 (20 Cr) · Nano Banana Pro (35 Cr) · GPT Image (50 Cr) · GPT Image 2 (120 Cr, perfect text)." },
        { label: "Video (2 models)", body: "Veo 3.1 Lite (Google, ~18 Cr/sec — cheapest) · Seedance 2 (ByteDance, ~50 Cr/sec — higher quality). Text → 720p video in minutes." },
        { label: "Music", body: "Suno V5.5 — 1-3 min of music with vocals, 2 tracks generated per request. 25 Cr per generation." },
        { label: "Prompt tips", body: "Be specific: style (cinematic, anime, photorealistic), subject, composition, lighting, palette. The more detailed, the better." }
      ]
    },
    {
      id: "debate",
      icon: "🎭",
      title: "Debate Mode — AI × AI × AI",
      intro: "Multiple AIs debate your question then synthesize. Ideal for important decisions or controversial topics.",
      items: [
        { label: "How it works", body: "1) One AI PROPOSES an answer → 2) Another CRITIQUES → 3) A 3rd OPTIMIZES → 4) A last one SYNTHESIZES. You see the full timeline." },
        { label: "Iterative mode", body: "Enable up to 12 debate rounds. Each AI sees the previous arguments. Convergence guaranteed on complex questions." },
        { label: "Agent selection", body: "You can pick 4 distinct agents (e.g. Claude + GPT-5 + Gemini + Mistral) for varied perspectives." }
      ]
    },
    {
      id: "parallel",
      icon: "⚖️",
      title: "Parallel Mode — Side-by-side comparison",
      intro: "Ask 3-5 models the same question at once and compare answers in a side-by-side view.",
      items: [
        { label: "Model selection", body: "\"Multi\" button in the composer → pick 2 to 5 models. Ideal to compare GPT vs Claude vs Gemini on the same prompt." },
        { label: "Merge button", body: "Once answers arrive, click \"Merge\" → one AI synthesizes the best parts of each into a single answer." }
      ]
    },
    {
      id: "code",
      icon: "👨‍💻",
      title: "Code Studio",
      intro: "Generate, edit and run entire code projects with live preview and ZIP download.",
      items: [
        { label: "Multi-file generation", body: "Describe your project → the AI generates ALL files (HTML/CSS/JS, or Python, or Node Express, etc.) organized in full structure." },
        { label: "Specialized models", body: "Codestral 2508 (Mistral) · Gemini 3 Flash (Google) · Ring 2.6 (free). For production code, add Claude Sonnet or GPT-5.3 Codex via chat." },
        { label: "Preview & ZIP", body: "Live HTML preview in the right panel. ZIP download of the complete project. Edit via instructions \"Add a pricing section\", \"Change colors to purple\"." },
        { label: "Inspirations", body: "Web / App / Backend / Games categories with clickable examples." }
      ]
    },
    {
      id: "projects",
      icon: "📁",
      title: "Projects",
      intro: "Group multiple conversations under a common context with shared system prompt, memory, and default model.",
      items: [
        { label: "Project system prompt", body: "Each project has its permanent instruction (e.g. \"You are a Python coach, answer in English, clean code with comments\"). Inherited by all chats in the project." },
        { label: "Project memory", body: "Key facts (one per line) + free context → injected in every chat. No more re-explaining your stack every time." },
        { label: "Default model", body: "Pick a specific model for this project (e.g. Claude Opus for legal, Codestral for code)." },
        { label: "Color & icon", body: "Visually customize each project (18 icons, 12 colors). Shown in the sidebar." }
      ]
    },
    {
      id: "memory",
      icon: "🧩",
      title: "User memory",
      intro: "Delt remembers who you are across conversations: name, job, interests, preferred tone, personal context.",
      items: [
        { label: "Profile", body: "Settings → Memory. Name, role (\"full-stack developer\"), 20 suggested interests + custom, tone (Neutral, Friendly, Concise, Detailed, Creative, Humor)." },
        { label: "Auto activation", body: "When you say in a chat \"my name is X\" / \"I'm a React dev\" → memorized for future conversations." },
        { label: "Edit / delete", body: "You can view, edit or delete each memory anytime from Settings → Memory." }
      ]
    },
    {
      id: "our-model",
      icon: "🇫🇷",
      title: "DELT 33M — our proprietary model",
      intro: "A mini-LLM trained from scratch in France on a local GPU. 33M parameters, 1024 token context. Imperfect but 100% in-house.",
      items: [
        { label: "Why", body: "We're learning to train, serve, scale. It's our first sovereign-AI building block. Every Delt subscription funds the next version (100M → 750M → 5B)." },
        { label: "Live test", body: "Page /notre-modele: send a prompt directly, free streaming, no subscription needed." },
        { label: "Support us", body: "PayPal donation button on the page: €5, €10, €25 or custom. Every euro funds training GPU." }
      ]
    },
    {
      id: "api",
      icon: "🔌",
      title: "REST API — OpenAI-compatible",
      intro: "Access all models via a REST API 100% compatible with the OpenAI SDK. Just change the base URL and your key.",
      items: [
        { label: "Create a key", body: "Settings → API → \"New key\" (sk-delt-...). Shown only once, copy immediately." },
        { label: "Endpoint", body: "https://deltai-backend.onrender.com/v1/chat/completions — standard OpenAI format. Works with OpenAI SDK Python/Node, LangChain, LlamaIndex, any client." },
        { label: "SSE Streaming", body: "Param stream:true → token-by-token responses like OpenAI." },
        { label: "Vision multimodal", body: "Messages format with image_url native support on GPT-5.x, Claude 4.5, Gemini, Grok." },
        { label: "Documentation", body: "Settings → Docs: curl, Python, Node examples, error handling, cookbook, FAQ." }
      ]
    },
    {
      id: "credits",
      icon: "💎",
      title: "Credits & subscription",
      intro: "Everything is billed in credits (€1 = 100 Cr). Your subscription gives you some every month.",
      items: [
        { label: "Cost per tier", body: "PICO ≈ 0.1 Cr / short msg · NANO ≈ 0.2 · MINI ≈ 0.4 · NORMAL ≈ 4 · EXPERT ≈ 8 · PRO ≈ 50. More tokens = more cost." },
        { label: "Plans", body: "STARTER €10/month · STANDARD €23 (×2.5 usage) · EXPERT €75 (×8.5) · ENTERPRISE €200. All include ALL models + image/video/music + API." },
        { label: "Top-up", body: "If you run out before month-end → buy a one-time pack without changing your subscription." },
        { label: "Live balance", body: "Shown top-right of navbar + Settings → Usage for details (per model, per tier, per day)." }
      ]
    },
    {
      id: "privacy",
      icon: "🔒",
      title: "Privacy & GDPR",
      intro: "EU hosting (Render Frankfurt + Supabase). GDPR-compliant. No data used to train models.",
      items: [
        { label: "No training", body: "None of your data is used to train models (neither ours, nor partners OpenAI/Anthropic/etc.)." },
        { label: "Export & delete", body: "Settings → Privacy. \"Export my data\" → full JSON. \"Delete my account\" → total deletion in 24h." },
        { label: "OAuth tokens", body: "For Gmail/Drive/etc. integrations, tokens are stored and encrypted at Composio. Delt AI NEVER sees them." },
        { label: "Subprocessors", body: "Render (EU hosting), Supabase (EU DB), Composio (US integrations — standard contractual clauses), OpenRouter (model gateway), PayPal (payment)." }
      ]
    }
  ]
};

export default function IntroRoute() {
  const { user } = useAuth();
  const tr = useT();
  const { locale } = useLocale();
  const sections = SECTIONS[locale] || SECTIONS.fr;
  const [open, setOpen] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        <div className={`text-center mb-12 transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-5">
            {tr("intro.welcome", { plan: user?.plan && user.plan !== "FREE" ? user.plan : "" })}
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-delt-text tracking-tight leading-tight" dangerouslySetInnerHTML={{ __html: tr("intro.title") }} />
          <p className="mt-5 text-base sm:text-lg text-delt-muted max-w-xl mx-auto leading-relaxed">
            {tr("intro.subtitle")}
          </p>
        </div>

        <div className="space-y-3 mb-12 stagger-children">
          {sections.map((s, i) => {
            const isOpen = open === s.id;
            return (
              <div
                key={s.id}
                className={`rounded-2xl border bg-white overflow-hidden transition-all hover-lift ${
                  isOpen ? "border-indigo-300 shadow-md" : "border-delt-border hover:border-indigo-200"
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left"
                >
                  <span className="text-3xl flex-shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-delt-text">{s.title}</div>
                    <div className="text-xs text-delt-muted mt-0.5 truncate">{s.intro}</div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`flex-shrink-0 text-delt-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-delt-border bg-delt-surface/30">
                    <p className="text-sm text-delt-text leading-relaxed pt-4 mb-4">{s.intro}</p>
                    <ul className="space-y-3">
                      {s.items.map((it, j) => (
                        <li key={j} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">{j + 1}</span>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-delt-text">{it.label}</div>
                            <p className="text-xs sm:text-sm text-delt-muted mt-0.5 leading-relaxed">{it.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-8 sm:p-10 text-center shadow-xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">{tr("intro.cta_title")}</h2>
          <p className="text-indigo-50 text-sm sm:text-base mb-6 max-w-md mx-auto">
            {tr("intro.cta_sub")}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition-colors shadow-md"
          >
            {tr("intro.cta_button")}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        <p className="text-center text-xs text-delt-muted">
          {tr("intro.help_prefix")} <a href="/settings" className="text-indigo-600 hover:underline">{tr("intro.help_settings")}</a> · <a href="/notre-modele" className="text-indigo-600 hover:underline">{tr("intro.help_ourmodel")}</a> · <a href="/billing" className="text-indigo-600 hover:underline">{tr("intro.help_pricing")}</a>
        </p>

      </div>
    </div>
  );
}
