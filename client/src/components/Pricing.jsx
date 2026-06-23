import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { api } from "../lib/api.js";
import { useToast } from "../contexts/ToastContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useT } from "../lib/i18n.jsx";

const PLAN_RANK = { FREE: 0, BASIC: 1, PLUS: 2, PRO: 3, ULTRA: 4 };

// Tous les plans payants donnent accès à TOUTES les fonctionnalités.
// La seule différence : le volume d'usage mensuel inclus.
const ALL_FEATURES = [
  { text: "Tous les LLMs",              sub: "GPT, Claude, Gemini, Grok, Mistral, Llama, DeepSeek…" },
  { text: "Modèles de raisonnement (CoT)" },
  { text: "Génération d'images",        sub: "FLUX, GPT Image, Nano Banana Pro…" },
  { text: "Génération vidéo",           sub: "Seedance 2 (ByteDance)" },
  { text: "Génération musicale",        sub: "Suno V5.5 (2 pistes / génération)" },
  { text: "Recherche Web approfondie",  sub: "Perplexity Sonar + Google" },
  { text: "Agents IA personnalisés",    sub: "1 · 2 · 6 · 20 agents + fichiers de connaissances (RAG) selon le plan" },
  { text: "Accès API directe DELT",     sub: "Compatible OpenAI SDK" },
];

const PLANS = [
  {
    key: "BASIC",
    label: "Starter",
    subtitle: "Pour découvrir DELT AI",
    price: 10,
    multiplier: null,
    agents: 1, knowledge: "20 Mo",
    dark: true,
  },
  {
    key: "PLUS",
    label: "Standard",
    subtitle: "2,5× plus d'usage que Starter",
    price: 23,
    multiplier: "2,5×",
    agents: 2, knowledge: "75 Mo",
    popular: true,
  },
  {
    key: "PRO",
    label: "Expert",
    subtitle: "8,5× plus d'usage que Starter",
    price: 75,
    multiplier: "8,5×",
    agents: 6, knowledge: "200 Mo",
  },
  {
    key: "ULTRA",
    label: "Entreprise",
    subtitle: "25× plus d'usage que Starter",
    price: 200,
    multiplier: "25×",
    agents: 20, knowledge: "1 Go",
  },
];

const CATEGORY_TABLE = [
  { cat: "FREE",       models: "Ring 2.6 1T · Gemma 4 31B · GPT OSS 120B · Trinity Thinking · DeepSeek V4 Flash (free)",       badge: "" },
  { cat: "UNCENSORED", models: "Venice Dolphin Mistral 24B",                                                                    badge: "badge-venice" },
  { cat: "PICO",       models: "Gemini 2.5 Flash Lite · DeepSeek V4 Flash",                                                     badge: "badge-pico" },
  { cat: "NANO",       models: "Mistral Small 4 · GPT-4o Mini · GPT-5.4 Nano · Gemini 2.5 Flash",                              badge: "badge-eco" },
  { cat: "MINI",       models: "Mistral Large 3 · Mixtral 8x22B · GPT-5.4 Mini · Llama 4 Maverick · Gemini 3.1 Flash Lite · Claude Haiku 4.5 · Grok 4.20 · Grok 4.3", badge: "badge-mini" },
  { cat: "NORMAL",     models: "GPT-5.4 · Claude Sonnet 4.5 · Mistral Large · Sonar Web Search",                                            badge: "badge-normal" },
  { cat: "EXPERT",     models: "GPT-5.5 · Claude Fable 5 (très cher) · Claude Opus 4.8 · Grok 4.20 Multi-Agent · Sonar Deep Research", badge: "badge-expert" },
  { cat: "PRO",        models: "GPT-5.4 Pro · GPT-5.5 Pro",                                                                    badge: "badge-pro" },
];

