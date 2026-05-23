// Catalogue des modeles OpenRouter classes par usage et consommation.
// Prix de reference: standard USD / million de tokens, quand applicable.
//
// Conversion crédits :
//   1 Cr = 0.01€ ≈ $0.0091 (taux 1.10 USD/EUR)
//   → 1 USD/1M tokens ≈ 176 Cr/1M tokens

export const CR_PER_USD = 176; // crédits DELT par dollar fournisseur

// Calcule le prix d'un modèle en Cr par 1M tokens (input + output)
export function modelCreditPrice(model) {
  if (!model?.price) return null;
  return {
    input:  Math.round(model.price.in  * CR_PER_USD),
    output: Math.round(model.price.out * CR_PER_USD)
  };
}

export const CATEGORIES = {
  FREE: {
    label: "FREE",
    cost: 0,
    levelRange: [1, 3],
    models: [
      { id: "inclusionai/ring-2.6-1t:free", brand: "InclusionAI", display: "Ring 2.6 1T", free: true, ctx: 262144 },
      { id: "inclusionai/ling-2.6-flash",   brand: "InclusionAI", display: "Ling 2.6 Flash", free: true, ctx: 131072 },
      { id: "moonshotai/kimi-k2.6",         brand: "Moonshot",    display: "Kimi K2.6", free: true, ctx: 131072 },
      { id: "openai/gpt-oss-120b:free", brand: "OpenAI", display: "GPT OSS 120B", free: true, ctx: 131072 },
      { id: "google/gemma-4-31b-it:free", brand: "Google", display: "Gemma 4 31B", free: true, ctx: 262144 },
      { id: "arcee-ai/trinity-large-thinking:free", brand: "Arcee", display: "Trinity Large Thinking", free: true, ctx: 131072 },
      { id: "deepseek/deepseek-v4-flash:free", brand: "DeepSeek", display: "DeepSeek V4 Flash", free: true, ctx: 163840 }
    ]
  },
  UNCENSORED: {
    label: "UNCENSORED",
    cost: 0.1,
    models: [
      {
        id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        brand: "Venice",
        display: "Dolphin Mistral 24B",
        free: true,
        adult: true,
        ageGate: true,
        ctx: 32768
      }
    ]
  },
  PICO: {
    label: "PICO",
    cost: 0.1,
    levelRange: [1, 2],
    models: [
      { id: "google/gemini-2.5-flash-lite", brand: "Google", display: "Gemini 2.5 Flash Lite", price: { in: 0.10, out: 0.40 }, ctx: 1048576, vision: true, tagline: "Ultra rapide & ultra cheap" },
      { id: "amazon/nova-micro-v1", brand: "Nova", display: "Nova Micro", price: { in: 0.035, out: 0.14 }, ctx: 128000 },
      { id: "amazon/nova-2-lite-v1", brand: "Nova", display: "Nova 2 Lite", price: { in: 0.06, out: 0.24 }, ctx: 300000, vision: true },
      { id: "qwen/qwen3.5-flash-02-23", brand: "Qwen", display: "Qwen 3.5 Flash", price: { in: 0.10, out: 0.30 }, ctx: 1000000 },
      { id: "qwen/qwen3-coder-flash",   brand: "Qwen", display: "Qwen3 Coder Flash", price: { in: 0.15, out: 0.40 }, ctx: 1000000, tagline: "Code rapide" },
      { id: "deepseek/deepseek-v4-flash", brand: "DeepSeek", display: "DeepSeek V4 Flash", price: { in: 0.10, out: 0.30 }, ctx: 163840, tagline: "Meilleur rapport qualité/prix" }
    ]
  },
  NANO: {
    label: "NANO",
    cost: 0.2,
    levelRange: [1, 3],
    models: [
      { id: "mistralai/mistral-small-2603", brand: "Mistral", display: "Mistral Small 4", price: { in: 0.15, out: 0.60 }, ctx: 262144, vision: true, featuredLabel: "Coup de coeur · 10K tokens offerts", freeMonthlyTokens: 10000 },
      { id: "openai/gpt-5.4-nano", brand: "OpenAI", display: "GPT-5.4 Nano", price: { in: 0.20, out: 1.25 }, ctx: 400000, vision: true },
      { id: "openai/gpt-4.1-nano", brand: "OpenAI", display: "GPT-4.1 Nano", price: { in: 0.10, out: 0.40 }, ctx: 1047576, vision: true },
      { id: "openai/gpt-4o-mini", brand: "OpenAI", display: "GPT-4o Mini", price: { in: 0.15, out: 0.60 }, ctx: 128000, vision: true },
      { id: "google/gemini-2.5-flash", brand: "Google", display: "Gemini 2.5 Flash", price: { in: 0.30, out: 2.50 }, ctx: 1048576, vision: true }
    ]
  },
  MINI: {
    label: "MINI",
    cost: 0.4,
    levelRange: [4, 6],
    models: [
      { id: "openai/gpt-5.4-mini", brand: "OpenAI", display: "GPT-5.4 Mini", price: { in: 0.75, out: 4.50 }, ctx: 400000, vision: true },
      { id: "amazon/nova-pro-v1", brand: "Nova", display: "Nova Pro", price: { in: 0.80, out: 3.20 }, ctx: 300000, vision: true },
      { id: "qwen/qwen3.5-plus-20260420", brand: "Qwen", display: "Qwen 3.5 Plus", price: { in: 0.40, out: 1.60 }, ctx: 1000000 },
      { id: "qwen/qwen3.6-plus",          brand: "Qwen", display: "Qwen 3.6 Plus", price: { in: 0.50, out: 2.00 }, ctx: 1000000 },
      { id: "qwen/qwen3.5-122b-a10b",     brand: "Qwen", display: "Qwen 3.5 122B-A10B", price: { in: 0.30, out: 1.20 }, ctx: 262144, tagline: "MoE 122B (10B actifs)" },
      { id: "qwen/qwen3-coder-plus",      brand: "Qwen", display: "Qwen3 Coder Plus", price: { in: 0.80, out: 3.20 }, ctx: 1000000, tagline: "Spécialisé code" },
      { id: "openai/gpt-4.1-mini",  brand: "OpenAI", display: "GPT-4.1 Mini",  price: { in: 0.40, out: 1.60 }, ctx: 1047576, vision: true },
      { id: "openai/o3-mini",       brand: "OpenAI", display: "o3-mini",      price: { in: 1.10, out: 4.40 }, ctx: 200000 },
      { id: "openai/o3-mini-high",  brand: "OpenAI", display: "o3-mini-high", price: { in: 1.10, out: 4.40 }, ctx: 200000 },
      { id: "openai/gpt-5.1-codex-mini", brand: "OpenAI", display: "GPT-5.1 Codex Mini", price: { in: 0.25, out: 2.00 }, ctx: 400000 },
      { id: "openai/gpt-5.1-chat",       brand: "OpenAI", display: "GPT-5.1 Chat",       price: { in: 1.00, out: 6.00 }, ctx: 400000, vision: true },
      { id: "openai/gpt-5.1-codex",      brand: "OpenAI", display: "GPT-5.1 Codex",      price: { in: 1.25, out: 10.00 }, ctx: 400000 },
      { id: "mistralai/mistral-large-2512", brand: "Mistral", display: "Mistral Large 3 2512", price: { in: 0.50, out: 1.50 }, ctx: 262144, vision: true },
      { id: "mistralai/mistral-medium-3-5", brand: "Mistral", display: "Mistral Medium 3.5", price: { in: 0.40, out: 2.00 }, ctx: 131072, vision: true },
      { id: "meta-llama/llama-4-maverick", brand: "Meta", display: "Llama 4 Maverick", price: { in: 0.15, out: 0.60 }, ctx: 1048576, vision: true },
      { id: "google/gemini-3.5-flash", brand: "Google", display: "Gemini 3.5 Flash", price: { in: 0.30, out: 2.50 }, ctx: 1048576, vision: true },
      { id: "anthropic/claude-haiku-4.5", brand: "Anthropic", display: "Claude Haiku 4.5", price: { in: 1.00, out: 5.00 }, ctx: 200000, vision: true },
      { id: "anthropic/claude-haiku-latest", brand: "Anthropic", display: "Claude Haiku (latest)", price: { in: 1.00, out: 5.00 }, ctx: 200000, vision: true },
      { id: "x-ai/grok-4.20", brand: "xAI", display: "Grok 4.20", price: { in: 1.25, out: 2.50 }, ctx: 2000000, vision: true },
      { id: "x-ai/grok-build-0.1", brand: "xAI", display: "Grok Agent", price: { in: 1.50, out: 3.50 }, ctx: 256000, tagline: "Agent xAI — actions multi-étapes" },
      { id: "x-ai/grok-4.3", brand: "xAI", display: "Grok 4.3", price: { in: 0.50, out: 2.00 }, ctx: 2000000, vision: true }
    ]
  },
  NORMAL: {
    label: "NORMAL",
    cost: 4,
    levelRange: [7, 8],
    models: [
      { id: "openai/gpt-5.4", brand: "OpenAI", display: "GPT-5.4", price: { in: 2.50, out: 15.00 }, ctx: 400000, vision: true },
      { id: "amazon/nova-premier-v1", brand: "Nova", display: "Nova Premier", price: { in: 2.50, out: 12.50 }, ctx: 1000000, vision: true },
      { id: "qwen/qwen3.6-max-preview", brand: "Qwen", display: "Qwen 3.6 Max", price: { in: 2.00, out: 6.00 }, ctx: 1000000 },
      { id: "qwen/qwen3.7-max",         brand: "Qwen", display: "Qwen 3.7 Max", price: { in: 2.50, out: 10.00 }, ctx: 1000000 },
      { id: "openai/gpt-4.1",  brand: "OpenAI", display: "GPT-4.1", price: { in: 2.00, out: 8.00 }, ctx: 1047576, vision: true },
      { id: "openai/gpt-5.2-chat",  brand: "OpenAI", display: "GPT-5.2 Chat",  price: { in: 1.25, out: 7.50 },  ctx: 400000, vision: true },
      { id: "openai/gpt-5.2-codex", brand: "OpenAI", display: "GPT-5.2 Codex", price: { in: 1.50, out: 12.00 }, ctx: 400000 },
      { id: "openai/gpt-5.3-chat", brand: "OpenAI", display: "GPT-5.3 Chat", price: { in: 1.50, out: 9.00 }, ctx: 400000, vision: true },
      { id: "openai/gpt-5.3-codex", brand: "OpenAI", display: "GPT-5.3 Codex", price: { in: 1.75, out: 14.00 }, ctx: 400000 },
      { id: "openai/gpt-5.1-codex-max", brand: "OpenAI", display: "GPT-5.1 Codex Max", price: { in: 2.00, out: 16.00 }, ctx: 400000 },
      { id: "mistralai/mistral-large", brand: "Mistral", display: "Mistral Large", price: { in: 2.00, out: 6.00 }, ctx: 128000, vision: true },
      { id: "anthropic/claude-sonnet-4-5", brand: "Anthropic", display: "Claude Sonnet 4.5", price: { in: 3.00, out: 15.00 }, ctx: 1000000, vision: true },
      { id: "perplexity/sonar", brand: "Perplexity", display: "Sonar Web Search", price: { in: 1.00, out: 1.00 }, ctx: 127072 }
    ]
  },
  EXPERT: {
    label: "EXPERT",
    cost: 8,
    levelRange: [9, 10],
    models: [
      { id: "openai/gpt-5.5", brand: "OpenAI", display: "GPT-5.5", price: { in: 5.00, out: 30.00 }, ctx: 400000, vision: true },
      { id: "qwen/qwen3-max-thinking",         brand: "Qwen", display: "Qwen3 Max Thinking", price: { in: 3.00, out: 15.00 }, ctx: 1000000, tagline: "Raisonnement profond" },
      { id: "qwen/qwen3-vl-235b-a22b-thinking",brand: "Qwen", display: "Qwen3 VL 235B Thinking", price: { in: 2.50, out: 12.00 }, ctx: 256000, vision: true, tagline: "Vision + raisonnement, MoE 235B" },
      { id: "anthropic/claude-opus-4-5", brand: "Anthropic", display: "Claude Opus 4.5", price: { in: 5.00, out: 25.00 }, ctx: 1000000, vision: true },
      { id: "x-ai/grok-4.20-multi-agent", brand: "xAI", display: "Grok 4.20 Multi-Agent", price: { in: 2.00, out: 6.00 }, ctx: 2000000, vision: true },
      { id: "perplexity/sonar-deep-research", brand: "Perplexity", display: "Sonar Deep Research", price: { in: 2.00, out: 8.00 }, ctx: 128000 }
    ]
  },
  PRO: {
    label: "PRO",
    cost: 50,
    levelRange: [10, 10],
    models: [
      { id: "openai/gpt-5.5-pro", brand: "OpenAI", display: "GPT-5.5 Pro", price: { in: 30.00, out: 180.00 }, ctx: 400000, vision: true },
      { id: "openai/gpt-5.4-pro", brand: "OpenAI", display: "GPT-5.4 Pro", price: { in: 30.00, out: 180.00 }, ctx: 400000, vision: true }
    ]
  }
};

