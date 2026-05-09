const PLANS = [
  {
    name: "Lite",
    price: 10,
    period: "/ mois",
    limitLabel: "Limites de base",
    color: "border-delt-border",
    popular: false,
    cta: "Choisir Lite",
    ctaStyle: "btn-secondary w-full mt-6",
    features: [
      "Accès à tous les modèles",
      "Sélection manuelle par fournisseur",
      "Routage automatique Groq",
      "Historique 30 jours",
      "Support email"
    ],
    limits: []
  },
  {
    name: "Plus",
    price: 23,
    period: "/ mois",
    limitLabel: "Limites 2x plus élevées",
    color: "border-delt-border",
    popular: false,
    cta: "Choisir Plus",
    ctaStyle: "btn-secondary w-full mt-6",
    features: [
      "Accès à tous les modèles",
      "Limites environ 2x plus élevées",
      "Routage automatique Groq",
      "Studio Artiste image",
      "Historique 30 jours",
      "Support email"
    ],
    limits: []
  },
  {
    name: "Pro",
    price: 75,
    period: "/ mois",
    limitLabel: "Limites 4x plus élevées",
    color: "border-delt-accent",
    popular: true,
    cta: "Choisir Pro",
    ctaStyle: "btn-accent w-full mt-6",
    features: [
      "Accès à tous les modèles",
      "Limites environ 4x plus élevées",
      "Routage intelligent prioritaire",
      "Studio complet (Image + Vidéo)",
      "Fallback automatique garanti",
      "Historique illimité",
      "Support prioritaire"
    ],
    limits: []
  },
  {
    name: "Ultra",
    price: 200,
    period: "/ mois",
    limitLabel: "Limites 5x plus élevées",
    color: "border-delt-text",
    popular: false,
    cta: "Choisir Ultra",
    ctaStyle: "btn-primary w-full mt-6",
    features: [
      "Accès à tous les modèles",
      "Limites environ 5x plus élevées",
      "Accès API directe DELT",
      "SLA 99.9% garanti",
      "Modèles privés sur demande",
      "Account manager dédié",
      "Facturation entreprise"
    ],
    limits: []
  }
];

const CATEGORY_TABLE = [
  { cat: "FREE", models: "Ring 2.6 1T · GPT OSS 120B · Gemma 4 31B", consumption: "Aucune", badge: "" },
  { cat: "UNCENSORED", models: "Venice Dolphin Mistral 24B", consumption: "Aucune · +18", badge: "badge-venice" },
  { cat: "NANO", models: "GPT-5.4 Nano · GPT-4o Mini · Mistral Small 4 · Gemini 2.5 Flash", consumption: "Très basse", badge: "badge-eco" },
  { cat: "MINI", models: "GPT-5.4 Mini · GPT-5.1 Codex Mini · Mistral Large 3", consumption: "Basse", badge: "badge-mini" },
  { cat: "NORMAL", models: "GPT-5.4 · GPT-5.5 · GPT-5.3 Codex · Mistral Large · Grok 4.20 · Sonar Web Search", consumption: "Élevée", badge: "badge-normal" },
  { cat: "PRICE", models: "Mistral Medium 3.5", consumption: "Très élevée", badge: "badge-price" },
  { cat: "EXPERT", models: "GPT-5.5 Pro · GPT-5.4 Pro · Claude Opus 4.5 · Grok 4.20 Multi-Agent · Sonar Deep Research", consumption: "Très élevée", badge: "badge-expert" },
  { cat: "Image", models: "Recraft V4 Pro", consumption: "Studio", badge: "" },
  { cat: "Vidéo", models: "OpenAI Sora 2 Pro", consumption: "Studio vidéo", badge: "" }
];

export default function Pricing({ user, onSubscribe }) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight text-delt-text mb-4">
          Tarifs simples et transparents
        </h1>
        <p className="text-delt-muted text-lg">
          Tous les plans accèdent à tous les modèles. Plus tu montes de plan, plus tes limites sont élevées; les modèles avancés consomment simplement la capacité plus vite.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`card p-6 relative flex flex-col border-2 ${plan.color} ${plan.popular ? "shadow-cardHover" : ""}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-delt-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Le plus populaire
                </span>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-2">
                {plan.name}
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold text-delt-text">
                  {plan.price === 0 ? "Gratuit" : `${plan.price}€`}
                </span>
                {plan.period && <span className="text-delt-muted text-sm mb-1">{plan.period}</span>}
              </div>
              <div className="text-sm text-delt-accent font-medium mb-5">{plan.limitLabel}</div>

              <div className="divider mb-5" />

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-delt-text">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-delt-green" fill="none" viewBox="0 0 16 16">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
                {plan.limits.map((l) => (
                  <li key={l} className="flex items-start gap-2 text-sm text-delt-muted">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 16 16">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {l}
                  </li>
                ))}
              </ul>
            </div>

            <button
              className={plan.ctaStyle}
              onClick={() => onSubscribe?.(plan.name.toUpperCase())}
              disabled={user?.plan === plan.name.toUpperCase()}
            >
              {user?.plan === plan.name.toUpperCase() ? "Plan actuel" : plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Tableau modèles */}
      <div>
        <h2 className="text-xl font-bold text-delt-text mb-2">Catalogue modèles</h2>
        <p className="text-sm text-delt-muted mb-5">
          En mode automatique, le routeur Groq choisit la catégorie optimale selon la complexité de ta requête.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-delt-surface border-b border-delt-border">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">Catégorie</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">Modèles disponibles</th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-delt-muted">Consommation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-delt-border">
              {CATEGORY_TABLE.map((row) => (
                <tr key={row.cat} className="hover:bg-delt-surface transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${row.badge}`}>
                      {row.cat}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-delt-muted font-mono text-xs">{row.models}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-delt-text">{row.consumption}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold text-delt-text mb-5">Questions fréquentes</h2>
        <div className="space-y-4">
          {[
            {
              q: "Comment les limites fonctionnent-elles ?",
              a: "Les limites sont calculées sur une fenêtre glissante. Les plans supérieurs augmentent fortement la capacité disponible."
            },
            {
              q: "Que se passe-t-il si un modèle est indisponible ?",
              a: "Le système bascule automatiquement vers une catégorie moins consommatrice sans bloquer l'envoi."
            },
            {
              q: "Puis-je changer de plan à tout moment ?",
              a: "Oui. La mise à niveau est immédiate, le downgrade s'applique en fin de cycle de facturation."
            },
            {
              q: "Comment fonctionne le mode automatique ?",
              a: "Avant chaque envoi, un pré-flight via Groq évalue la complexité de ta requête et sélectionne la catégorie la plus adaptée."
            }
          ].map((item) => (
            <div key={item.q} className="card p-5">
              <div className="font-semibold text-delt-text text-sm mb-1.5">{item.q}</div>
              <div className="text-sm text-delt-muted">{item.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
