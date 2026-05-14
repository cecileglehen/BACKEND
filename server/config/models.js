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
      { id: "google/gemini-2.5-flash-lite", brand: "Google", display: "Gemini 2.5 Flash Lite", price: { in: 0.10, out: 0.40 }, ctx: 1048576, tagline: "Ultra rapide & ultra cheap" },
      { id: "deepseek/deepseek-v4-flash", brand: "DeepSeek", display: "DeepSeek V4 Flash", price: { in: 0.10, out: 0.30 }, ctx: 163840, tagline: "Meilleur rapport qualité/prix" }
    ]
  },
  NANO: {
    label: "NANO",
    cost: 0.2,
    levelRange: [1, 3],
    models: [
      { id: "mistralai/mistral-small-2603", brand: "Mistral", display: "Mistral Small 4", price: { in: 0.15, out: 0.60 }, ctx: 262144, featuredLabel: "Coup de coeur · 10K tokens offerts", freeMonthlyTokens: 10000 },
      { id: "openai/gpt-5.4-nano", brand: "OpenAI", display: "GPT-5.4 Nano", price: { in: 0.20, out: 1.25 }, ctx: 400000 },
      { id: "openai/gpt-4o-mini", brand: "OpenAI", display: "GPT-4o Mini", price: { in: 0.15, out: 0.60 }, ctx: 128000 },
      { id: "google/gemini-2.5-flash", brand: "Google", display: "Gemini 2.5 Flash", price: { in: 0.30, out: 2.50 }, ctx: 1048576 }
    ]
  },
  MINI: {
    label: "MINI",
    cost: 0.4,
    levelRange: [4, 6],
    models: [
      { id: "openai/gpt-5.4-mini", brand: "OpenAI", display: "GPT-5.4 Mini", price: { in: 0.75, out: 4.50 }, ctx: 400000 },
      { id: "openai/gpt-5.1-codex-mini", brand: "OpenAI", display: "GPT-5.1 Codex Mini", price: { in: 0.25, out: 2.00 }, ctx: 400000 },
      { id: "mistralai/mistral-large-2512", brand: "Mistral", display: "Mistral Large 3 2512", price: { in: 0.50, out: 1.50 }, ctx: 262144 },
      { id: "meta-llama/llama-4-maverick", brand: "Meta", display: "Llama 4 Maverick", price: { in: 0.15, out: 0.60 }, ctx: 1048576 },
      { id: "google/gemini-3.1-flash-lite", brand: "Google", display: "Gemini 3.1 Flash Lite", price: { in: 0.15, out: 0.60 }, ctx: 1048576 },
      { id: "anthropic/claude-haiku-4.5", brand: "Anthropic", display: "Claude Haiku 4.5", price: { in: 1.00, out: 5.00 }, ctx: 200000 },
      { id: "anthropic/claude-haiku-latest", brand: "Anthropic", display: "Claude Haiku (latest)", price: { in: 1.00, out: 5.00 }, ctx: 200000 },
      { id: "x-ai/grok-4.20", brand: "xAI", display: "Grok 4.20", price: { in: 1.25, out: 2.50 }, ctx: 2000000 },
      { id: "x-ai/grok-4.3", brand: "xAI", display: "Grok 4.3", price: { in: 0.50, out: 2.00 }, ctx: 2000000 }
    ]
  },
  NORMAL: {
    label: "NORMAL",
    cost: 4,
    levelRange: [7, 8],
    models: [
      { id: "openai/gpt-5.4", brand: "OpenAI", display: "GPT-5.4", price: { in: 2.50, out: 15.00 }, ctx: 400000 },
      { id: "openai/gpt-5.3-codex", brand: "OpenAI", display: "GPT-5.3 Codex", price: { in: 1.75, out: 14.00 }, ctx: 400000 },
      { id: "mistralai/mistral-large", brand: "Mistral", display: "Mistral Large", price: { in: 2.00, out: 6.00 }, ctx: 128000 },
      { id: "anthropic/claude-sonnet-4-5", brand: "Anthropic", display: "Claude Sonnet 4.5", price: { in: 3.00, out: 15.00 }, ctx: 1000000 },
      { id: "perplexity/sonar", brand: "Perplexity", display: "Sonar Web Search", price: { in: 1.00, out: 1.00 }, ctx: 127072 }
    ]
  },
  EXPERT: {
    label: "EXPERT",
    cost: 8,
    levelRange: [9, 10],
    models: [
      { id: "openai/gpt-5.5", brand: "OpenAI", display: "GPT-5.5", price: { in: 5.00, out: 30.00 }, ctx: 400000 },
      { id: "anthropic/claude-opus-4-5", brand: "Anthropic", display: "Claude Opus 4.5", price: { in: 5.00, out: 25.00 }, ctx: 1000000 },
      { id: "x-ai/grok-4.20-multi-agent", brand: "xAI", display: "Grok 4.20 Multi-Agent", price: { in: 2.00, out: 6.00 }, ctx: 2000000 },
      { id: "perplexity/sonar-deep-research", brand: "Perplexity", display: "Sonar Deep Research", price: { in: 2.00, out: 8.00 }, ctx: 128000 }
    ]
  },
  PRO: {
    label: "PRO",
    cost: 50,
    levelRange: [10, 10],
    models: [
      { id: "openai/gpt-5.5-pro", brand: "OpenAI", display: "GPT-5.5 Pro", price: { in: 30.00, out: 180.00 }, ctx: 400000 },
      { id: "openai/gpt-5.4-pro", brand: "OpenAI", display: "GPT-5.4 Pro", price: { in: 30.00, out: 180.00 }, ctx: 400000 }
    ]
  }
};

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
    crPerEur: 100        // 1€ = 100 Cr (top-up rate)
  };
}
