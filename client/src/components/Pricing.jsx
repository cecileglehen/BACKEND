import { useEffect, useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { api } from "../lib/api.js";
import { useToast } from "../contexts/ToastContext.jsx";
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
  { text: "Accès API directe DELT",     sub: "Compatible OpenAI SDK" },
];

const PLANS = [
  {
    key: "BASIC",
    label: "Starter",
    subtitle: "Pour découvrir DELT AI",
    price: 10,
    yearlyPrice: 8,
    multiplier: null,
    dark: true,
  },
  {
    key: "PLUS",
    label: "Standard",
    subtitle: "2,5× plus d'usage que Starter",
    price: 23,
    yearlyPrice: 18,
    multiplier: "2,5×",
    popular: true,
  },
  {
    key: "PRO",
    label: "Expert",
    subtitle: "8,5× plus d'usage que Starter",
    price: 75,
    yearlyPrice: 60,
    multiplier: "8,5×",
  },
  {
    key: "ULTRA",
    label: "Entreprise",
    subtitle: "25× plus d'usage que Starter",
    price: 200,
    yearlyPrice: 160,
    multiplier: "25×",
  },
];

const CATEGORY_TABLE = [
  { cat: "FREE",       models: "Ring 2.6 1T · Gemma 4 31B · GPT OSS 120B · Trinity Thinking · DeepSeek V4 Flash (free)",       badge: "" },
  { cat: "UNCENSORED", models: "Venice Dolphin Mistral 24B",                                                                    badge: "badge-venice" },
  { cat: "PICO",       models: "Gemini 2.5 Flash Lite · DeepSeek V4 Flash",                                                     badge: "badge-pico" },
  { cat: "NANO",       models: "Mistral Small 4 · GPT-4o Mini · GPT-5.4 Nano · Gemini 2.5 Flash",                              badge: "badge-eco" },
  { cat: "MINI",       models: "Mistral Large 3 · GPT-5.4 Mini · Llama 4 Maverick · Gemini 3.1 Flash Lite · Claude Haiku 4.5 · Grok 4.20 · Grok 4.3", badge: "badge-mini" },
  { cat: "NORMAL",     models: "GPT-5.4 · Claude Sonnet 4.5 · Mistral Large · Sonar Web Search",                                            badge: "badge-normal" },
  { cat: "EXPERT",     models: "GPT-5.5 · Claude Opus 4.5 · Grok 4.20 Multi-Agent · Sonar Deep Research",                      badge: "badge-expert" },
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
  const [yearly, setYearly] = useState(false);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-delt-text mb-3 tracking-tight">{t("pricing.heading")}</h1>
        <p className="text-lg text-delt-muted mb-8">{t("pricing.tagline")}</p>

        {config.mode === "sandbox" && (
          <div className="mb-6 inline-block text-xs px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
            {t("pricing.sandbox")}
          </div>
        )}

        {/* Toggle */}
        <div className="inline-flex items-center bg-slate-100 rounded-full p-1">
          <button
            onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!yearly ? "bg-white shadow text-delt-text" : "text-delt-muted"}`}
          >
            {t("pricing.pay_monthly")}
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${yearly ? "bg-white shadow text-delt-text" : "text-delt-muted"}`}
          >
            {t("pricing.pay_yearly")}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "linear-gradient(135deg,#2563eb,#06b6d4)", color: "white" }}>-20%</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const planId = config.plans[plan.key];
          const isCurrent = user?.plan === plan.key;
          const userRank = PLAN_RANK[user?.plan] ?? 0;
          const planRank = PLAN_RANK[plan.key] ?? 0;
          const isLower = planRank < userRank;
          const price = yearly ? plan.yearlyPrice : plan.price;

          return (
            <div
              key={plan.key}
              className={`relative rounded-3xl p-7 flex flex-col gap-5 ${
                plan.dark
                  ? "text-white"
                  : "bg-white border border-slate-200 shadow-sm"
              } ${isLower ? "opacity-50" : ""}`}
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
                <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  plan.dark ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700"
                }`}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Tout est dispo
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
                  {yearly ? "Facturé annuellement" : "Annulez à tout moment"}
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
                    key={`${plan.key}-${config.mode}-${yearly}`}
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
        <div className="rounded-2xl border border-delt-border overflow-x-auto shadow-sm">
          <table className="min-w-[500px] w-full text-sm">
            <thead className="bg-delt-surface border-b border-delt-border">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_category")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_models")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-delt-border">
              {CATEGORY_TABLE.map((row) => (
                <tr key={row.cat} className="hover:bg-delt-surface transition-colors">
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
        <div className="rounded-2xl border border-delt-border overflow-x-auto shadow-sm">
          <table className="min-w-[500px] w-full text-sm">
            <thead className="bg-delt-surface border-b border-delt-border">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_model")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_provider")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_usage")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-delt-border">
              {IMAGE_TABLE.map((row) => (
                <tr key={row.name} className="hover:bg-delt-surface transition-colors">
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
        <div className="rounded-2xl border border-delt-border overflow-x-auto shadow-sm">
          <table className="min-w-[500px] w-full text-sm">
            <thead className="bg-delt-surface border-b border-delt-border">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_model")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_provider")}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("pricing.col_resolution")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-delt-border">
              {VIDEO_TABLE.map((row) => (
                <tr key={row.name} className="hover:bg-delt-surface transition-colors">
                  <td className="px-5 py-3.5 font-medium text-delt-text">{row.name}</td>
                  <td className="px-5 py-3.5 text-delt-muted">{row.brand}</td>
                  <td className="px-5 py-3.5 text-delt-muted text-xs">720p</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
