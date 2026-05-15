import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";

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
};

const TIER_ORDER = ["FREE", "UNCENSORED", "PICO", "NANO", "MINI", "NORMAL", "EXPERT", "PRO"];

const TIER_INFO = {
  FREE:       { label: "Free",        desc: "Modèles 100 % gratuits — usage léger" },
  UNCENSORED: { label: "Uncensored",  desc: "Modèle non censuré (18+)" },
  PICO:       { label: "Pico",        desc: "Ultra rapide, ultra cheap — 0,10 Cr/1k" },
  NANO:       { label: "Nano",        desc: "Questions simples — 0,20 Cr/1k" },
  MINI:       { label: "Mini",        desc: "Tâches standard — 0,40 Cr/1k" },
  NORMAL:     { label: "Normal",      desc: "Questions complexes — 4 Cr/1k" },
  EXPERT:     { label: "Expert",      desc: "Analyse profonde, raisonnement — 8 Cr/1k" },
  PRO:        { label: "Pro",         desc: "Le top du top — 50 Cr/1k" }
};

const TIER_BADGE = {
  FREE: "", UNCENSORED: "badge-venice", PICO: "badge-pico", NANO: "badge-eco",
  MINI: "badge-mini", NORMAL: "badge-normal", EXPERT: "badge-expert", PRO: "badge-pro"
};

const BRAND_LABEL = {
  OpenAI: "GPT",
  Anthropic: "Claude",
  Google: "Gemini",
  Meta: "Llama",
  xAI: "Grok",
  InclusionAI: "Inclusion"
};

export default function ModelPreferencesPage({ user, onSaved, isOnboarding = false }) {
  const [catalog, setCatalog]   = useState(null);
  const [prefs, setPrefs]       = useState({});
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    Promise.all([api.catalog(), api.getModelPreferences()])
      .then(([cat, p]) => {
        setCatalog(cat);
        // Init avec préférences existantes ou premier modèle de chaque tier
        const initial = { ...(p.preferences || {}) };
        for (const tier of TIER_ORDER) {
          if (!initial[tier]) {
            const first = cat.categories?.[tier]?.models?.[0];
            if (first) initial[tier] = first.id;
          }
        }
        setPrefs(initial);
      })
      .catch((e) => setError(e.message));
  }, []);

  const select = (tier, modelId) => {
    setPrefs((p) => ({ ...p, [tier]: modelId }));
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await api.setModelPreferences(prefs);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const tiers = useMemo(() => {
    if (!catalog?.categories) return [];
    return TIER_ORDER
      .filter((t) => (catalog.categories[t]?.models?.length || 0) > 0)
      .map((tier) => {
        const brands = [];
        const seen = new Set();
        for (const model of catalog.categories[tier].models) {
          if (model.adult || seen.has(model.brand)) continue;
          seen.add(model.brand);
          brands.push(model);
        }
        return { tier, models: brands };
      });
  }, [catalog]);

  if (!catalog) {
    return <div className="p-8 text-center text-sm text-delt-muted">Chargement du catalogue…</div>;
  }

  return (
    <div className={isOnboarding ? "min-h-screen bg-white flex flex-col" : ""}>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 w-full">

        {/* Hero */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-md mb-3"
            style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-delt-text tracking-tight">
            {isOnboarding ? "Choisis tes modèles préférés" : "Modèles par défaut"}
          </h1>
          <p className="text-sm text-delt-muted mt-2 max-w-xl mx-auto">
            En mode <strong className="text-delt-text">auto</strong>, DELT choisit le tier optimal pour ta question.
            Sélectionne la famille <strong className="text-delt-text">par défaut</strong> pour chaque niveau.
            DELT choisit automatiquement la variante exacte adaptée.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-4">{error}</div>
        )}

        {/* Tiers */}
        <div className="space-y-5">
          {tiers.map(({ tier, models }) => {
            const info = TIER_INFO[tier] || { label: tier, desc: "" };
            const selectedId = prefs[tier];
            const selectedModel = catalog.categories?.[tier]?.models?.find((m) => m.id === selectedId);
            return (
              <div key={tier} className="rounded-2xl bg-white border border-delt-border p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${TIER_BADGE[tier] ?? ""}`}>
                      {info.label.toUpperCase()}
                    </span>
                    <span className="text-xs text-delt-muted">{info.desc}</span>
                  </div>
                  <span className="text-[10px] text-delt-muted">{models.length} famille{models.length > 1 ? "s" : ""}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {models.map((m) => {
                    const selected = selectedId === m.id || selectedModel?.brand === m.brand;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => select(tier, m.id)}
                        className={`text-left rounded-xl p-3 border-2 transition-all flex items-center gap-3 ${
                          selected
                            ? "border-delt-accent bg-indigo-50 shadow-sm"
                            : "border-delt-border bg-white hover:border-delt-text/30"
                        }`}
                      >
                        {BRAND_LOGO[m.brand] ? (
                          <img src={BRAND_LOGO[m.brand]} alt={m.brand} className="w-7 h-7 object-contain flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-delt-surface flex items-center justify-center text-xs font-bold text-delt-muted">
                            {m.brand?.charAt(0) || "?"}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-bold truncate ${selected ? "text-delt-accent" : "text-delt-text"}`}>
                            {BRAND_LABEL[m.brand] || m.brand}
                          </div>
                          <div className="text-[11px] text-delt-muted truncate">Sélection automatique</div>
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
            );
          })}
        </div>

        {/* CTA */}
        <div className={`mt-6 ${isOnboarding ? "sticky bottom-0 -mx-3 sm:-mx-6 px-3 sm:px-6 py-4 bg-white border-t border-delt-border" : ""}`}>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}
          >
            {saving ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
                </svg>
                Enregistrement…
              </>
            ) : savedFlash ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Enregistré ✓
              </>
            ) : (
              isOnboarding ? "Confirmer et accéder au chat →" : "Enregistrer les préférences"
            )}
          </button>
          {isOnboarding && (
            <button
              type="button"
              onClick={onSaved}
              className="w-full mt-2 text-xs text-delt-muted hover:text-delt-text font-medium"
            >
              Plus tard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
