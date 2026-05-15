import { useEffect, useMemo, useState } from "react";

const BRAND_LOGO = {
  OpenAI:     "/brands/openai.svg",
  Google:     "/brands/gemini-color.svg",
  Anthropic:  "/brands/claude-color.svg",
  Mistral:    "/brands/mistral-color.svg",
  Meta:       "/brands/meta-color.svg",
  xAI:        "/brands/grok.svg",
  Perplexity: "/brands/perplexity-color.svg",
  InclusionAI:"/brands/antgroup-color.svg",
  DeepSeek:   "/brands/deepseek-color.svg",
  Arcee:      "/brands/arcee-color.png"
};

const TIER_ORDER = ["FREE", "UNCENSORED", "PICO", "NANO", "MINI", "NORMAL", "EXPERT", "PRO"];
const MAX_MODELS = 4;
const BRAND_LABEL = {
  OpenAI: "GPT",
  Anthropic: "Claude",
  Google: "Gemini",
  Meta: "Llama",
  xAI: "Grok",
  InclusionAI: "Inclusion"
};

export default function ParallelPicker({ catalog, selected, onChange, onClose }) {
  const [picks, setPicks] = useState(selected || []);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const allModels = useMemo(() => {
    if (!catalog?.categories) return [];
    const byBrand = new Map();
    for (const tier of TIER_ORDER) {
      const cat = catalog.categories[tier];
      if (!cat) continue;
      for (const m of cat.models) {
        if (m.adult) continue;
        if (!byBrand.has(m.brand)) byBrand.set(m.brand, []);
        byBrand.get(m.brand).push({ ...m, tier, cost: cat.cost });
      }
    }
    return Array.from(byBrand.entries()).map(([brand, models]) => {
      const normal = models.find((m) => m.tier === "NORMAL") || models.find((m) => m.tier !== "FREE") || models[0];
      return {
        id: `brand:${encodeURIComponent(brand)}`,
        brand,
        display: BRAND_LABEL[brand] || brand,
        tier: normal?.tier || "NORMAL",
        isBrandFamily: true
      };
    });
  }, [catalog]);

  const toggle = (model) => {
    const isSelected = picks.find((p) => p.id === model.id);
    if (isSelected) {
      setPicks(picks.filter((p) => p.id !== model.id));
    } else if (picks.length < MAX_MODELS) {
      setPicks([...picks, model]);
    }
  };

  const confirm = () => {
    onChange(picks);
    onClose();
  };

  const clear = () => setPicks([]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdropFade"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-delt-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-delt-text tracking-tight">Comparaison parallèle</h2>
            <p className="text-xs text-delt-muted">Envoie ta question à 2-4 modèles en même temps</p>
          </div>
          <button onClick={onClose} className="text-delt-muted hover:text-delt-text text-2xl leading-none">✕</button>
        </div>

        {/* Selected chips */}
        <div className="px-5 py-3 border-b border-delt-border bg-delt-surface min-h-[3rem]">
          {picks.length === 0 ? (
            <div className="text-xs text-delt-muted">Aucun modèle sélectionné. Choisis-en jusqu'à {MAX_MODELS}.</div>
          ) : (
            <div className="flex flex-wrap gap-2 items-center">
              {picks.map((m, i) => (
                <div key={m.id} className="flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-full bg-white border border-delt-accent text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-delt-accent">
                    {i + 1}
                  </span>
                  {BRAND_LOGO[m.brand] && (
                    <img src={BRAND_LOGO[m.brand]} alt={m.brand} className="w-3.5 h-3.5 object-contain" />
                  )}
                  <span className="font-bold text-delt-text">{m.display}</span>
                  <button
                    onClick={() => toggle(m)}
                    className="w-4 h-4 rounded-full bg-delt-surface hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-delt-muted ml-0.5"
                  >
                    <svg viewBox="0 0 12 12" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="2" y1="2" x2="10" y2="10"/>
                      <line x1="10" y1="2" x2="2" y2="10"/>
                    </svg>
                  </button>
                </div>
              ))}
              {picks.length > 0 && (
                <button onClick={clear} className="text-[11px] text-delt-muted hover:text-red-600 font-semibold ml-1">
                  Tout effacer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Models grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {allModels.map((m) => {
              const selected = picks.find((p) => p.id === m.id);
              const disabled = !selected && picks.length >= MAX_MODELS;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => !disabled && toggle(m)}
                  disabled={disabled}
                  className={`text-left rounded-xl p-2.5 border-2 transition-all flex items-center gap-2.5 ${
                    selected
                      ? "border-delt-accent bg-indigo-50"
                      : disabled
                      ? "border-delt-border bg-delt-surface opacity-40 cursor-not-allowed"
                      : "border-delt-border bg-white hover:border-delt-text/30"
                  }`}
                >
                  {BRAND_LOGO[m.brand] ? (
                    <img src={BRAND_LOGO[m.brand]} alt={m.brand} className="w-7 h-7 object-contain flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-delt-surface flex items-center justify-center text-[10px] font-bold text-delt-muted">
                      {m.brand?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-bold truncate ${selected ? "text-delt-accent" : "text-delt-text"}`}>{m.display}</div>
                    <div className="text-[10px] text-delt-muted truncate">{m.brand} · {m.tier}</div>
                  </div>
                  {selected && (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-delt-border flex items-center justify-between gap-3 bg-white">
          <div className="text-[11px] text-delt-muted">
            {picks.length}/{MAX_MODELS} modèle{picks.length > 1 ? "s" : ""}
            {picks.length >= 2 && " · prêt à comparer"}
          </div>
          <button
            onClick={confirm}
            disabled={picks.length < 2 && picks.length !== 0}
            className="px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ background: picks.length >= 2 || picks.length === 0 ? "linear-gradient(135deg, #6366f1, #06b6d4)" : "#94a3b8" }}
          >
            {picks.length === 0 ? "Désactiver" : picks.length < 2 ? "Sélectionne ≥ 2" : `Confirmer (×${picks.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
