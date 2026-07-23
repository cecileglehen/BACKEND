// Catalogue CURÉ du sélecteur de chat (façon Mammouth) : 3-4 modèles par marque,
// chacun avec un "kind" → icône SVG. Les autres modèles existent toujours en
// interne (routeur, bascule), ils sont juste masqués du sélecteur.
//
// kind : "fast" ⚡ | "chat" 💬 | "think" 🧠 | "image" 🖼️ | "video" 🎬

export const PICKER = [
  { brand: "OpenAI", label: "GPT", models: [
    { id: "openai/gpt-5.6-luna",     label: "GPT Luna",     kind: "fast"  },
    { id: "openai/gpt-5.4",          label: "GPT-5.4",      kind: "chat"  },
    // Famille GPT-5.6 : entrée dépliable → Sol / Terra / Luna
    { label: "GPT-5.6", kind: "think", children: [
      { id: "openai/gpt-5.6-sol",   label: "GPT Sol",   kind: "think" },
      { id: "openai/gpt-5.6-terra", label: "GPT Terra", kind: "chat"  },
      { id: "openai/gpt-5.6-luna",  label: "GPT Luna",  kind: "fast"  }
    ]},
    { id: "openai/gpt-5.4-image-2",  label: "GPT Image 2",  kind: "image" }
  ]},
  { brand: "Anthropic", label: "Claude", models: [
    { id: "anthropic/claude-haiku-4.5",  label: "Haiku 4.5",  kind: "fast"  },
    { id: "anthropic/claude-sonnet-5", label: "Sonnet 5", kind: "chat"  },
    { id: "anthropic/claude-opus-4.8",   label: "Opus 4.8",   kind: "think" },
    { id: "anthropic/claude-fable-5",    label: "Fable 5",    kind: "think" }
  ]},
  { brand: "Google", label: "Gemini", models: [
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", kind: "fast"  },
    { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash", kind: "chat"  },
    { id: "google/gemini-3.1-flash-lite-image", label: "Nano Banana Flash Lite", kind: "image" },
    { id: "google/gemini-3.1-flash-image-preview", label: "Nano Banana 2", kind: "image" }
  ]},
  { brand: "xAI", label: "Grok", models: [
    { id: "x-ai/grok-4.3",  label: "Grok 4.3",  kind: "chat"  },
    { id: "x-ai/grok-4.20", label: "Grok 4.20", kind: "think" }
  ]},
  { brand: "Mistral", label: "Mistral", models: [
    { id: "mistralai/mistral-small-2603", label: "Small 4",     kind: "fast"  },
    { id: "mistralai/mistral-medium-3-5", label: "Medium 3.5",  kind: "chat"  },
    { id: "mistralai/mistral-large",      label: "Large 3",     kind: "think" }
  ]},
  { brand: "DeepSeek", label: "DeepSeek", models: [
    { id: "deepseek/deepseek-v4-flash", label: "V4 Flash", kind: "fast" },
    { id: "deepseek/deepseek-v4-pro",   label: "V4 Pro",   kind: "chat" }
  ]},
  { brand: "Qwen", label: "Qwen", models: [
    { id: "qwen/qwen3.5-flash-02-23", label: "3.5 Flash",    kind: "fast"  },
    { id: "qwen/qwen3.6-plus",        label: "3.6 Plus",     kind: "chat"  },
    { id: "qwen/qwen3-max-thinking",  label: "Max Thinking", kind: "think" }
  ]},
  { brand: "Z.ai", label: "GLM", models: [
    { id: "z-ai/glm-5.2", label: "GLM 5.2", kind: "chat" }
  ]},
  { brand: "Meta", label: "Llama", models: [
    { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", kind: "chat" }
  ]},
  { brand: "Perplexity", label: "Perplexity", models: [
    { id: "perplexity/sonar",               label: "Sonar",              kind: "fast"  },
    { id: "perplexity/sonar-deep-research",  label: "Sonar Deep Research", kind: "think" }
  ]},
  { brand: "Nova", label: "Nova", models: [
    { id: "amazon/nova-2-lite-v1", label: "Nova 2 Lite", kind: "fast"  },
    { id: "amazon/nova-pro-v1",    label: "Nova Pro",    kind: "chat"  },
    { id: "amazon/nova-premier-v1", label: "Nova Premier", kind: "think" }
  ]}
];

export function pickerForBrand(brand) {
  return PICKER.find((b) => b.brand === brand) || null;
}

// Groupe de sélection pour une marque HORS catalogue curé (InclusionAI, Moonshot,
// Arcee…) : construit depuis le catalogue serveur pour que le verrou marque
// n'affiche QUE les modèles de cette marque — jamais tout le catalogue.
export function brandGroupFromCatalog(brand, catalog) {
  if (!brand || !catalog?.categories) return null;
  const models = [];
  const seen = new Set();
  for (const [tier, cat] of Object.entries(catalog.categories)) {
    if (tier === "LEGACY" || cat.legacy) continue;
    for (const m of cat.models || []) {
      if (m.brand !== brand || seen.has(m.id)) continue;
      seen.add(m.id);
      models.push({ id: m.id, label: m.display, kind: "chat" });
    }
  }
  return models.length ? { brand, label: brand, models } : null;
}

// Déduit la marque depuis le préfixe d'un id de modèle (pour reverrouiller au refresh).
const ID_PREFIX_BRAND = {
  "openai/": "OpenAI", "anthropic/": "Anthropic", "google/": "Google",
  "x-ai/": "xAI", "mistralai/": "Mistral", "deepseek/": "DeepSeek", "qwen/": "Qwen",
  "z-ai/": "Z.ai", "meta-llama/": "Meta", "perplexity/": "Perplexity", "amazon/": "Nova", "moonshotai/": "Moonshot",
  "inclusionai/": "InclusionAI", "arcee-ai/": "Arcee", "cognitivecomputations/": "Venice", "minimax/": "MiniMax"
};
export function brandFromModelId(id) {
  if (!id) return null;
  for (const [p, b] of Object.entries(ID_PREFIX_BRAND)) if (String(id).startsWith(p)) return b;
  return null;
}

// Allocation mensuelle de crédits par plan (pour la barre de quota).
export const PLAN_CREDITS = { FREE: 100, BASIC: 1000, PLUS: 2500, PRO: 8500, ULTRA: 25000 };

// Estimation du coût d'un modèle (Cr) : image = coût/image ; LLM = ~1,5k tokens/msg.
export function estimateCost(id, catalog) {
  if (!catalog) return 0;
  const img = catalog.creative?.IMAGE?.models?.find((m) => m.id === id);
  if (img) return Number(img.cost) || 0;
  for (const cat of Object.values(catalog.categories || {})) {
    if (cat.models?.some((m) => m.id === id)) {
      return Math.round((Number(cat.creditPer1k ?? cat.cost) || 0) * 1.5 * 10) / 10;
    }
  }
  return 0;
}

// Trouve l'entrée curée (avec kind) d'un modèle par son id — y compris dans
// les sous-familles dépliables (children, ex. GPT-5.6 → Sol/Terra/Luna).
export function pickerEntry(id) {
  for (const b of PICKER) {
    for (const m of b.models) {
      if (m.id === id) return { ...m, brand: b.brand, brandLabel: b.label };
      const child = m.children?.find((c) => c.id === id);
      if (child) return { ...child, brand: b.brand, brandLabel: b.label };
    }
  }
  return null;
}

// ─── Icônes SVG par type (jamais d'emoji) ────────────────────────────────────
export function KindIcon({ kind, size = 15, className = "" }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className };
  switch (kind) {
    case "fast":  // éclair
      return <svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
    case "think": // cerveau
      return <svg {...p}><path d="M9.5 2A4.5 4.5 0 0 0 5 6.5 4 4 0 0 0 4 14a4 4 0 0 0 6 2.5 4 4 0 0 0 6-2.5 4 4 0 0 0-1-7.5A4.5 4.5 0 0 0 14.5 2 4.5 4.5 0 0 0 12 3a4.5 4.5 0 0 0-2.5-1z" /><path d="M12 3v14" /></svg>;
    case "image": // image
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>;
    case "video": // clap
      return <svg {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="m2 7 3-4h14l3 4M7 3l2 4M13 3l2 4" /></svg>;
    case "chat":  // bulle
    default:
      return <svg {...p}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" /></svg>;
  }
}
