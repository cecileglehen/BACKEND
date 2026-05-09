import { useMemo, useState } from "react";

const BRANDS = ["OpenAI", "Anthropic", "Google", "Mistral", "Meta", "xAI", "Perplexity", "DeepSearch", "Venice", "InclusionAI"];

const CAT_STYLE = {
  FREE: "",
  UNCENSORED: "badge-venice",
  NANO: "badge-eco",
  ECO: "badge-eco",
  MINI: "badge-mini",
  NORMAL: "badge-normal",
  PRICE: "badge-price",
  EXPERT: "badge-expert"
};

export default function ModelPicker({ catalog, selected, onSelect, disabled }) {
  const [brand, setBrand] = useState("All");

  const flat = useMemo(() => {
    if (!catalog) return [];
    return Object.entries(catalog.categories).flatMap(([key, cat]) =>
      cat.models.map((m) => ({ ...m, category: key, cost: cat.cost, catLabel: cat.label }))
    );
  }, [catalog]);

  const filtered = brand === "All" ? flat : flat.filter((m) => m.brand === brand);

  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-delt-muted uppercase tracking-wider mb-3">
        Sélection du modèle
      </div>

      {/* Filtres marques */}
      <div className="flex flex-wrap gap-1 mb-3">
        {["All", ...BRANDS].map((b) => (
          <button
            key={b}
            onClick={() => setBrand(b)}
            className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
              brand === b
                ? "bg-delt-text text-white border-delt-text"
                : "border-delt-border text-delt-muted hover:border-delt-text hover:text-delt-text bg-white"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Liste modèles */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {filtered.map((m) => {
          const active = selected === m.id;
          return (
            <button
              key={m.id}
              disabled={disabled}
              onClick={() => onSelect(m.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                active
                  ? "border-delt-accent bg-indigo-50"
                  : "border-delt-border bg-white hover:border-slate-300 hover:bg-delt-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-sm font-medium ${active ? "text-delt-accent" : "text-delt-text"}`}>
                    {m.display}
                  </div>
                  <div className="text-xs text-delt-muted mt-0.5">{m.brand}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CAT_STYLE[m.category]}`}>
                    {m.catLabel}
                  </span>
                  <span className="text-[10px] text-delt-muted">{m.cost} cr.</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
