const MODELS = [
  { name: "GPT-5", brand: "OpenAI",    logo: "/brands/openai.svg" },
  { name: "Claude",brand: "Anthropic", logo: "/brands/claude-color.svg" },
  { name: "Gemini",brand: "Google",    logo: "/brands/gemini-color.svg" },
  { name: "Grok",  brand: "xAI",       logo: "/brands/grok.svg" },
  { name: "Mistral",brand:"Mistral",   logo: "/brands/mistral-color.svg" },
  { name: "Llama", brand: "Meta",      logo: "/brands/meta-color.svg" },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "Chat avec les meilleurs LLM",
    desc: "GPT, Claude, Gemini, Grok, Mistral, Llama — tous dans une seule interface. Routage intelligent automatique."
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    title: "Génération d'image",
    desc: "FLUX, GPT Image, Gemini Image… Du rapide éco au rendu pro. Résultats en quelques secondes."
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    ),
    title: "Génération de vidéo",
    desc: "Seedance 2 par ByteDance. Décris ta scène, récupère une vidéo HD en quelques minutes."
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: "Données chiffrées",
    desc: "Tes conversations sont chiffrées côté serveur. RGPD. Suppression à la demande. Aucune revente."
  },
];

const PLANS = [
  { name: "FREE",  price: "0",  color: "#94a3b8", features: ["Modèles gratuits (Ring, GPT OSS, Gemma)", "10K tokens Mistral Small 4 offerts", "Messages illimités"] },
  { name: "BASIC", price: "10", color: "#10b981", highlight: true, features: ["Tout DELT AI débloqué", "Usage mensuel inclus", "Image + vidéo + musique + API"] },
  { name: "PLUS",  price: "23", color: "#6366f1", features: ["Tout DELT AI débloqué", "2,5× plus d'usage mensuel", "Image + vidéo + musique + API"] },
  { name: "PRO",   price: "75", color: "#f59e0b", features: ["Tout DELT AI débloqué", "8,5× plus d'usage mensuel", "Image + vidéo + musique + API"] },
];

export default function LandingPage({ onStart }) {
  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/logo-delt.png" alt="DELT AI" style={{ height: 56, width: "auto" }} />
          <div className="flex items-center gap-3">
            <button
              onClick={onStart}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5"
            >
              Se connecter
            </button>
            <button
              onClick={onStart}
              className="text-sm font-semibold text-white px-5 py-2 rounded-full transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}
            >
              Commencer gratuitement
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-20 pb-24 overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.10) 0%, rgba(6,182,212,0.07) 50%, transparent 70%)",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)"
          }}
        />

        {/* Logo */}
        <div className="relative mb-8">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-30"
            style={{ background: "linear-gradient(135deg, #2563eb, #06d6c2)", transform: "scale(1.6)" }}
          />
          <img src="/logo-delt.png" alt="DELT AI" className="relative z-10" style={{ height: 200, width: "auto" }} />
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-5 max-w-2xl tracking-tight">
          Marre d'avoir{" "}
          <span style={{ background: "linear-gradient(90deg,#2563eb,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            5 abonnements
          </span>{" "}
          d'IA différents ?
        </h1>

        <p className="text-lg text-slate-500 leading-relaxed max-w-xl mb-3">
          DELT AI regroupe <strong className="text-slate-700">tous les plus grands modèles du monde</strong> — GPT, Claude, Gemini, Grok, Mistral, Llama et bien d'autres.
        </p>
        <p className="text-lg font-semibold mb-10" style={{ color: "#2563eb" }}>
          Un seul abonnement à partir de <span style={{ color: "#06b6d4" }}>10 €/mois</span>. Génération d'image et vidéo incluse.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={onStart}
            className="px-8 py-4 rounded-2xl text-base font-bold text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #06b6d4)" }}
          >
            Essayer gratuitement →
          </button>
          <span className="text-sm text-slate-400">Aucune carte bancaire requise</span>
        </div>

        {/* Model logos strip */}
        <div className="mt-16 flex flex-col items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Accès immédiat à</p>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {MODELS.map((m) => (
              <div key={m.name} className="flex flex-col items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2">
                  <img src={m.logo} alt={m.brand} className="w-full h-full object-contain" />
                </div>
                <span className="text-[11px] font-medium text-slate-500">{m.name}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5 opacity-50">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <span className="text-slate-400 text-base font-bold">+</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">& plus</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-slate-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Tout ce dont vous avez besoin</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(6,182,212,0.12))", color: "#2563eb" }}
                >
                  {f.icon}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">Des prix clairs</h2>
          <p className="text-center text-slate-500 text-sm mb-12">Résiliable à tout moment. Sans engagement.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-6 flex flex-col gap-4 transition-shadow ${
                  p.highlight
                    ? "border-blue-400 shadow-lg shadow-blue-100 scale-[1.03]"
                    : "border-slate-100 shadow-sm"
                }`}
              >
                {p.highlight && (
                  <div className="text-[11px] font-bold uppercase tracking-widest text-center py-1 px-2 rounded-full text-white"
                    style={{ background: "linear-gradient(90deg,#2563eb,#06b6d4)" }}>
                    Le plus populaire
                  </div>
                )}
                <div>
                  <span
                    className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white"
                    style={{ background: p.color }}
                  >
                    {p.name}
                  </span>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">{p.price}€</span>
                    <span className="text-sm text-slate-400 mb-1">/mois</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" className="flex-shrink-0 mt-0.5" style={{ color: p.color }}>
                        <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onStart}
                  className="mt-auto w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{
                    background: p.highlight ? "linear-gradient(135deg,#2563eb,#06b6d4)" : "#f1f5f9",
                    color: p.highlight ? "white" : "#475569"
                  }}
                >
                  {p.price === "0" ? "Commencer gratis" : "Choisir ce plan"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section
        className="py-20 px-6 text-center"
        style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0e7490 100%)" }}
      >
        <img src="/logo-delt.png" alt="" className="mx-auto mb-6 opacity-90" style={{ height: 100, width: "auto" }} />
        <h2 className="text-3xl font-extrabold text-white mb-4">Prêt à tout avoir en un seul endroit ?</h2>
        <p className="text-blue-200 mb-8 max-w-md mx-auto">
          Rejoignez DELT AI et accédez aux meilleurs modèles d'IA du marché dès maintenant.
        </p>
        <button
          onClick={onStart}
          className="px-10 py-4 rounded-2xl text-base font-bold text-slate-900 bg-white hover:bg-slate-50 shadow-xl transition-all hover:scale-105"
        >
          Créer un compte gratuit →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-100 py-6 px-6 text-center">
        <p className="text-xs text-slate-400">
          © 2025 DELT AI · <a href="/terms" className="hover:text-slate-600">CGU</a> · <a href="/privacy" className="hover:text-slate-600">Confidentialité</a>
        </p>
      </footer>
    </div>
  );
}
