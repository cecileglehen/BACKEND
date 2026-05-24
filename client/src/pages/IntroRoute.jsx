import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const SECTIONS = [
  {
    id: "chat",
    icon: "💬",
    title: "Le Chat",
    intro: "Le cœur de Delt AI. Discute avec les meilleurs LLM du marché — GPT, Claude, Gemini, Mistral, Grok, et plus.",
    items: [
      { label: "Choisir un modèle", body: "Sous la barre de prompt, tu vois des pastilles colorées par marque. Clique sur les 3 points pour voir tous les modèles d'une marque (Nano, Mini, Normal, Expert, Pro)." },
      { label: "Catégories de modèles", body: "PICO/NANO = ultra rapide et pas cher. MINI = bon compromis. NORMAL = qualité standard. EXPERT/PRO = raisonnement avancé pour les tâches dures." },
      { label: "Joindre une image", body: "Bouton trombone 📎 ou drag&drop. Si ton modèle est text-only, Delt switche automatiquement vers un modèle vision-compatible de la même catégorie." },
      { label: "Joindre un fichier", body: "PDF, .txt, .md, code (.py .js .ts .dart .rs .go .java...), Word, Excel — plus de 80 types reconnus. Le contenu est extrait et envoyé au modèle." }
    ]
  },
  {
    id: "websearch",
    icon: "🔎",
    title: "La recherche Web",
    intro: "Delt cherche automatiquement sur Internet quand ta question le nécessite — actu, prix, météo, événements récents.",
    items: [
      { label: "Auto-détection", body: "Si tu demandes \"prix Bitcoin\", \"actu Macron\", \"météo Paris demain\" → la recherche se lance toute seule." },
      { label: "Sources cliquables", body: "Les citations [1] [2] [3] dans la réponse sont cliquables → renvoient vers la source." },
      { label: "Perplexity Sonar", body: "Sélectionne \"Sonar\" dans Perplexity pour un mode recherche pur (rapport long avec sources)." }
    ]
  },
  {
    id: "deepsearch",
    icon: "🧠",
    title: "DeepSearch",
    intro: "Recherche approfondie multi-étapes : Delt cherche, scrape, extrait les claims, croise les sources, synthétise.",
    items: [
      { label: "Quand l'utiliser", body: "Questions complexes nécessitant plusieurs sources : analyse, comparaison, état de l'art, fact-checking." },
      { label: "Activer DeepSearch", body: "Bouton dédié sous la barre de prompt. Coût en crédits plus élevé (utilise plusieurs modèles + scraping)." },
      { label: "Suivre la progression", body: "Tu vois en live : recherche → scraping → extraction de claims → clustering → synthèse finale." }
    ]
  },
  {
    id: "studio",
    icon: "🎨",
    title: "Studio (Image / Vidéo / Musique)",
    intro: "Génère des images, des vidéos et de la musique avec les meilleurs modèles créatifs.",
    items: [
      { label: "Images", body: "FLUX Schnell (rapide), Nano Banana (qualité), Nano Banana 2 / Pro (haut de gamme), GPT Image 2 (rendu pro avec texte impeccable)." },
      { label: "Vidéos", body: "ByteDance Seedance 2 — texte → vidéo 720p. Coût ~50 crédits par seconde de vidéo." },
      { label: "Musique", body: "Suno V5.5 — génère 1-3 min de musique avec voix. ~25 crédits par génération." },
      { label: "Conseils prompt", body: "Sois précis : style (cinematic, anime, photoréaliste), sujet, composition, ambiance. Plus le prompt est riche, mieux c'est." }
    ]
  },
  {
    id: "code",
    icon: "👨‍💻",
    title: "Code Studio",
    intro: "Onglet \"Code\" — éditeur intégré pour générer, expliquer, refactor du code avec IA.",
    items: [
      { label: "Modèles spécialisés", body: "Utilise GPT-5.3 Codex, Claude Sonnet, ou Grok pour du code production-ready." },
      { label: "Workflow", body: "Décris ce que tu veux → l'IA génère → tu peux directement éditer / relancer / demander des modifs." }
    ]
  },
  {
    id: "projects",
    icon: "📁",
    title: "Projets",
    intro: "Regroupe plusieurs conversations sous un même contexte (avec un system prompt commun).",
    items: [
      { label: "Créer un projet", body: "Dans la sidebar gauche, clique \"+ Nouveau projet\". Donne-lui un nom et une instruction (ex: \"Tu es un coach Python\")." },
      { label: "System prompt", body: "Toutes les conversations dans le projet héritent automatiquement de cette instruction." }
    ]
  },
  {
    id: "memory",
    icon: "🧩",
    title: "Mémoire",
    intro: "Delt retient les infos importantes que tu lui donnes (ton nom, tes préférences, ton métier).",
    items: [
      { label: "Activation auto", body: "Quand tu dis \"je m'appelle X\", \"je suis dev React\" → c'est mémorisé pour les futures conversations." },
      { label: "Gérer la mémoire", body: "Paramètres → Mémoire : tu peux voir, éditer ou supprimer chaque souvenir." }
    ]
  },
  {
    id: "credits",
    icon: "💎",
    title: "Crédits & abonnement",
    intro: "Tout est facturé en crédits (1€ = 100 crédits). Ton abonnement t'en donne chaque mois.",
    items: [
      { label: "Coût par modèle", body: "PICO ≈ 0.1 Cr / msg court · NANO ≈ 0.2 Cr · MINI ≈ 0.4 Cr · NORMAL ≈ 4 Cr · EXPERT ≈ 8 Cr · PRO ≈ 50 Cr. Plus tu utilises de tokens, plus ça coûte." },
      { label: "Top-up", body: "Si tu épuises tes crédits avant la fin du mois → rachète un pack ponctuel sans changer d'abonnement." },
      { label: "Voir ton solde", body: "Affiché en haut à droite de la navbar." }
    ]
  },
  {
    id: "api",
    icon: "🔌",
    title: "API (PLUS / PRO / ULTRA)",
    intro: "Accède aux mêmes modèles via l'API REST compatible OpenAI.",
    items: [
      { label: "Créer une clé", body: "Paramètres → API → \"Nouvelle clé\". Tu obtiens un sk-delt-xxxxx." },
      { label: "Endpoint", body: "https://deltai.fr/v1/chat/completions — format OpenAI standard. Marche avec OpenAI SDK, LangChain, etc." },
      { label: "Documentation", body: "/docs dans tes paramètres → exemples curl, Python, Node." }
    ]
  },
  {
    id: "privacy",
    icon: "🔒",
    title: "Confidentialité",
    intro: "Tes conversations sont chiffrées en base. On ne lit rien, on ne revend rien.",
    items: [
      { label: "Chiffrement", body: "AES-256 sur les messages stockés. Seul ton compte peut les déchiffrer." },
      { label: "Pas de training", body: "Aucune de tes données n'est utilisée pour entraîner les modèles (ni les nôtres, ni ceux des partenaires)." },
      { label: "Effacer", body: "Paramètres → Confidentialité → \"Supprimer toutes mes données\". Effacement complet en 24h." }
    ]
  }
];

