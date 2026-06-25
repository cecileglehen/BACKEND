// Landing DELT — design épuré inspiré de Mammouth, DA DELT (clair, accent indigo,
// typo Inter). Met en avant NOS features : Débat entre IA, Comparaison, Deep Search
// maison, Refaire avec, Mémoire inter-modèles. Textes directs (FR).

const BRANDS = [
  { name: "GPT",        logo: "/brands/openai.svg" },
  { name: "Claude",     logo: "/brands/claude-color.svg" },
  { name: "Gemini",     logo: "/brands/gemini-color.svg" },
  { name: "Grok",       logo: "/brands/grok.svg" },
  { name: "Mistral",    logo: "/brands/mistral-color.svg" },
  { name: "DeepSeek",   logo: "/brands/deepseek-color.svg" },
  { name: "Perplexity", logo: "/brands/perplexity-color.svg" },
  { name: "Qwen",       logo: "/brands/qwen-color.svg" }
];

const IMAGE_BRANDS = [
  { name: "Nano Banana", logo: "/brands/gemini-color.svg" },
  { name: "FLUX",        logo: "/brands/flux.svg" },
  { name: "GPT Image",   logo: "/brands/openai.svg" },
  { name: "Recraft",     logo: "/brands/recraft.svg" }
];

const FEATURES = [
  {
    tag: "Exclusif",
    title: "Débat entre IA",
    desc: "Mets plusieurs IA face à face sur ta question. Elles argumentent, se challengent, et tu repars avec la meilleure réponse — pas juste celle d'un seul modèle.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h2a2 2 0 0 1 2 2v9l-3-2h-6a2 2 0 0 1-2-2v-1"/><path d="M14 3H5a2 2 0 0 0-2 2v8l3-2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>
  },
  {
    tag: "Côte à côte",
    title: "Mode Comparaison",
    desc: "Une seule question, les réponses de plusieurs modèles en parallèle. Tu vois lequel est le meilleur pour ton besoin, en un coup d'œil.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/></svg>
  },
  {
    tag: "Sans jargon",
    title: "Deep Search maison",
    desc: "Une recherche web approfondie qui lit des dizaines de sources et te rend une synthèse claire et sourcée. Pas de jargon, juste la réponse.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><path d="M8.5 11h5M11 8.5v5"/></svg>
  },
  {
    tag: "1 clic",
    title: "Refaire avec",
    desc: "Pas convaincu par une réponse ? Relance exactement le même prompt sur un autre modèle, avec tout le contexte chargé. Le multi-modèle, sans copier-coller.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
  },
  {
    tag: "Créa",
    title: "Images, vidéo & musique",
    desc: "Nano Banana, FLUX, GPT Image, Seedream… génère et édite tes visuels, tes vidéos et ta musique sans changer d'outil.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
  },
  {
    tag: "Mémoire",
    title: "Elle se souvient de toi",
    desc: "L'IA retient ce qui compte sur toi — métier, préférences, projets — d'une conversation à l'autre, et même d'un modèle à l'autre.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A4.5 4.5 0 0 0 5 6.5 4 4 0 0 0 4 14a4 4 0 0 0 6 2.5 4 4 0 0 0 6-2.5 4 4 0 0 0-1-7.5A4.5 4.5 0 0 0 14.5 2 4.5 4.5 0 0 0 12 3a4.5 4.5 0 0 0-2.5-1z"/><path d="M12 3v14"/></svg>
  }
];

const PLANS = [
  { name: "FREE",  price: "0",   tagline: "Pour tester",       feats: ["Modèles gratuits", "Chat illimité"] },
  { name: "BASIC", price: "10",  tagline: "Le bon départ", highlight: true, feats: ["Tous les modèles", "Images & fichiers", "Débat & Comparaison"] },
  { name: "PLUS",  price: "23",  tagline: "Pour les pros",     feats: ["3× plus d'usage", "Deep Search", "Vidéo & musique"] },
  { name: "PRO",   price: "75",  tagline: "Usage intensif",    feats: ["Quota maximal", "Tout inclus", "Support prioritaire"] }
];