// ─── Vision (analyse d'images) ──────────────────────────────────────────────
// Modèles qui acceptent des images en entrée. Utilisé pour auto-switcher
// quand l'utilisateur joint une image à un modèle text-only.
export function supportsVision(modelOrId) {
  if (!modelOrId) return false;
  if (typeof modelOrId === "object" && modelOrId !== null) return Boolean(modelOrId.vision);
  for (const cat of Object.values(CATEGORIES)) {
    const m = cat.models?.find((x) => x.id === modelOrId);
    if (m) return Boolean(m.vision);
  }
  return false;
}

// Renvoie un modèle vision-compatible pour un tier donné, ou null.
// Préfère le modèle primaire (premier de la liste) s'il a vision, sinon le 1er compatible.
export function pickVisionModelForTier(tier) {
  const cat = CATEGORIES[String(tier || "").toUpperCase()];
  if (!cat) return null;
  const primary = cat.models?.[0];
  if (primary?.vision) return primary;
  return cat.models?.find((m) => m.vision) || null;
}

export const CREATIVE = {
  IMAGE: {
    label: "Image",
    // Liste complète des modèles d'image (provider + cost en Cr + tagline)
    models: [
      { id: "fal-ai/flux-1/schnell",                 brand: "Flux",   display: "FLUX Schnell",    provider: "fal",        cost: 5,   tagline: "Rapide & quotidien — éco" },
      { id: "google/gemini-2.5-flash-image",         brand: "Google", display: "Nano Banana",     provider: "openrouter", cost: 8,   tagline: "Bonne qualité — usage standard" },
      { id: "openai/gpt-5-image-mini",               brand: "OpenAI", display: "GPT Image Mini",  provider: "openrouter", cost: 10,  tagline: "Compact OpenAI — bon ratio qualité/prix" },
      { id: "google/gemini-3.1-flash-image-preview", brand: "Google", display: "Nano Banana 2",   provider: "openrouter", cost: 20,  tagline: "Rendu presque parfait" },
      { id: "google/gemini-3-pro-image-preview",     brand: "Google", display: "Nano Banana Pro", provider: "openrouter", cost: 35,  tagline: "Rendu parfait" },
      { id: "openai/gpt-5-image",                    brand: "OpenAI", display: "GPT Image",       provider: "openrouter", cost: 50,  tagline: "OpenAI haut de gamme" },
      { id: "openai/gpt-5.4-image-2",                brand: "OpenAI", display: "GPT Image 2",     provider: "openrouter", cost: 120, tagline: "Texte parfait — rendu pro" }
    ],
    get model() { return this.models[0]; },
    get cost() { return this.models[0].cost; }
  },
  VIDEO: {
    label: "Vidéo",
    models: [
      {
        id: "google/veo-3.1-lite",
        brand: "Google",
        display: "Veo 3.1 Lite",
        provider: "fal",
        // ~$0.10/s en 720p → ~18 Cr/s avec marge
        crPerSecond720p: 18,
        tagline: "Le moins cher"
      },
      {
        id: "bytedance/seedance-2.0/text-to-video",
        brand: "ByteDance",
        display: "Seedance 2",
        provider: "fal",
        // Coût dynamique : ~$0.30/s en 720p → ~50 Cr/s avec marge
        crPerSecond720p: 50
      }
    ],
    get model() { return this.models[0]; }
  },
  MUSIC: {
    label: "Musique",
    models: [
      {
        id: "suno/v5.5",
        brand: "Suno",
        display: "Suno V5.5",
        provider: "suno",
        cost: 25,
        tagline: "Génération musicale ~1-3 min · 2 pistes"
      }
    ],
    get model() { return this.models[0]; },
    get cost() { return this.models[0].cost; }
  }
};

