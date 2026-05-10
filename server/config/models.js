// Catalogue des modeles OpenRouter classes par usage et consommation.
// Prix de reference: standard USD / million de tokens, quand applicable.
//
// Conversion crédits :
//   1 Cr = 0.01€ ≈ $0.0091 (taux 1.10 USD/EUR)
//   Marge DELT vs OpenRouter ≈ 55%
//   → 1 USD/1M tokens ≈ 176 Cr/1M tokens (marge 55% incluse sur ULTRA)

export const CR_PER_USD = 176; // crédits DELT par dollar OpenRouter (marge 55% incluse)

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
      { id: "google/gemma-4-31b-it:free", brand: "Google", display: "Gemma 4 31B", free: true, ctx: 262144 }
    ]
  },
  UNCENSORED: {
    label: "UNCENSORED",
    cost: 0,
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
  NANO: {
    label: "NANO",
    cost: 1,
    levelRange: [1, 3],
    models: [
      { id: "openai/gpt-5.4-nano", brand: "OpenAI", display: "GPT-5.4 Nano", price: { in: 0.20, out: 1.25 }, ctx: 400000 },
      { id: "openai/gpt-4o-mini", brand: "OpenAI", display: "GPT-4o Mini", price: { in: 0.15, out: 0.60 }, ctx: 128000 },
      { id: "mistralai/mistral-small-4", brand: "Mistral", display: "Mistral Small 4", price: { in: 0.15, out: 0.60 }, ctx: 262144 },
      { id: "google/gemini-2.5-flash", brand: "Google", display: "Gemini 2.5 Flash", price: { in: 0.30, out: 2.50 }, ctx: 1048576 }
    ]
  },
  MINI: {
    label: "MINI",
    cost: 5,
    levelRange: [4, 6],
    models: [
      { id: "openai/gpt-5.4-mini", brand: "OpenAI", display: "GPT-5.4 Mini", price: { in: 0.75, out: 4.50 }, ctx: 400000 },
      { id: "openai/gpt-5.1-codex-mini", brand: "OpenAI", display: "GPT-5.1 Codex Mini", price: { in: 0.25, out: 2.00 }, ctx: 400000 },
      { id: "mistralai/mistral-large-2512", brand: "Mistral", display: "Mistral Large 3 2512", price: { in: 0.50, out: 1.50 }, ctx: 262144 }
    ]
  },
  NORMAL: {
    label: "NORMAL",
    cost: 20,
    levelRange: [7, 8],
    models: [
      { id: "openai/gpt-5.4", brand: "OpenAI", display: "GPT-5.4", price: { in: 2.50, out: 15.00 }, ctx: 400000 },
      { id: "openai/gpt-5.5", brand: "OpenAI", display: "GPT-5.5", price: { in: 5.00, out: 30.00 }, ctx: 400000 },
      { id: "openai/gpt-5.3-codex", brand: "OpenAI", display: "GPT-5.3 Codex", price: { in: 1.75, out: 14.00 }, ctx: 400000 },
      { id: "mistralai/mistral-large", brand: "Mistral", display: "Mistral Large", price: { in: 2.00, out: 6.00 }, ctx: 128000 },
      { id: "anthropic/claude-sonnet-4-5", brand: "Anthropic", display: "Claude Sonnet 4.5", price: { in: 3.00, out: 15.00 }, ctx: 1000000 },
      { id: "x-ai/grok-4.20", brand: "xAI", display: "Grok 4.20", price: { in: 1.25, out: 2.50 }, ctx: 2000000 },
      { id: "perplexity/sonar", brand: "Perplexity", display: "Sonar Web Search", price: { in: 1.00, out: 1.00 }, ctx: 127072 }
    ]
  },
  PRICE: {
    label: "PRICE",
    cost: 50,
    levelRange: [9, 9],
    models: [
      { id: "mistralai/mistral-medium-3-5", brand: "Mistral", display: "Mistral Medium 3.5", price: { in: 1.50, out: 7.50 }, ctx: 262144 }
    ]
  },
  EXPERT: {
    label: "EXPERT",
    cost: 100,
    levelRange: [10, 10],
    models: [
      { id: "openai/gpt-5.5-pro", brand: "OpenAI", display: "GPT-5.5 Pro", price: { in: 30.00, out: 180.00 }, ctx: 400000 },
      { id: "openai/gpt-5.4-pro", brand: "OpenAI", display: "GPT-5.4 Pro", price: { in: 30.00, out: 180.00 }, ctx: 400000 },
      { id: "anthropic/claude-opus-4-5", brand: "Anthropic", display: "Claude Opus 4.5", price: { in: 5.00, out: 25.00 }, ctx: 1000000 },
      { id: "x-ai/grok-4.20-multi-agent", brand: "DeepSearch", display: "Grok 4.20 Multi-Agent", price: { in: 2.00, out: 6.00 }, ctx: 2000000 },
      { id: "perplexity/sonar-deep-research", brand: "DeepSearch", display: "Perplexity Sonar Deep Research", price: { in: 2.00, out: 8.00 }, ctx: 128000 }
    ]
  }
};

export const CREATIVE = {
  IMAGE: {
    label: "Image",
    cost: 50,
    model: { id: "recraft/recraft-v4", brand: "Recraft", display: "Recraft V4" }
  },
  VIDEO: {
    label: "Vidéo",
    cost: 250,
    model: {
      id: "openai/sora-2-pro",
      brand: "OpenAI",
      display: "Sora 2 Pro",
      warning: "Attention : une génération avec ce modèle vous coûte 12 euros."
    }
  }
};

export const TIER_PRIMARY_MODELS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([tier, category]) => [tier, category.models[0]])
);

// Alias conserve pour les anciens clients qui envoient encore VENICE.
TIER_PRIMARY_MODELS.VENICE = TIER_PRIMARY_MODELS.UNCENSORED;

export function normalizeTier(tier) {
  const value = String(tier || "NANO").toUpperCase();
  return value === "VENICE" ? "UNCENSORED" : value;
}

export function categoryFromLevel(level) {
  if (level <= 3) return "NANO";
  if (level <= 6) return "MINI";
  if (level <= 8) return "NORMAL";
  if (level <= 9) return "PRICE";
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
          levelRange: value.levelRange,
          models: value.models.map((m) => ({ ...m, cr: modelCreditPrice(m) }))
        }
      ])
    ),
    creative: CREATIVE,
    crPerUsd: CR_PER_USD,
    crPerEur: 100,        // 1€ = 100 Cr (top-up rate)
    marginPercent: 55      // marge DELT vs OpenRouter
  };
}
