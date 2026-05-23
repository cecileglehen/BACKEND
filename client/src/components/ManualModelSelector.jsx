import { useMemo } from "react";

const PROVIDERS = ["Mistral", "OpenAI", "Anthropic", "Google", "Meta", "xAI", "Perplexity", "DeepSeek", "Venice", "InclusionAI", "Arcee", "Moonshot", "Nova", "Qwen"];

const BRAND_LOGO = {
  OpenAI:     "/brands/openai.svg",
  Google:     "/brands/gemini-color.svg",
  Anthropic:  "/brands/claude-color.svg",
  Mistral:    "/brands/mistral-color.svg",
  Meta:       "/brands/meta-color.svg",
  xAI:        "/brands/grok.svg",
  Perplexity: "/brands/perplexity-color.svg",
  Venice:     "/brands/venice-color.svg",
  InclusionAI:"/brands/antgroup-color.svg",
  Arcee:      "/brands/arcee-color.png",
  DeepSeek:   "/brands/deepseek-color.svg",
  Moonshot:   "/brands/moonshot-color.svg",
  Nova:       "/brands/nova-color.svg",
  Qwen:       "/brands/qwen-color.svg",
};

const BRAND_LABEL = {
  OpenAI: "GPT",
  Anthropic: "Claude",
  Google: "Gemini",
  Meta: "Llama",
  xAI: "Grok",
  InclusionAI: "Inclusion",
  Moonshot: "Kimi"
};

export default function ManualModelSelector({ catalog, selectedId, onSelect, plan }) {
  const isFree = plan === "FREE";

  const families = useMemo(() => {
    const map = new Map();
    if (!catalog?.categories) return map;
    for (const [tier, category] of Object.entries(catalog.categories)) {
      const models = Array.isArray(category?.models) ? category.models : [];
      for (const model of models) {
        if (!model || model.adult) continue;
        const brand = model.brand || "Autre";
        if (!map.has(brand)) map.set(brand, []);
        map.get(brand).push({ ...model, brand, tier, cost: category?.cost ?? 0 });
      }
    }
    return map;
  }, [catalog]);

  if (!catalog) return <div className="card p-4 text-xs text-delt-muted">Chargement des modèles…</div>;

  const renderFamily = (provider, models) => {
    const first = isFree
      ? (models.find((m) => m.tier === "FREE" || m.freeMonthlyTokens) || models[0])
      : (models.find((m) => m.tier !== "FREE") || models[0]);
    const family = {
      id: `brand:${encodeURIComponent(provider)}`,
      brand: provider,
      display: BRAND_LABEL[provider] || provider,
      tier: first?.tier || "NANO",
      isBrandFamily: true
    };
    const selected = selectedId === family.id || models.some((m) => m.id === selectedId);
    const locked = isFree && models.every((m) => m.tier !== "FREE" && !m.freeMonthlyTokens);
    const logo = BRAND_LOGO[provider];

    return (
      <button
        key={provider}
        onClick={() => !locked && onSelect(family)}
        className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${
          locked
            ? "opacity-40 cursor-not-allowed border-transparent"
            : selected
            ? "border-delt-accent bg-indigo-50"
            : "border-transparent hover:border-delt-border hover:bg-delt-surface"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            {logo && <img src={logo} alt={provider} className="w-5 h-5 object-contain flex-shrink-0" />}
            <div className="min-w-0">
            <div className={`text-sm font-medium truncate ${selected ? "text-delt-accent" : locked ? "text-delt-muted" : "text-delt-text"}`}>
              {family.display}
              {locked && <span className="ml-1.5 text-[10px]">🔒</span>}
            </div>
            <div className="text-[10px] text-delt-muted truncate">
              DELT choisit automatiquement le bon {family.display} selon la requête
            </div>
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 bg-delt-surface text-delt-muted">
            Auto
          </span>
        </div>
      </button>
    );
  };

  const autoSelected = !selectedId || selectedId === "auto";

  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-delt-muted uppercase tracking-wider mb-3">
        Choisis ta famille préférée
      </div>

      {/* Option Auto — toutes marques */}
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors mb-3 ${
          autoSelected
            ? "border-delt-accent bg-indigo-50"
            : "border-transparent hover:border-delt-border hover:bg-delt-surface"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-bold truncate ${autoSelected ? "text-delt-accent" : "text-delt-text"}`}>
                Auto · toutes marques
              </div>
              <div className="text-[10px] text-delt-muted truncate">
                DELT choisit la marque ET le tier optimal selon la requête
              </div>
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 bg-delt-accent text-white">
            Recommandé
          </span>
        </div>
      </button>

      <div className="text-[10px] font-bold uppercase tracking-widest text-delt-muted mb-2 px-1">
        Ou force une marque
      </div>

      {isFree && (
        <div className="text-[10px] text-delt-muted mb-3 bg-delt-surface rounded-lg px-3 py-2">
          🔒 Familles grisées disponibles à partir du plan <span className="font-semibold text-delt-text">BASIC</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {PROVIDERS.map((provider) => {
          const models = families.get(provider) ?? [];
          if (models.length === 0) return null;
          return renderFamily(provider, models);
        })}
      </div>
    </div>
  );
}