export const TIER_PRIMARY_MODELS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([tier, category]) => [tier, category.models[0]])
);

// Alias conserve pour les anciens clients qui envoient encore VENICE.
TIER_PRIMARY_MODELS.VENICE = TIER_PRIMARY_MODELS.UNCENSORED;

export function normalizeTier(tier) {
  const value = String(tier || "NANO").toUpperCase();
  if (value === "VENICE") return "UNCENSORED";
  if (value === "PRICE") return "EXPERT";
  return value;
}

export function categoryFromLevel(level) {
  if (level <= 2) return "PICO";
  if (level <= 3) return "NANO";
  if (level <= 6) return "MINI";
  if (level <= 8) return "NORMAL";
  return "EXPERT";
}

export function findCategoryOfModel(modelId) {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.models.some((m) => m.id === modelId)) return key;
  }
  return null;
}

export function findModelInCatalog(modelId) {
  for (const [tier, cat] of Object.entries(CATEGORIES)) {
    const model = cat.models.find((m) => m.id === modelId);
    if (model) return { tier, model };
  }
  return null;
}

export function isBrandAlias(modelId) {
  return /^brand:/i.test(String(modelId || ""));
}

export function brandFromAlias(modelId) {
  const value = String(modelId || "");
  if (!isBrandAlias(value)) return null;
  return decodeURIComponent(value.slice("brand:".length));
}

