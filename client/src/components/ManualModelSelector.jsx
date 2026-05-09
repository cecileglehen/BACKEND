import { useMemo } from "react";

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "Mistral", "xAI", "Perplexity", "DeepSearch", "Venice", "InclusionAI"];

const BADGES = {
  FREE: "",
  UNCENSORED: "badge-venice",
  NANO: "badge-eco",
  MINI: "badge-mini",
  NORMAL: "badge-normal",
  PRICE: "badge-price",
  EXPERT: "badge-expert"
};

export default function ManualModelSelector({ catalog, selectedId, onSelect }) {
  const grouped = useMemo(() => {
    const map = Object.fromEntries(PROVIDERS.map((provider) => [provider, []]));
    if (!catalog?.categories) return map;

    for (const [tier, category] of Object.entries(catalog.categories)) {
      for (const model of category.models) {
        const provider = map[model.brand] ? model.brand : "OpenAI";
        map[provider].push({ ...model, tier, cost: category.cost });
      }
    }

    return map;
  }, [catalog]);

  if (!catalog) {
    return (
      <div className="card p-4 text-xs text-delt-muted">
        Chargement des modèles…
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-delt-muted uppercase tracking-wider mb-3">Modèle manuel</div>
      <div className="space-y-2">
        {PROVIDERS.map((provider) => {
          const models = grouped[provider] ?? [];
          if (models.length === 0) return null;

          return (
            <details key={provider} open={provider === "OpenAI"} className="group rounded-lg border border-delt-border bg-white">
              <summary className="list-none cursor-pointer px-3 py-2 flex items-center justify-between text-sm font-semibold text-delt-text">
                <span>{provider}</span>
                <span className="text-[10px] text-delt-muted">{models.length}</span>
              </summary>
              <div className="border-t border-delt-border p-1.5 space-y-1">
                {models.map((model) => {
                  const selected = selectedId === model.id;

                  return (
                    <button
                      key={model.id}
                      onClick={() => onSelect(model)}
                      className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${
                        selected
                          ? "border-delt-accent bg-indigo-50"
                          : "border-transparent hover:border-delt-border hover:bg-delt-surface"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate ${selected ? "text-delt-accent" : "text-delt-text"}`}>
                            {model.display}
                          </div>
                          <div className="text-[10px] text-delt-muted font-mono truncate">{model.id}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BADGES[model.tier] ?? ""}`}>
                            {model.tier}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
