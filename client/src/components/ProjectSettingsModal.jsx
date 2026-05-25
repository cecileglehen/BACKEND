import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../contexts/ToastContext.jsx";
import { useT } from "../lib/i18n.jsx";

const ICON_PRESETS = ["📁", "💻", "📱", "🎨", "📚", "🧠", "🚀", "🎬", "🎵", "✍️", "🔬", "💡", "🌍", "⚡", "🎯", "📊", "🍳", "🏋️"];
const COLOR_PRESETS = [
  "#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899",
  "#8b5cf6", "#3b82f6", "#84cc16", "#f97316", "#14b8a6", "#a855f7"
];

export default function ProjectSettingsModal({ project, onClose, onUpdated, onDeleted }) {
  const toast = useToast();
  const t = useT();
  const [name, setName]           = useState(project.name || "");
  const [icon, setIcon]           = useState(project.icon || "📁");
  const [color, setColor]         = useState(project.color || "#6366f1");
  const [desc, setDesc]           = useState(project.description || "");
  const [sysPrompt, setSysPrompt] = useState(project.systemPrompt || "");
  const [defaultModel, setDefaultModel] = useState(project.defaultModel || "");
  const [context, setContext]     = useState(project.memory?.context || "");
  const [keyFacts, setKeyFacts]   = useState((project.memory?.keyFacts || []).join("\n"));
  const [catalog, setCatalog]     = useState(null);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {});
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    try {
      const memory = {
        context: context.trim() || null,
        keyFacts: keyFacts.split("\n").map((s) => s.trim()).filter(Boolean)
      };
      await api.updateProject(project.id, {
        name: name.trim() || "Sans titre",
        icon, color,
        description: desc.trim() || null,
        systemPrompt: sysPrompt.trim() || null,
        defaultModel: defaultModel || null,
        memory
      });
      onUpdated?.();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("proj.delete_confirm"))) return;
    try {
      await api.deleteProject(project.id);
      onDeleted?.();
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const allModels = [];
  if (catalog?.categories) {
    for (const [tier, cat] of Object.entries(catalog.categories)) {
      for (const m of cat.models) allModels.push({ ...m, tier });
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdropFade">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-slideUp">

        {/* Header */}
        <div className="px-5 py-4 border-b border-delt-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-extrabold text-delt-text tracking-tight flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            {t("proj.settings")}
          </h2>
          <button onClick={onClose} className="text-delt-muted hover:text-delt-text text-2xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Nom */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">{t("proj.name")}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))}
              className="w-full px-3 py-2 rounded-xl border border-delt-border text-sm outline-none focus:border-delt-accent" />
          </div>

          {/* Icône */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">{t("proj.icon")}</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_PRESETS.map((i) => (
                <button key={i} onClick={() => setIcon(i)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-colors ${
                    icon === i ? "bg-indigo-50 ring-2 ring-delt-accent" : "bg-delt-surface hover:bg-delt-panel"
                  }`}>{i}</button>
              ))}
            </div>
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">{t("proj.color")}</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-full border-2 transition-transform ${color === c ? "border-white ring-2 ring-offset-1 scale-110" : "border-white/50"}`}
                  style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}` : "" }} />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">{t("proj.description")}</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 500))}
              placeholder={t("proj.desc_placeholder")}
              className="w-full px-3 py-2 rounded-xl border border-delt-border text-sm outline-none focus:border-delt-accent" />
          </div>

          {/* System prompt */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">
              {t("proj.sysprompt_label")}
            </label>
            <textarea value={sysPrompt} onChange={(e) => setSysPrompt(e.target.value.slice(0, 4000))} rows={5}
              placeholder={t("proj.sysprompt_placeholder")}
              className="w-full px-3 py-2 rounded-xl border border-delt-border text-sm outline-none focus:border-delt-accent resize-none font-mono" />
            <div className="text-[10px] text-delt-muted text-right mt-1">{sysPrompt.length} / 4000</div>
          </div>

          {/* Modèle par défaut */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">
              {t("proj.default_model")} <span className="font-normal normal-case">{t("proj.optional")}</span>
            </label>
            <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-delt-border text-sm outline-none focus:border-delt-accent bg-white">
              <option value="">{t("proj.no_default")}</option>
              {allModels.map((m) => (
                <option key={m.id} value={m.id}>{m.tier} · {m.display} ({m.brand})</option>
              ))}
            </select>
          </div>

          {/* Mémoire projet — faits clés */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">
              {t("proj.key_facts")} <span className="font-normal normal-case">{t("proj.key_facts_hint")}</span>
            </label>
            <textarea value={keyFacts} onChange={(e) => setKeyFacts(e.target.value)} rows={4}
              placeholder={t("proj.key_facts_placeholder").replace(/\\n/g, "\n")}
              className="w-full px-3 py-2 rounded-xl border border-delt-border text-sm outline-none focus:border-delt-accent resize-none font-mono" />
          </div>

          {/* Contexte libre */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">
              {t("proj.context")}
            </label>
            <textarea value={context} onChange={(e) => setContext(e.target.value.slice(0, 1000))} rows={3}
              placeholder={t("proj.context_placeholder")}
              className="w-full px-3 py-2 rounded-xl border border-delt-border text-sm outline-none focus:border-delt-accent resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-delt-border flex items-center justify-between gap-2 flex-shrink-0">
          <button onClick={remove} className="text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 px-3 py-2 rounded-full border border-red-200 hover:border-red-600 transition-colors">
            {t("proj.delete")}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-xs font-semibold text-delt-muted hover:text-delt-text px-3 py-2">
              {t("proj.cancel")}
            </button>
            <button onClick={save} disabled={saving}
              className="px-5 py-2 rounded-full text-sm font-bold text-white shadow-sm hover:shadow-md disabled:opacity-40 transition-all"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
              {saving ? t("proj.saving") : t("proj.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