// ─── Familles de modèles ────────────────────────────────────────────────────
// Permet de cibler "GPT-5.4" sans choisir entre nano/mini/full/pro — le router
// pick la variante optimale de la famille en fonction du tier de l'user.

// Définition des familles par marque (regex match sur l'id du modèle).
const FAMILY_RULES = {
  OpenAI: [
    { id: "gpt-5.5",   label: "GPT-5.5",     test: (id) => /^openai\/gpt-5\.5/.test(id) },
    { id: "gpt-5.4",   label: "GPT-5.4",     test: (id) => /^openai\/gpt-5\.4/.test(id) },
    { id: "gpt-5.3",   label: "GPT-5.3",     test: (id) => /^openai\/gpt-5\.3/.test(id) },
    { id: "gpt-5.2",   label: "GPT-5.2",     test: (id) => /^openai\/gpt-5\.2/.test(id) },
    { id: "gpt-5.1",   label: "GPT-5.1",     test: (id) => /^openai\/gpt-5\.1/.test(id) },
    { id: "gpt-4.1",   label: "GPT-4.1",     test: (id) => /^openai\/gpt-4\.1/.test(id) },
    { id: "gpt-4o",    label: "GPT-4o",      test: (id) => /^openai\/gpt-4o/.test(id) },
    { id: "o3",        label: "o3",          test: (id) => /^openai\/o3/.test(id) }
  ],
  Anthropic: [
    { id: "haiku",     label: "Claude Haiku",  test: (id) => /claude-haiku/.test(id) },
    { id: "sonnet",    label: "Claude Sonnet", test: (id) => /claude-sonnet/.test(id) },
    { id: "opus",      label: "Claude Opus",   test: (id) => /claude-opus/.test(id) }
  ],
  Google: [
    { id: "gemini-3.5",label: "Gemini 3.5",  test: (id) => /gemini-3\.5/.test(id) },
    { id: "gemini-3.1",label: "Gemini 3.1",  test: (id) => /gemini-3\.1/.test(id) },
    { id: "gemini-3",  label: "Gemini 3",    test: (id) => /gemini-3(?!\.\d)/.test(id) },
    { id: "gemini-2.5",label: "Gemini 2.5",  test: (id) => /gemini-2\.5/.test(id) }
  ],
  Mistral: [
    { id: "small",     label: "Mistral Small",  test: (id) => /mistral-small/.test(id) },
    { id: "medium",    label: "Mistral Medium", test: (id) => /mistral-medium/.test(id) },
    { id: "large",     label: "Mistral Large",  test: (id) => /mistral-large/.test(id) }
  ],
  xAI: [
    { id: "grok-4.3",   label: "Grok 4.3",    test: (id) => /grok-4\.3/.test(id) },
    { id: "grok-4.20",  label: "Grok 4.20",   test: (id) => /grok-4\.20/.test(id) },
    { id: "grok-build", label: "Grok Agent",  test: (id) => /grok-build/.test(id) }
  ],
  InclusionAI: [
    { id: "ring",       label: "Ring",        test: (id) => /^inclusionai\/ring/.test(id) },
    { id: "ling",       label: "Ling",        test: (id) => /^inclusionai\/ling/.test(id) }
  ],
  Moonshot: [
    { id: "kimi",       label: "Kimi",        test: (id) => /^moonshotai\/kimi/.test(id) }
  ],
  Nova: [
    { id: "nova-micro", label: "Nova Micro",    test: (id) => /^amazon\/nova-micro/.test(id) },
    { id: "nova-lite",  label: "Nova Lite",     test: (id) => /^amazon\/nova-(2-)?lite/.test(id) },
    { id: "nova-pro",   label: "Nova Pro",      test: (id) => /^amazon\/nova-pro/.test(id) },
    { id: "nova-premier",label: "Nova Premier", test: (id) => /^amazon\/nova-premier/.test(id) }
  ],
  Qwen: [
    { id: "qwen-3.7",      label: "Qwen 3.7",       test: (id) => /^qwen\/qwen3\.7/.test(id) },
    { id: "qwen-3.6",      label: "Qwen 3.6",       test: (id) => /^qwen\/qwen3\.6/.test(id) },
    { id: "qwen-3.5",      label: "Qwen 3.5",       test: (id) => /^qwen\/qwen3\.5/.test(id) },
    { id: "qwen-coder",    label: "Qwen Coder",     test: (id) => /^qwen\/qwen3-coder/.test(id) },
    { id: "qwen-max",      label: "Qwen Max",       test: (id) => /^qwen\/qwen3-max/.test(id) },
    { id: "qwen-vl",       label: "Qwen VL",        test: (id) => /^qwen\/qwen3-vl/.test(id) }
  ]
};