export default function IntroRoute() {
  const { user } = useAuth();
  const [open, setOpen] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        <div className={`text-center mb-12 transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-5">
            🎉 Bienvenue {user?.plan && user.plan !== "FREE" ? `dans ${user.plan}` : ""}
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-delt-text tracking-tight leading-tight">
            Tout Delt AI<br />en 5 minutes
          </h1>
          <p className="mt-5 text-base sm:text-lg text-delt-muted max-w-xl mx-auto leading-relaxed">
            Un guide complet de toutes les fonctionnalités. Clique sur chaque section pour découvrir.
          </p>
        </div>

        <div className="space-y-3 mb-12">
          {SECTIONS.map((s, i) => {
            const isOpen = open === s.id;
            return (
              <div
                key={s.id}
                className={`rounded-2xl border bg-white overflow-hidden transition-all ${
                  isOpen ? "border-indigo-300 shadow-md" : "border-delt-border hover:border-indigo-200"
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left"
                >
                  <span className="text-3xl flex-shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-delt-text">{s.title}</div>
                    <div className="text-xs text-delt-muted mt-0.5 truncate">{s.intro}</div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`flex-shrink-0 text-delt-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-delt-border bg-delt-surface/30">
                    <p className="text-sm text-delt-text leading-relaxed pt-4 mb-4">{s.intro}</p>
                    <ul className="space-y-3">
                      {s.items.map((it, j) => (
                        <li key={j} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">{j + 1}</span>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-delt-text">{it.label}</div>
                            <p className="text-xs sm:text-sm text-delt-muted mt-0.5 leading-relaxed">{it.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-8 sm:p-10 text-center shadow-xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">Prêt à commencer ?</h2>
          <p className="text-indigo-50 text-sm sm:text-base mb-6 max-w-md mx-auto">
            Tu as tout entre les mains. À toi de jouer.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition-colors shadow-md"
          >
            Aller au chat
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        <p className="text-center text-xs text-delt-muted">
          Besoin d'aide ? <a href="/settings" className="text-indigo-600 hover:underline">Paramètres</a> · <a href="/notre-modele" className="text-indigo-600 hover:underline">Notre modèle</a> · <a href="/billing" className="text-indigo-600 hover:underline">Tarifs</a>
        </p>

      </div>
    </div>
  );
}
