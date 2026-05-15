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
};

const TIER_BADGE = {
  FREE: "", UNCENSORED: "badge-venice", PICO: "badge-pico", NANO: "badge-eco", MINI: "badge-mini",
  NORMAL: "badge-normal", EXPERT: "badge-expert", PRO: "badge-pro"
};

const PERIODS = [
  { id: "7d",  label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "90d", label: "90 jours" },
  { id: "all", label: "Tout" },
];

function brandOf(modelId) {
  if (!modelId) return "Autre";
  const first = modelId.split("/")[0]?.toLowerCase();
  const map = {
    openai: "OpenAI", anthropic: "Anthropic", google: "Google",
    mistralai: "Mistral", "meta-llama": "Meta", "x-ai": "xAI",
    perplexity: "Perplexity", cognitivecomputations: "Venice",
    inclusionai: "InclusionAI", "arcee-ai": "Arcee", deepseek: "DeepSeek"
  };
  return map[first] || (first ? first.charAt(0).toUpperCase() + first.slice(1) : "Autre");
}

function displayName(modelId) {
  if (!modelId) return "—";
  const parts = modelId.split("/");
  return parts[parts.length - 1].replace(/:free$/, "").replace(/-/g, " ");
}

function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function MiniBarChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(1, ...data.map((d) => Number(d.cost_cr) || 0));
  return (
    <div className="flex items-end gap-1 h-24 w-full">
      {data.map((d, i) => {
        const cost = Number(d.cost_cr) || 0;
        const h = Math.max(2, (cost / max) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.day} · ${d.calls} appels`}>
            <div
              className="w-full rounded-t-sm transition-all hover:opacity-80"
              style={{
                height: `${h}%`,
                background: "linear-gradient(180deg, #06b6d4, #2563eb)"
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function UsagePage() {
  const [period, setPeriod]   = useState("30d");
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = (p) => {
    setLoading(true);
    api.usage(p)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(period); }, [period]);

  const byBrand = useMemo(() => {
    if (!data?.byModel) return [];
    const map = new Map();
    for (const r of data.byModel) {
      const b = brandOf(r.model_id);
      const prev = map.get(b) || { brand: b, tokens_in: 0, tokens_out: 0, cost_cr: 0, calls: 0 };
      prev.tokens_in  += Number(r.tokens_in)  || 0;
      prev.tokens_out += Number(r.tokens_out) || 0;
      prev.cost_cr    += Number(r.cost_cr)    || 0;
      prev.calls      += Number(r.calls)      || 0;
      map.set(b, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.cost_cr - a.cost_cr);
  }, [data]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-delt-text">Utilisation</h2>
          <p className="text-xs text-delt-muted">Suivi des tokens et modèles utilisés.</p>
        </div>
        <div className="inline-flex p-0.5 rounded-full bg-delt-surface border border-delt-border">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                period === p.id ? "bg-white text-delt-text shadow-sm" : "text-delt-muted hover:text-delt-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading && !data ? (
        <div className="rounded-xl bg-delt-surface p-8 text-center text-sm text-delt-muted">Chargement…</div>
      ) : (
        <>
          {/* Stats globales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Appels", value: fmt(data?.totals?.calls), icon: "📨" },
              { label: "Tokens in", value: fmt(data?.totals?.tokens_in), icon: "↓", colored: "#10b981" },
              { label: "Tokens out", value: fmt(data?.totals?.tokens_out), icon: "↑", colored: "#6366f1" },
              { label: "Tokens total", value: fmt((Number(data?.totals?.tokens_in) || 0) + (Number(data?.totals?.tokens_out) || 0)), icon: "Σ", colored: "#06b6d4" }
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white border border-delt-border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-delt-muted">{s.label}</span>
                  <span className="text-base" style={s.colored ? { color: s.colored } : {}}>{s.icon}</span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-delt-text font-mono">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Graphique journalier */}
          {data?.byDay?.length > 0 && (
            <div className="rounded-2xl bg-white border border-delt-border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold uppercase tracking-widest text-delt-muted">Consommation par jour</div>
                <span className="text-[10px] text-delt-muted">{data.byDay.length} jour{data.byDay.length > 1 ? "s" : ""}</span>
              </div>
              <MiniBarChart data={data.byDay} />
              <div className="flex justify-between text-[10px] text-delt-muted mt-2">
                <span>{data.byDay[0]?.day && new Date(data.byDay[0].day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                <span>{data.byDay[data.byDay.length - 1]?.day && new Date(data.byDay[data.byDay.length - 1].day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
              </div>
            </div>
          )}

          {/* Par marque (donut/résumé) */}
          {byBrand.length > 0 && (
            <div className="rounded-2xl bg-white border border-delt-border p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-delt-muted mb-4">Répartition par marque</div>
              <div className="space-y-2">
                {byBrand.map((b) => {
                  const max = Math.max(1, ...byBrand.map((x) => x.cost_cr));
                  const pct = (b.cost_cr / max) * 100;
                  return (
                    <div key={b.brand}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {BRAND_LOGO[b.brand] ? (
                            <img src={BRAND_LOGO[b.brand]} alt={b.brand} className="w-4 h-4 object-contain flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-delt-surface" />
                          )}
                          <span className="font-bold text-delt-text">{b.brand}</span>
                          <span className="text-delt-muted">{b.calls} appel{b.calls > 1 ? "s" : ""}</span>
                        </div>
                        <span className="font-mono font-bold text-delt-accent">{fmt((Number(b.tokens_in) || 0) + (Number(b.tokens_out) || 0))} tok</span>
                      </div>
                      <div className="w-full h-1.5 bg-delt-surface rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #06b6d4, #2563eb)" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Détail par modèle */}
          {data?.byModel?.length > 0 ? (
            <div className="rounded-2xl bg-white border border-delt-border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-delt-border flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-widest text-delt-muted">Détail par modèle</div>
                <span className="text-[10px] text-delt-muted">{data.byModel.length} modèle{data.byModel.length > 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-delt-surface border-b border-delt-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-delt-muted">Modèle</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-delt-muted">Tier</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-delt-muted">Appels</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-delt-muted">Tokens in</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-delt-muted">Tokens out</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-delt-accent">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-delt-border">
                    {data.byModel.map((m) => {
                      const brand = brandOf(m.model_id);
                      return (
                        <tr key={m.model_id} className="hover:bg-delt-surface transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {BRAND_LOGO[brand] && (
                                <img src={BRAND_LOGO[brand]} alt={brand} className="w-4 h-4 object-contain flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-delt-text capitalize">{displayName(m.model_id)}</div>
                                <div className="text-[10px] text-delt-muted font-mono truncate">{m.model_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {m.tier && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${TIER_BADGE[m.tier] ?? ""}`}>
                                {m.tier}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-delt-text">{fmt(m.calls)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-delt-muted">{fmt(m.tokens_in)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-delt-muted">{fmt(m.tokens_out)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-delt-accent whitespace-nowrap">
                            {fmt((Number(m.tokens_in) || 0) + (Number(m.tokens_out) || 0))} tok
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            !loading && (
              <div className="rounded-2xl bg-delt-surface p-8 text-center">
                <div className="text-sm text-delt-muted mb-1">Aucune utilisation sur cette période.</div>
                <div className="text-xs text-delt-muted/70">Lance une conversation pour voir les stats apparaître.</div>
              </div>
            )
          )}

          {/* Historique récent */}
          {data?.recent?.length > 0 && (
            <div className="rounded-2xl bg-white border border-delt-border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-delt-border text-xs font-bold uppercase tracking-widest text-delt-muted">
                20 derniers appels
              </div>
              <div className="divide-y divide-delt-border">
                {data.recent.map((r, i) => {
                  const brand = brandOf(r.model_id);
                  return (
                    <div key={i} className="px-4 py-2 flex items-center gap-3 hover:bg-delt-surface text-xs">
                      {BRAND_LOGO[brand] && (
                        <img src={BRAND_LOGO[brand]} alt={brand} className="w-4 h-4 object-contain flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[11px] text-delt-text truncate">{r.model_id}</div>
                        <div className="text-[10px] text-delt-muted">
                          {new Date(r.created_at).toLocaleString("fr-FR")}
                          {r.source && <span className="ml-2 px-1 py-0.5 rounded bg-delt-surface font-mono">{r.source}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-delt-muted">
                          ↓{fmt(r.tokens_in)} ↑{fmt(r.tokens_out)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