// Construit la liste des familles avec leurs modèles depuis le catalogue.
// Renvoie { OpenAI: [{ id, label, models: [...] }], Anthropic: [...], ... }
export function getModelFamilies() {
  const result = {};
  for (const [brand, rules] of Object.entries(FAMILY_RULES)) {
    const families = [];
    for (const rule of rules) {
      const matchedModels = [];
      for (const [tier, cat] of Object.entries(CATEGORIES)) {
        for (const m of cat.models) {
          if (rule.test(m.id)) {
            matchedModels.push({ ...m, tier });
          }
        }
      }
      if (matchedModels.length > 0) {
        families.push({ id: rule.id, label: rule.label, models: matchedModels });
      }
    }
    if (families.length > 0) result[brand] = families;
  }
  return result;
}

export function isFamilyAlias(modelId) {
  return /^family:/i.test(String(modelId || ""));
}

// "family:OpenAI:gpt-5.4" → { brand: "OpenAI", family: "gpt-5.4" }
export function familyFromAlias(modelId) {
  const value = String(modelId || "");
  if (!isFamilyAlias(value)) return null;
  const rest = value.slice("family:".length);
  const sepIdx = rest.indexOf(":");
  if (sepIdx === -1) return null;
  return {
    brand: decodeURIComponent(rest.slice(0, sepIdx)),
    family: rest.slice(sepIdx + 1)
  };
}

