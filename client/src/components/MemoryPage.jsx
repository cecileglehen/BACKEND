import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../contexts/ToastContext.jsx";
import { useT } from "../lib/i18n.jsx";

const INTEREST_KEYS = [
  "interest.web", "interest.mobile", "interest.ai", "interest.design",
  "interest.security", "interest.data", "interest.devops", "interest.startup",
  "interest.marketing", "interest.writing", "interest.music", "interest.cinema",
  "interest.games", "interest.sport", "interest.cooking", "interest.travel",
  "interest.philosophy", "interest.science", "interest.history", "interest.finance"
];

const TONES_DEF = [
  { id: "neutre",      key: "mem.tone_neutral",  emoji: "💼" },
  { id: "amical",      key: "mem.tone_friendly", emoji: "😊" },
  { id: "concis",      key: "mem.tone_concise",  emoji: "⚡" },
  { id: "détaillé",    key: "mem.tone_detailed", emoji: "📚" },
  { id: "créatif",     key: "mem.tone_creative", emoji: "✨" },
  { id: "humoristique",key: "mem.tone_humor",    emoji: "😄" }
];

export default function MemoryPage({ isOnboarding = false, onSaved }) {
  const toast = useToast();
  const t = useT();
  const [displayName, setDisplayName] = useState("");
  const [interests, setInterests]     = useState([]);
  const [customInterest, setCustomInterest] = useState("");
  const [role, setRole]               = useState("");
  const [tone, setTone]               = useState("amical");
  const [context, setContext]         = useState("");
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  // Mapping interest label affiché → key (pour stocker la key et afficher la traduction)
  const INTEREST_LABELS = INTEREST_KEYS.map((k) => ({ key: k, label: t(k) }));
  const interestLabelToKey = (lbl) => INTEREST_LABELS.find((i) => i.label === lbl)?.key || lbl;

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
    return <div className="p-8 text-center text-sm text-delt-muted">{t("mem.loading")}</div>;
  }

  // Detecte si un intérêt est dans la liste suggestions (par key ou label dans une des langues)
  const isSuggested = (i) => INTEREST_LABELS.some((s) => s.label === i || s.key === i);

  return (
    <div className={isOnboarding ? "min-h-screen bg-white flex flex-col" : ""}>
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 w-full">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-md mb-3"
            style={{ background: "linear-gradient(135deg, #ec4899, #f97316)" }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-9 9c0 4.97 4.03 9 9 9 1.66 0 3-1.34 3-3a3 3 0 0 0-3-3h-1a2 2 0 0 1-2-2c0-1.1.9-2 2-2h6a4 4 0 0 0 4-4z"/>
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-delt-text tracking-tight">
            {isOnboarding ? t("mem.title_onb") : t("mem.title")}
          </h1>
          <p className="text-sm text-delt-muted mt-2" dangerouslySetInnerHTML={{ __html: t("mem.desc").replace("<strong>", "<strong class=\"text-delt-text\">") }} />
        </div>

        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-delt-muted mb-2">{t("mem.call_you")}</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
            placeholder={t("mem.call_placeholder")}
            className="w-full px-4 py-2.5 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-delt-accent outline-none text-sm" />
        </div>

        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-delt-muted mb-2">
            {t("mem.role_label")} <span className="font-normal text-delt-muted normal-case">{t("mem.optional")}</span>
          </label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value.slice(0, 100))}
            placeholder={t("mem.role_placeholder")}
            className="w-full px-4 py-2.5 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-delt-accent outline-none text-sm" />
        </div>

        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-widest text-delt-muted">{t("mem.interests_label")}</label>
            <span className="text-[10px] text-delt-muted">{interests.length} / 12</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {INTEREST_LABELS.map(({ key, label }) => {
              const sel = interests.includes(label);
              return (
                <button key={key} type="button" onClick={() => toggleInterest(label)}
                  className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-colors ${
                    sel ? "bg-pink-50 border-pink-300 text-pink-700"
                       : "bg-white border-delt-border text-delt-muted hover:border-delt-text/30 hover:text-delt-text"
                  }`}
                >
                  {sel ? "✓ " : ""}{label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input type="text" value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value.slice(0, 50))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder={t("mem.custom_placeholder")}
              className="flex-1 px-3 py-2 rounded-xl border border-delt-border bg-delt-surface text-sm outline-none focus:border-delt-accent focus:bg-white" />
            <button onClick={addCustom} disabled={!customInterest.trim()}
              className="px-3 py-2 rounded-xl bg-delt-text text-white text-xs font-bold disabled:opacity-40">
              {t("mem.add")}
            </button>
          </div>
          {interests.filter((i) => !isSuggested(i)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {interests.filter((i) => !isSuggested(i)).map((i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-pink-50 border border-pink-300 text-pink-700">
                  {i}
                  <button onClick={() => toggleInterest(i)} className="text-pink-500 hover:text-pink-700 ml-1">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-delt-muted mb-3">{t("mem.tone_label")}</label>
          <div className="grid grid-cols-3 gap-2">
            {TONES_DEF.map((to) => (
              <button key={to.id} type="button" onClick={() => setTone(to.id)}
                className={`rounded-xl py-3 text-sm font-bold border-2 transition-colors ${
                  tone === to.id ? "border-delt-accent bg-indigo-50 text-delt-accent"
                                 : "border-delt-border bg-white text-delt-text hover:border-delt-text/30"
                }`}
              >
                <div className="text-xl mb-1">{to.emoji}</div>
                {t(to.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-delt-border p-5 mb-6">
          <label className="block text-xs font-bold uppercase tracking-widest text-delt-muted mb-2">
            {t("mem.other_label")} <span className="font-normal text-delt-muted normal-case">{t("mem.optional")}</span>
          </label>
          <textarea value={context} onChange={(e) => setContext(e.target.value.slice(0, 500))} rows={3}
            placeholder={t("mem.other_placeholder")}
            className="w-full px-4 py-3 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-delt-accent outline-none text-sm resize-none" />
          <div className="text-[10px] text-delt-muted text-right mt-1">{context.length} / 500</div>
        </div>

        <div className={isOnboarding ? "sticky bottom-0 -mx-3 sm:-mx-6 px-3 sm:px-6 py-4 bg-white border-t border-delt-border" : ""}>
          <button onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #ec4899, #f97316)" }}
          >
            {saving ? t("mem.saving") : saved ? t("mem.saved") : (isOnboarding ? t("mem.continue") : t("mem.save"))}
          </button>
          {isOnboarding && (
            <button onClick={onSaved} className="w-full mt-2 text-xs text-delt-muted hover:text-delt-text font-medium">
              {t("mem.skip")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
