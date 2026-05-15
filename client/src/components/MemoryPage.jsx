import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../contexts/ToastContext.jsx";

const INTEREST_SUGGESTIONS = [
  "Développement web", "Mobile / Flutter", "IA & Machine Learning", "Design UI/UX",
  "Cybersécurité", "Data science", "DevOps", "Startup & business",
  "Marketing digital", "Écriture / Rédaction", "Musique", "Cinéma & vidéo",
  "Jeux vidéo", "Sport & fitness", "Cuisine", "Voyage",
  "Philosophie", "Sciences", "Histoire", "Finance / Crypto"
];

const TONES = [
  { id: "neutre",     label: "Neutre",     emoji: "💼" },
  { id: "amical",     label: "Amical",     emoji: "😊" },
  { id: "concis",     label: "Concis",     emoji: "⚡" },
  { id: "détaillé",   label: "Détaillé",   emoji: "📚" },
  { id: "créatif",    label: "Créatif",    emoji: "✨" },
  { id: "humoristique",label: "Humour",    emoji: "😄" }
];

export default function MemoryPage({ isOnboarding = false, onSaved }) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState("");
  const [interests, setInterests]     = useState([]);
  const [customInterest, setCustomInterest] = useState("");
  const [role, setRole]               = useState("");
  const [tone, setTone]               = useState("amical");
  const [context, setContext]         = useState("");
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  useEffect(() => {
    api.getMemory()
      .then((data) => {
        setDisplayName(data.displayName || "");
        const p = data.profile || {};
        setInterests(p.interests || []);
        setRole(p.role || "");
        setTone(p.tone || "amical");
        setContext(p.context || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleInterest = (s) => {
    setInterests((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].slice(0, 12));
  };

  const addCustom = () => {
    const v = customInterest.trim();
    if (!v) return;
    if (!interests.includes(v)) setInterests([...interests, v].slice(0, 12));
    setCustomInterest("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.setMemory({
        displayName: displayName.trim() || null,
        profile: { interests, role: role.trim() || null, tone, context: context.trim() || null }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-delt-muted">Chargement…</div>;
  }

  return (
    <div className={isOnboarding ? "min-h-screen bg-white flex flex-col" : ""}>
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 w-full">

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-md mb-3"
            style={{ background: "linear-gradient(135deg, #ec4899, #f97316)" }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-9 9c0 4.97 4.03 9 9 9 1.66 0 3-1.34 3-3a3 3 0 0 0-3-3h-1a2 2 0 0 1-2-2c0-1.1.9-2 2-2h6a4 4 0 0 0 4-4z"/>
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-delt-text tracking-tight">
            {isOnboarding ? "Parle-nous un peu de toi" : "Mémoire personnelle"}
          </h1>
          <p className="text-sm text-delt-muted mt-2">
            Ces infos seront utilisées par <strong className="text-delt-text">tous les modèles d'IA</strong> pour mieux te comprendre et personnaliser leurs réponses.
            Tu peux les modifier à tout moment.
          </p>
        </div>

        {/* Nom */}
        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-delt-muted mb-2">
            Comment l'IA doit-elle t'appeler ?
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
            placeholder="Ex : Thomas, Léa, Captain…"
            className="w-full px-4 py-2.5 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-delt-accent outline-none text-sm"
          />
        </div>

        {/* Rôle */}
        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-delt-muted mb-2">
            Ton rôle / métier <span className="font-normal text-delt-muted normal-case">(optionnel)</span>
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value.slice(0, 100))}
            placeholder="Ex : Développeur full-stack, Étudiant en droit, Photographe…"
            className="w-full px-4 py-2.5 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-delt-accent outline-none text-sm"
          />
        </div>

        {/* Intérêts */}
        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-widest text-delt-muted">
              Centres d'intérêt
            </label>
            <span className="text-[10px] text-delt-muted">{interests.length} / 12</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {INTEREST_SUGGESTIONS.map((s) => {
              const sel = interests.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleInterest(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-colors ${
                    sel
                      ? "bg-pink-50 border-pink-300 text-pink-700"
                      : "bg-white border-delt-border text-delt-muted hover:border-delt-text/30 hover:text-delt-text"
                  }`}
                >
                  {sel ? "✓ " : ""}{s}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value.slice(0, 50))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder="Ajoute un centre d'intérêt personnalisé"
              className="flex-1 px-3 py-2 rounded-xl border border-delt-border bg-delt-surface text-sm outline-none focus:border-delt-accent focus:bg-white"
            />
            <button
              onClick={addCustom}
              disabled={!customInterest.trim()}
              className="px-3 py-2 rounded-xl bg-delt-text text-white text-xs font-bold disabled:opacity-40"
            >
              + Ajouter
            </button>
          </div>
          {/* Liste personnalisée */}
          {interests.filter((i) => !INTEREST_SUGGESTIONS.includes(i)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {interests.filter((i) => !INTEREST_SUGGESTIONS.includes(i)).map((i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-pink-50 border border-pink-300 text-pink-700">
                  {i}
                  <button onClick={() => toggleInterest(i)} className="text-pink-500 hover:text-pink-700 ml-1">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ton */}
        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-delt-muted mb-3">
            Ton préféré
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                className={`rounded-xl py-3 text-sm font-bold border-2 transition-colors ${
                  tone === t.id
                    ? "border-delt-accent bg-indigo-50 text-delt-accent"
                    : "border-delt-border bg-white text-delt-text hover:border-delt-text/30"
                }`}
              >
                <div className="text-xl mb-1">{t.emoji}</div>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contexte libre */}
        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-6">
          <label className="block text-xs font-bold uppercase tracking-widest text-delt-muted mb-2">
            Autre chose à savoir ? <span className="font-normal text-delt-muted normal-case">(optionnel)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Ex : Je travaille sur un projet d'app mobile. Je préfère React Native à Flutter. J'ai un chat qui s'appelle Mochi…"
            className="w-full px-4 py-3 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-delt-accent outline-none text-sm resize-none"
          />
          <div className="text-[10px] text-delt-muted text-right mt-1">{context.length} / 500</div>
        </div>

        {/* CTA */}
        <div className={isOnboarding ? "sticky bottom-0 -mx-3 sm:-mx-6 px-3 sm:px-6 py-4 bg-white border-t border-delt-border" : ""}>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #ec4899, #f97316)" }}
          >
            {saving ? "Enregistrement…" : saved ? "Enregistré ✓" : (isOnboarding ? "Continuer →" : "Enregistrer")}
          </button>
          {isOnboarding && (
            <button onClick={onSaved} className="w-full mt-2 text-xs text-delt-muted hover:text-delt-text font-medium">
              Passer pour l'instant
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