// Trouve le meilleur modèle d'une famille au tier demandé (ou le plus proche).
export function findModelForFamily(brand, familyId, tier) {
  const rules = FAMILY_RULES[brand];
  if (!rules) return null;
  const rule = rules.find((r) => r.id === familyId);
  if (!rule) return null;

  const wantedTier = normalizeTier(tier || "NANO");
  const tierOrder = ["FREE", "PICO", "NANO", "MINI", "NORMAL", "EXPERT", "PRO"];
  const wantedIndex = Math.max(0, tierOrder.indexOf(wantedTier));
  const searchOrder = [
    wantedTier,
    ...tierOrder.slice(0, wantedIndex).reverse(),
    ...tierOrder.slice(wantedIndex + 1)
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  for (const key of searchOrder) {
    const cat = CATEGORIES[key];
    const model = cat?.models?.find((m) => rule.test(m.id) && !m.adult);
    if (model) return { tier: key, model };
  }
  return null;
}

export function findModelForBrand(brand, tier) {
  const wantedBrand = String(brand || "").toLowerCase();
  const wantedTier = normalizeTier(tier || "NANO");
  const tierOrder = ["FREE", "PICO", "NANO", "MINI", "NORMAL", "EXPERT", "PRO"];
  const wantedIndex = Math.max(0, tierOrder.indexOf(wantedTier));
  const searchOrder = [
    wantedTier,
    ...tierOrder.slice(0, wantedIndex).reverse(),
    ...tierOrder.slice(wantedIndex + 1)
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);

  for (const key of searchOrder) {
    const cat = CATEGORIES[key];
    const model = cat?.models?.find((m) => String(m.brand || "").toLowerCase() === wantedBrand && !m.adult);
    if (model) return { tier: key, model };
  }
  return null;
}

export function fallbackChain(modelId) {
  const cat = findCategoryOfModel(modelId);
  if (!cat) return [modelId];
  const list = CATEGORIES[cat].models.map((m) => m.id);
  const idx = list.indexOf(modelId);
  return [...list.slice(idx), ...list.slice(0, idx)].filter((v, i, a) => a.indexOf(v) === i);
}

export function publicCatalog() {
  return {
    categories: Object.fromEntries(
      Object.entries(CATEGORIES).map(([key, value]) => [
        key,
        {
          label: value.label,
          cost: value.cost,
          creditPer1k: value.cost,
          levelRange: value.levelRange,
          models: value.models.map(({ price, ...m }) => ({ ...m }))
        }
      ])
    ),
    creative: CREATIVE,
    families: getModelFamilies(),
    crPerEur: 100        // 1€ = 100 Cr (top-up rate)
  };
}