const IMAGE_TABLE = [
  { name: "FLUX Schnell",    brand: "Black Forest Labs", tag: "Quotidien · éco" },
  { name: "Nano Banana",     brand: "Google",            tag: "Bonne qualité" },
  { name: "GPT Image Mini",  brand: "OpenAI",            tag: "Bon ratio qualité/prix" },
  { name: "Nano Banana 2",   brand: "Google",            tag: "Rendu presque parfait" },
  { name: "Nano Banana Pro", brand: "Google",            tag: "Rendu parfait" },
  { name: "GPT Image",       brand: "OpenAI",            tag: "Haut de gamme" },
  { name: "GPT Image 2",     brand: "OpenAI",            tag: "Texte parfait · rendu pro" },
];

const VIDEO_TABLE = [
  { name: "Seedance 2", brand: "ByteDance", tag: "Vidéo 720p — text-to-video" },
];

function CheckIcon({ ok }) {
  if (ok) return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" className="flex-shrink-0 mt-0.5">
      <path d="M4 10l4 4 8-8" stroke="#06b6d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" className="flex-shrink-0 mt-0.5 opacity-30">
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function Pricing({ user, onSubscribed }) {
  const toast = useToast();
  const t = useT();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.paypalConfig()
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="text-red-600 text-sm">Impossible de charger PayPal : {error}</p>
    </div>
  );

  if (!config) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="text-delt-muted text-sm">{t("pricing.loading")}</p>
    </div>
  );

  return (
    <PayPalScriptProvider options={{ clientId: config.clientId, vault: true, intent: "subscription", components: "buttons" }}>
      <PricingContent user={user} config={config} onSubscribed={onSubscribed} />
    </PayPalScriptProvider>
  );
}

