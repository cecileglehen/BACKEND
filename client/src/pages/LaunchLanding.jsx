// Landing page publique de Launch (launch.deltai.fr) — dark premium façon Lovable/Bolt.
// Affichée aux visiteurs non connectés ; le CTA déclenche l'auth puis l'IDE.
import { useState, useEffect } from "react";

const MODELS = ["Claude", "GPT-5", "Gemini", "Llama", "Mistral", "Grok", "DeepSeek", "Qwen"];

const FEATURES = [
  { icon: "💬", title: "Tu parles, ça code", desc: "Décris ton app en français. Launch génère le code React complet, en streaming, sous tes yeux." },
  { icon: "🧠", title: "64+ modèles IA", desc: "Builder, Design pro, Production… choisis le cerveau qui code ton app. Aucun concurrent ne fait ça." },
  { icon: "🎨", title: "Images & logos IA", desc: "Génération d'images intégrée (Flux, Nano Banana, Seedream) — logos, hero, illustrations en un clic." },
  { icon: "👁", title: "Édition visuelle", desc: "Clique un élément dans l'aperçu et modifie-le — texte, couleurs, style — sans toucher au code." },
  { icon: "🚀", title: "Déploiement 1-clic", desc: "Ton app en ligne sur ton-app.deltai.fr instantanément. Hébergement inclus." },
  { icon: "💳", title: "Paiements & intégrations", desc: "Stripe pour encaisser, Notion pour logger tes commandes — branchés nativement dans tes apps." }
];

const STEPS = [
  { n: "1", title: "Décris", desc: "« Une boutique avec panier et paiement »" },
  { n: "2", title: "Regarde", desc: "L'IA construit, tu vois l'aperçu en live" },
  { n: "3", title: "Lance", desc: "Déploie en 1 clic, partage le lien" }
];

export default function LaunchLanding({ onStart }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[#070711] text-white antialiased">
      {/* Halo de fond */}
      <div className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "radial-gradient(80% 50% at 50% -10%, rgba(99,102,241,.35), rgba(139,92,246,.12) 35%, rgba(6,182,212,.06) 60%, transparent 80%)" }} />

      {/* Nav */}
      <header className={`fixed top-0 inset-x-0 z-40 transition-all ${scrolled ? "backdrop-blur-xl bg-[#070711]/80 border-b border-white/10" : ""}`}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>⚡</span>
            Launch
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#how" className="hover:text-white transition-colors">Comment ça marche</a>
            <a href="https://deltai.fr" className="hover:text-white transition-colors">DELT AI</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={onStart} className="px-3.5 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors">Se connecter</button>
            <button onClick={onStart} className="px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:scale-[1.03] transition-transform"
              style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>Commencer</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-36 pb-20 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white/80 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Propulsé par 64+ modèles IA
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Décris ton app.<br />
            <span style={{ background: "linear-gradient(135deg,#a5b4fc,#67e8f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Launch la construit.
            </span>
          </h1>
          <p className="mt-6 text-lg text-white/60 max-w-xl mx-auto">
            Le créateur d'applications par IA. Tu parles, il code, déploie et encaisse —
            de l'idée à l'app en ligne en quelques minutes.
          </p>

          {/* Composer factice */}
          <div className="mt-9 max-w-xl mx-auto text-left rounded-3xl border border-white/10 bg-white/[.04] backdrop-blur p-3 shadow-2xl shadow-indigo-500/10">
            <div className="px-3 pt-2 text-[15px] text-white/50">Crée une boutique avec panier, paiement Stripe et suivi des commandes…</div>
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">🛠 Builder</span>
                <span>📎</span>
              </div>
              <button onClick={onStart} className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/40"
                style={{ background: "linear-gradient(135deg,#2563eb,#06b6d4)" }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
              </button>
            </div>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={onStart} className="px-6 py-3 rounded-full text-base font-bold text-white shadow-xl shadow-indigo-500/30 hover:scale-[1.03] transition-transform"
              style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>
              Construire mon app — gratuit
            </button>
            <a href="#how" className="px-6 py-3 rounded-full text-base font-semibold text-white/80 border border-white/15 hover:bg-white/5 transition-colors">
              Voir comment ça marche
            </a>
          </div>

          {/* Bandeau modèles */}
          <div className="mt-12">
            <div className="text-[11px] uppercase tracking-widest text-white/30 mb-3">Choisis le modèle qui code ton app</div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-white/40 text-sm font-medium">
              {MODELS.map((m) => <span key={m}>{m}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-5 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight">Tout pour passer de l'idée au revenu</h2>
        <p className="text-center text-white/50 mt-3 max-w-xl mx-auto">Bien plus qu'un générateur de code : une plateforme complète pour créer, déployer et monétiser.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[.03] p-5 hover:bg-white/[.06] hover:border-white/20 transition-all">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-white/5 border border-white/10 mb-4">{f.icon}</div>
              <div className="font-bold text-lg">{f.title}</div>
              <div className="text-white/55 text-sm mt-1.5 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-5 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight">3 étapes, c'est en ligne</h2>
        <div className="grid sm:grid-cols-3 gap-5 mt-12">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-white/10 bg-white/[.03] p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-lg font-extrabold text-white mb-4"
                style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>{s.n}</div>
              <div className="font-bold text-xl">{s.title}</div>
              <div className="text-white/55 mt-1.5">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 py-24">
        <div className="max-w-3xl mx-auto text-center rounded-3xl border border-white/10 p-12 relative overflow-hidden"
          style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(99,102,241,.25), rgba(6,182,212,.08) 50%, transparent)" }}>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Ta prochaine app commence par une phrase.</h2>
          <p className="text-white/60 mt-4">Gratuit pour commencer. Pas de carte requise.</p>
          <button onClick={onStart} className="mt-8 px-8 py-3.5 rounded-full text-lg font-bold text-white shadow-xl shadow-indigo-500/40 hover:scale-[1.03] transition-transform"
            style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>
            Lancer ma première app
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-10 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <div className="flex items-center gap-2 font-bold text-white/70">
            <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>⚡</span>
            Launch
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-center">
            <a href="https://deltai.fr" className="hover:text-white transition-colors">DELT AI</a>
            <a href="https://deltai.fr/mentions-legales" className="hover:text-white transition-colors">Mentions légales</a>
            <a href="https://deltai.fr/terms" className="hover:text-white transition-colors">CGU / CGV</a>
            <a href="https://deltai.fr/privacy" className="hover:text-white transition-colors">Confidentialité</a>
            <a href="https://deltai.fr/cookies" className="hover:text-white transition-colors">Cookies</a>
            <button onClick={() => window.dispatchEvent(new CustomEvent("delt:cookie-settings"))} className="hover:text-white transition-colors">Gérer les cookies</button>
          </div>
          <div>© {new Date().getFullYear()} DELT AI</div>
        </div>
      </footer>
    </div>
  );
}
