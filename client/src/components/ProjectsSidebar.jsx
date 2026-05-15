import { useState } from "react";

const ICON_PRESETS = ["📁", "💻", "📱", "🎨", "📚", "🧠", "🚀", "🎬", "🎵", "✍️", "🔬", "💡", "🌍", "⚡", "🎯", "📊", "🍳", "🏋️"];
const COLOR_PRESETS = [
  "#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899",
  "#8b5cf6", "#3b82f6", "#84cc16", "#f97316", "#14b8a6", "#a855f7"
];

export default function ProjectsSidebar({
  projects = [],
  activeProjectId,
  onSelect,
  onCreate,
  onEdit,
  onClose
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newIcon, setNewIcon]   = useState("📁");
  const [newColor, setNewColor] = useState("#6366f1");

  const submit = async () => {
    if (!newName.trim()) return;
    await onCreate({ name: newName.trim(), icon: newIcon, color: newColor });
    setCreating(false); setNewName(""); setNewIcon("📁"); setNewColor("#6366f1");
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-delt-muted">Projets</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCreating(true)}
            className="w-7 h-7 rounded-full hover:bg-delt-surface flex items-center justify-center text-delt-muted hover:text-delt-text"
            aria-label="Nouveau projet"
            title="Nouveau projet"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          {onClose && (
            <button onClick={onClose} className="text-delt-muted hover:text-delt-text text-lg leading-none" aria-label="Fermer">✕</button>
          )}
        </div>
      </div>

      {/* Création inline */}
      {creating && (
        <div className="mx-3 mb-2 p-3 rounded-xl border-2 border-delt-accent bg-indigo-50 space-y-2 animate-fadeIn">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value.slice(0, 80))}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setCreating(false); }}
            placeholder="Nom du projet"
            className="w-full px-3 py-2 rounded-lg border border-delt-border text-sm outline-none focus:border-delt-accent bg-white"
          />
          <div className="flex flex-wrap gap-1">
            {ICON_PRESETS.map((i) => (
              <button
                key={i}
                onClick={() => setNewIcon(i)}
                className={`w-7 h-7 rounded-lg text-base flex items-center justify-center transition-colors ${
                  newIcon === i ? "bg-white shadow-sm" : "hover:bg-white/50"
                }`}
              >{i}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c ? "border-white ring-2 ring-delt-accent scale-110" : "border-white/50"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={submit}
              disabled={!newName.trim()}
              className="flex-1 px-3 py-1.5 rounded-lg bg-delt-text text-white text-xs font-bold disabled:opacity-40"
            >Créer</button>
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-lg text-xs text-delt-muted hover:text-delt-text">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Pas de projet */}
      {!creating && projects.length === 0 && (
        <div className="mx-3 mb-2 px-3 py-4 rounded-xl bg-delt-surface text-center">
          <div className="text-[11px] text-delt-muted leading-relaxed">
            Crée un projet pour grouper tes conversations<br/>(ex : <em>MyBibli</em>, <em>App Flutter</em>, <em>Roman SF</em>…)
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {/* Tous les chats */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
            !activeProjectId ? "bg-delt-panel text-delt-text" : "text-delt-muted hover:bg-delt-surface hover:text-delt-text"
          }`}
        >
          <span className="text-base">💬</span>
          <span className="text-sm font-semibold flex-1 text-left">Tous les chats</span>
        </button>

        {projects.map((p) => {
          const active = activeProjectId === p.id;
          return (
            <div key={p.id} className="group flex items-center">
              <button
                onClick={() => onSelect(p.id)}
                className={`flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors min-w-0 ${
                  active ? "text-delt-text" : "text-delt-muted hover:text-delt-text hover:bg-delt-surface"
                }`}
                style={active ? { background: `${p.color}15` } : {}}
              >
                <span className="text-base flex-shrink-0" style={{ filter: active ? "saturate(1.3)" : "" }}>{p.icon || "📁"}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate" style={active ? { color: p.color } : {}}>
                    {p.name}
                  </div>
                  {p.conversationCount > 0 && (
                    <div className="text-[10px] text-delt-muted">{p.conversationCount} conv{p.conversationCount > 1 ? "s" : ""}</div>
                  )}
                </div>
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(p)}
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center text-delt-muted hover:text-delt-text rounded-lg transition-opacity"
                  aria-label="Modifier"
                  title="Modifier le projet"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