function PricingContent({ user, config, onSubscribed }) {
  const t = useT();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-extrabold mb-3 tracking-tight text-gradient">{t("pricing.heading")}</h1>
        <p className="text-lg text-delt-muted mb-8">{t("pricing.tagline")}</p>

        {config.mode === "sandbox" && (
          <div className="mb-6 inline-block text-xs px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
            {t("pricing.sandbox")}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const planId = config.plans[plan.key];
          const isCurrent = user?.plan === plan.key;
          const userRank = PLAN_RANK[user?.plan] ?? 0;
          const planRank = PLAN_RANK[plan.key] ?? 0;
          const isLower = planRank < userRank;
          const price = plan.price;

          return (
            <div
              key={plan.key}
              className={`relative rounded-3xl p-7 flex flex-col gap-5 transition-shadow ${
                plan.dark
                  ? "text-white shadow-xl shadow-blue-900/20"
                  : "glass-card"
              } ${plan.popular ? "ring-2 ring-indigo-400/50 shadow-[0_20px_50px_-20px_rgba(99,102,241,0.45)]" : ""} ${isLower ? "opacity-50" : ""}`}
              style={plan.dark ? { background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)" } : {}}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="text-white text-xs font-bold px-4 py-1.5 rounded-full shadow"
                    style={{ background: "linear-gradient(90deg,#2563eb,#06b6d4)" }}>
                    Le plus populaire
                  </span>
                </div>
              )}

              {/* Plan name + subtitle */}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className={`text-2xl font-bold ${plan.dark ? "text-white" : "text-slate-900"}`}>
                    {plan.label}
                  </h2>
                  {plan.multiplier && (
                    <span
                      className="text-xs font-extrabold px-2 py-0.5 rounded-md text-white shadow-sm"
                      style={{ background: "linear-gradient(90deg,#2563eb,#06b6d4)" }}
                    >
                      {plan.multiplier}
                    </span>
                  )}
                </div>
                <p className={`text-sm ${plan.dark ? "text-blue-200" : "text-slate-500"}`}>{plan.subtitle}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                    plan.dark ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Tout est dispo
                  </div>
                  {plan.agents != null && (
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      plan.dark ? "bg-white/15 text-white" : "bg-indigo-50 text-indigo-700"
                    }`}>
                      🤖 {plan.agents} agent{plan.agents > 1 ? "s" : ""}
                    </div>
                  )}
                  {plan.knowledge && (
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      plan.dark ? "bg-white/15 text-white" : "bg-cyan-50 text-cyan-700"
                    }`}>
                      📄 {plan.knowledge}
                    </div>
                  )}
                </div>
              </div>

              {/* Price */}
              <div>
                <div className="flex items-end gap-1">
                  <span className={`text-5xl font-extrabold ${plan.dark ? "text-white" : "text-slate-900"}`}>
                    {price} €
                  </span>
                  <span className={`text-sm mb-2 ${plan.dark ? "text-blue-200" : "text-slate-500"}`}>/mois (TTC)</span>
                </div>
                <p className={`text-xs mt-1 ${plan.dark ? "text-blue-300" : "text-slate-400"}`}>
                  {t("pricing.cancel_anytime")}
                </p>
              </div>

              {/* CTA */}
              <div className="w-full" style={{ minHeight: 48 }}>
                {isCurrent ? (
                  <button className="w-full py-3 rounded-2xl text-sm font-semibold opacity-50 cursor-not-allowed border border-current" disabled>
                    Plan actuel
                  </button>
                ) : isLower ? (
                  <button className="w-full py-3 rounded-2xl text-sm font-semibold opacity-40 cursor-not-allowed border border-current" disabled>
                    🔒 Plan inférieur
                  </button>
                ) : !planId ? (
                  <button
                    className="w-full py-3 rounded-2xl text-sm font-semibold border border-current transition-opacity hover:opacity-80"
                    style={plan.dark ? { color: "white", borderColor: "white" } : { color: "#1e3a8a", borderColor: "#1e3a8a" }}
                    onClick={() => toast.info("Contacte-nous pour activer ce plan.")}
                  >
                    S'abonner
                  </button>
                ) : (
                  <PayPalButtons
                    key={`${plan.key}-${config.mode}`}
                    style={{ shape: "pill", color: plan.dark ? "white" : "blue", layout: "vertical", label: "subscribe", height: 45 }}
                    createSubscription={(_d, actions) => actions.subscription.create({ plan_id: planId })}
                    onApprove={async (data) => {
                      try {
                        await api.activateSubscription(plan.key, data.subscriptionID);
                        onSubscribed?.(plan.key);
                      } catch (e) {
                        toast.error("Erreur d'activation : " + e.message);
                      }
                    }}
                    onError={(err) => {
                      console.error("[paypal]", err);
                      toast.error("Erreur PayPal : " + (err.message || JSON.stringify(err)));
                    }}
                  />
                )}
              </div>

              {/* Features — identiques pour tous les plans payants */}
              <div className="pt-3 border-t border-current/10">
                <div className={`text-[11px] font-semibold uppercase tracking-widest mb-3 ${plan.dark ? "text-blue-200" : "text-slate-500"}`}>
                  Tout est inclus
                </div>
                <ul className="flex flex-col gap-2.5">
                  {ALL_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckIcon ok={true} />
                      <div>
                        <span className={`text-sm font-semibold ${plan.dark ? "text-white" : "text-slate-800"}`}>
                          {f.text}
                        </span>
                        {f.sub && (
                          <div className={`text-xs mt-0.5 ${plan.dark ? "text-blue-200" : "text-slate-500"}`}>{f.sub}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Catalogue modèles — simplifié, juste la liste, plus de "consommation" */}
      <div>
        <h2 className="text-2xl font-bold text-delt-text mb-2">{t("pricing.included_title")}</h2>
        <p className="text-sm text-delt-muted mb-5">
          <span dangerouslySetInnerHTML={{ __html: t("pricing.included_sub").replace("<strong>", "<strong class=\"text-delt-text\">") }} />
          Le routeur auto choisit le meilleur selon ta question.
        </p>
        <div className="rounded-2xl glass-card overflow-x-auto">
          <table className="min-w-[500px] w-full text-sm">
            <thead className="bg-white/40 border-b border-delt-border/70">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_category")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_models")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-delt-border">
              {CATEGORY_TABLE.map((row) => (
                <tr key={row.cat} className="hover:bg-white/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${row.badge}`}>{row.cat}</span>
                  </td>
                  <td className="px-5 py-3.5 text-delt-muted font-mono text-xs">{row.models}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Images */}
      <div>
        <h2 className="text-2xl font-bold text-delt-text mb-2">{t("pricing.image_title")}</h2>
        <p className="text-sm text-delt-muted mb-5">{t("pricing.image_sub")}</p>
        <div className="rounded-2xl glass-card overflow-x-auto">
          <table className="min-w-[500px] w-full text-sm">
            <thead className="bg-white/40 border-b border-delt-border/70">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_model")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_provider")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_usage")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-delt-border">
              {IMAGE_TABLE.map((row) => (
                <tr key={row.name} className="hover:bg-white/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-delt-text">{row.name}</td>
                  <td className="px-5 py-3.5 text-delt-muted">{row.brand}</td>
                  <td className="px-5 py-3.5 text-delt-muted text-xs">{row.tag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vidéo */}
      <div>
        <h2 className="text-2xl font-bold text-delt-text mb-2">{t("pricing.video_title")}</h2>
        <p className="text-sm text-delt-muted mb-5">{t("pricing.video_sub")}</p>
        <div className="rounded-2xl glass-card overflow-x-auto">
          <table className="min-w-[500px] w-full text-sm">
            <thead className="bg-white/40 border-b border-delt-border/70">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_model")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_provider")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_resolution")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-delt-border">
              {VIDEO_TABLE.map((row) => (
                <tr key={row.name} className="hover:bg-white/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-delt-text">{row.name}</td>
                  <td className="px-5 py-3.5 text-delt-muted">{row.brand}</td>
                  <td className="px-5 py-3.5 text-delt-muted text-xs">720p</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top-up / PAYG */}
      <TopUpSection user={user} />

    </div>
  );
}

function TopUpSection({ user }) {
  const t = useT();
  const toast = useToast();
  const { refreshQuota } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [packs, setPacks] = useState([]);
  const [busy, setBusy] = useState(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    api.creditPacks().then(({ packs }) => setPacks(packs || [])).catch(() => {});
  }, []);

  // Retour PayPal : ?topup=success&token=<orderId> → capture
  useEffect(() => {
    const topup = searchParams.get("topup");
    const token = searchParams.get("token");
    if (topup === "success" && token && !capturing) {
      setCapturing(true);
      api.captureCreditOrder(token)
        .then((r) => {
          toast.success(t("topup.success", { credits: r.credits }));
          refreshQuota?.();
        })
        .catch((e) => toast.error(e.message))
        .finally(() => {
          setCapturing(false);
          setSearchParams({}, { replace: true });
        });
    } else if (topup === "cancel") {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const buy = async (packId) => {
    setBusy(packId);
    try {
      const { approveUrl } = await api.createCreditOrder(packId);
      if (approveUrl) window.location.href = approveUrl;
      else throw new Error("Lien PayPal indisponible");
    } catch (e) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  if (!user || user.plan === "FREE") {
    return (
      <div className="rounded-3xl glass-card p-8 text-center">
        <h2 className="text-2xl font-extrabold text-delt-text mb-2">{t("topup.title")}</h2>
        <p className="text-sm text-delt-muted">{t("topup.need_plan")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl glass-card p-6 sm:p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-delt-text">{t("topup.title")}</h2>
        <p className="text-sm text-delt-muted mt-2 max-w-xl mx-auto">{t("topup.subtitle")}</p>
      </div>
      {capturing && (
        <div className="mb-4 text-center text-sm text-indigo-600 font-semibold">{t("topup.processing")}</div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger-children">
        {packs.map((p) => (
          <button
            key={p.id}
            onClick={() => buy(p.id)}
            disabled={!!busy}
            className="rounded-2xl glass-card p-4 text-center hover-lift tap-shrink disabled:opacity-50 relative"
          >
            {p.bonus > 0 && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>
                +{p.bonus} bonus
              </span>
            )}
            <div className="text-2xl font-extrabold text-delt-text mt-1">{p.priceEur}€</div>
            <div className="text-sm font-bold text-indigo-600 mt-1">{p.credits.toLocaleString()} Cr</div>
            <div className="text-[10px] text-delt-muted mt-1">{busy === p.id ? t("topup.redirecting") : t("topup.buy")}</div>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-delt-muted text-center mt-4">{t("topup.note")}</p>
    </div>
  );
}
