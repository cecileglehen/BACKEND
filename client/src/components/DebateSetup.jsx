import { useMemo, useState } from "react";
import { useT } from "../lib/i18n.jsx";
import { BRAND_LOGO, BRAND_LABEL } from "../lib/brands.js";

const FALLBACK_FAMILIES = ["OpenAI", "Anthropic", "Google", "Mistral", "xAI", "Meta", "Perplexity"].map((brand) => ({
  role: "debater",
  modelId: `brand:${encodeURIComponent(brand)}`,
  tier: "NORMAL",
  model: {
    id: `brand:${encodeURIComponent(brand)}`,
    brand,
    display: BRAND_LABEL[brand] || brand
  }
}));

export default function DebateSetup({ catalog, onStart, onClose }) {
  const t = useT();
  const [rounds, setRounds] = useState(10);

  const families = useMemo(() => {
    if (!catalog?.categories) return FALLBACK_FAMILIES;
    const byBrand = new Map();
    for (const tier of ["NANO", "MINI", "NORMAL", "EXPERT", "PRO"]) {
      const cat = catalog.categories[tier];
      if (!cat) continue;
      for (const model of cat.models || []) {
        if (model.adult || byBrand.has(model.brand)) continue;
        byBrand.set(model.brand, {
          role: "debater",
          modelId: `brand:${encodeURIComponent(model.brand)}`,
          tier: "NORMAL",
          model: {
            id: `brand:${encodeURIComponent(model.brand)}`,
            brand: model.brand,
            display: BRAND_LABEL[model.brand] || model.brand
          }
        });
      }
    }
    const list = Array.from(byBrand.values());
    return list.length >= 2 ? list : FALLBACK_FAMILIES;
  }, [catalog]);

  const defaults = useMemo(() => {
    const wanted = ["OpenAI", "Anthropic", "Google"];
    const picked = wanted.map((brand) => families.find((f) => f.model.brand === brand)).filter(Boolean);
    return picked.length >= 2 ? picked : families.slice(0, 3);
  }, [families]);

  const [selectedIds, setSelectedIds] = useState([]);
  const selected = (selectedIds.length ? selectedIds : defaults.map((f) => f.modelId))
    .map((id) => families.find((f) => f.modelId === id))
    .filter(Boolean)
    .slice(0, 3);

  const toggle = (family) => {
    const active = selectedIds.length ? selectedIds : defaults.map((f) => f.modelId);
    if (active.includes(family.modelId)) {
      if (active.length <= 2) return;
      setSelectedIds(active.filter((id) => id !== family.modelId));
      return;
    }
    if (active.length >= 3) return;
    setSelectedIds([...active, family.modelId]);
  };

  const start = () => {
    if (selected.length < 2) return;
    onStart({
      mode: "iterative",
      rounds,
      agents: selected
    });
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdropFade">
      <div onClick={(e) => e.stopPropagation()} className="glass-strong w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col max-h-[92vh] animate-slideUp">
        <div className="px-5 py-4 border-b border-delt-border flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-delt-text tracking-tight flex items-center gap-2">
              <span>🎭</span> {t("debate.title")}
            </h2>
            <p className="text-xs text-delt-muted">{t("debate.subtitle")}</p>
          </div>
          <button onClick={onClose} className="text-delt-muted hover:text-delt-text text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase tracking-widest text-delt-muted">{t("debate.agents_label")}</div>
              <div className="text-[11px] text-delt-muted">{selected.length}/3</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {families.map((family) => {
                const picked = selected.some((s) => s.modelId === family.modelId);
                const disabled = !picked && selected.length >= 3;
                const logo = BRAND_LOGO[family.model.brand];
                return (
                  <button
                    key={family.modelId}
                    type="button"
                    onClick={() => !disabled && toggle(family)}
                    disabled={disabled}
                    className={`rounded-xl border-2 px-3 py-3 text-left transition-all flex items-center gap-2 ${
                      picked
                        ? "border-delt-accent bg-indigo-50"
                        : disabled
                        ? "border-delt-border bg-delt-surface opacity-40 cursor-not-allowed"
                        : "border-delt-border bg-white hover:border-delt-text/30"
                    }`}
                  >
                    {logo && <img src={logo} alt={family.model.brand} className="w-6 h-6 object-contain flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className={`text-sm font-bold truncate ${picked ? "text-delt-accent" : "text-delt-text"}`}>
                        {family.model.display}
                      </div>
                      <div className="text-[10px] text-delt-muted truncate">{t("debate.auto_router")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase tracking-widest text-delt-muted">{t("debate.length_label")}</div>
              <div className="text-xs font-mono text-delt-text">{t("debate.messages", { n: rounds })}</div>
            </div>
            <input
              type="range"
              min="4"
              max="12"
              step="1"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="w-full accent-delt-accent"
            />
            <div className="flex justify-between text-[10px] text-delt-muted mt-1">
              <span>{t("debate.short")}</span>
              <span>{t("debate.medium")}</span>
              <span>{t("debate.long")}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-delt-border bg-delt-surface px-4 py-3 text-sm text-delt-text">
            {t("debate.explanation")}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-delt-border flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[11px] text-delt-muted">{t("debate.credit_note")}</span>
          <button
            onClick={start}
            disabled={selected.length < 2}
            className="px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-md hover:shadow-lg disabled:opacity-40 transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #ec4899)" }}
          >
            {t("debate.activate")}
          </button>
        </div>
      </div>
    </div>
  );
}