const PRIVACY = [
  {
    title: "Réponses chiffrées",
    desc: "Tes conversations sont chiffrées (AES-256) au repos. Illisibles depuis notre base — même en cas de fuite, personne ne lit tes échanges.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>
  },
  {
    title: "Exporte tout, en 1 clic",
    desc: "Récupère l'intégralité de tes données — conversations, fichiers, paramètres — dans un fichier, quand tu veux. C'est ton droit, on te le facilite.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  },
  {
    title: "Supprime tout, vraiment",
    desc: "Efface ton compte et toutes tes données définitivement, d'un seul clic. Suppression réelle — pas une corbeille qui traîne.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
  },
  {
    title: "RGPD & hébergement EU",
    desc: "Conforme au RGPD, données hébergées en Europe, et zéro entraînement de modèles sur tes contenus. Jamais.",
    icon: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
  }
];

function BrandPill({ b }) {
  return (
    <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-2.5 pr-3.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <img src={b.logo} alt="" className="w-5 h-5 object-contain" />
      <span className="text-[15px] font-medium text-slate-700">{b.name}</span>
    </div>
  );
}

export default function LandingPage({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#fafaf9] text-slate-900">

      {/* ── NAV ── */}
      <header className="sticky top-0 z-30 bg-[#fafaf9]/80 backdrop-blur-xl border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <img src="/logo-delt.png" alt="DELT AI" style={{ height: 44, width: "auto" }} />
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={onStart} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-full hover:bg-slate-100">Connexion</button>
            <button onClick={onStart} className="text-sm font-semibold text-white px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 transition-colors">Commencer</button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="px-5 sm:px-6 pt-20 sm:pt-28 pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <img src="/logo-delt.png" alt="" className="h-16 w-auto mx-auto mb-8 opacity-90" />
          <h1 className="text-[2.6rem] leading-[1.05] sm:text-6xl font-extrabold tracking-[-0.03em] text-slate-900 mb-6">
            Toutes les meilleures IA.<br />Un seul abonnement.
          </h1>
          <p className="text-lg sm:text-xl text-slate-500 mb-9 max-w-xl mx-auto leading-relaxed">
            GPT, Claude, Gemini, Grok, Mistral… réunis au même endroit, avec des outils que les autres n'ont pas. Dès <span className="font-semibold text-slate-700">10€/mois</span>.
          </p>
          <button onClick={onStart}
            className="text-base font-semibold text-white px-8 py-4 rounded-full bg-slate-900 hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-slate-900/10">
            Commencer gratuitement
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-12 max-w-2xl mx-auto">
            {BRANDS.map((b) => <BrandPill key={b.name} b={b} />)}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="px-5 sm:px-6 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">Ce que les autres n'ont pas</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-slate-900 mt-3">Pensé pour aller plus loin</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="group bg-white border border-slate-200/80 rounded-3xl p-7 transition-all hover:border-slate-300 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.12)]">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center">{f.icon(20)}</div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full">{f.tag}</span>
                </div>
                <h3 className="text-xl font-bold tracking-[-0.01em] text-slate-900 mb-2">{f.title}</h3>
                <p className="text-[15px] text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODELS ── */}
      <section className="px-5 sm:px-6 py-20 sm:py-24 bg-white border-y border-slate-200/70">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-slate-900 mb-3">Les modèles inclus</h2>
          <p className="text-slate-500 mb-12 text-lg">Texte, image, vidéo, musique — toujours les dernières versions.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...BRANDS, ...IMAGE_BRANDS].map((b, i) => (
              <div key={b.name + i} className="flex items-center gap-3 bg-[#fafaf9] border border-slate-200/80 rounded-2xl px-4 py-3.5 hover:border-slate-300 transition-colors">
                <img src={b.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                <span className="text-[15px] font-medium text-slate-700 truncate">{b.name}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400 mt-8">…et bien d'autres. Le routeur choisit le meilleur modèle pour chaque question.</p>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="px-5 sm:px-6 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-slate-900">Des prix simples</h2>
            <p className="text-slate-500 mt-3 text-lg">Sans engagement. Annule quand tu veux.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((p) => (
              <div key={p.name} className={`rounded-3xl p-7 flex flex-col transition-all ${p.highlight ? "bg-slate-900 text-white shadow-xl shadow-slate-900/15 scale-[1.03]" : "bg-white border border-slate-200/80 hover:border-slate-300"}`}>
                <div className={`text-xs font-bold uppercase tracking-widest ${p.highlight ? "text-indigo-300" : "text-slate-400"}`}>{p.name}</div>
                <div className="mt-3 mb-1 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">{p.price}€</span>
                  <span className={`text-sm ${p.highlight ? "text-slate-400" : "text-slate-400"}`}>/mois</span>
                </div>
                <div className={`text-sm mb-6 ${p.highlight ? "text-slate-300" : "text-slate-500"}`}>{p.tagline}</div>
                <ul className="space-y-2.5 flex-1 mb-7">
                  {p.feats.map((f) => (
                    <li key={f} className={`flex items-center gap-2.5 text-[15px] ${p.highlight ? "text-slate-200" : "text-slate-600"}`}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={p.highlight ? "#818cf8" : "#6366f1"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onStart} className={`w-full py-3 rounded-full font-semibold text-sm transition-all ${p.highlight ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                  {p.price === "0" ? "Commencer" : "Choisir"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY ── */}
      <section className="px-5 sm:px-6 py-20 sm:py-24 bg-white border-y border-slate-200/70">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-slate-900">Tes données restent à toi</h2>
            <p className="text-slate-500 mt-3 text-lg">La confidentialité par défaut, pas en option.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRIVACY.map((c) => (
              <div key={c.title} className="bg-[#fafaf9] border border-slate-200/80 rounded-3xl p-7 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-5">
                  {c.icon(22)}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{c.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 sm:px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-slate-900 mb-5">Prêt à passer au multi-modèle ?</h2>
          <p className="text-lg text-slate-500 mb-9">Commence gratuitement, sans carte bancaire.</p>
          <button onClick={onStart} className="text-base font-semibold text-white px-8 py-4 rounded-full bg-slate-900 hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-slate-900/10">
            Commencer gratuitement
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-5 sm:px-6 py-10 border-t border-slate-200/70 text-center">
        <img src="/logo-delt.png" alt="DELT AI" className="h-8 w-auto mx-auto mb-3 opacity-70" />
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-400">
          <a href="/mentions-legales" className="hover:text-slate-700">Mentions légales</a>
          <a href="/cgu" className="hover:text-slate-700">CGU</a>
          <a href="/confidentialite" className="hover:text-slate-700">Confidentialité</a>
          <a href="/cookies" className="hover:text-slate-700">Cookies</a>
        </div>
        <p className="text-xs text-slate-300 mt-4">© {new Date().getFullYear()} DELT AI</p>
      </footer>
    </div>
  );
}
