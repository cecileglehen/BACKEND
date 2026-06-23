import { useState } from "react";
import { useT } from "../lib/i18n.jsx";

function useTimeAgo() {
  const t = useT();
  return (ts) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return t("sidebar.time_just_now");
    if (m < 60) return t("sidebar.time_min", { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("sidebar.time_hour", { n: h });
    const d = Math.floor(h / 24);
    return t("sidebar.time_day", { n: d });
  };
}

export default function ConversationList({ conversations, activeId, onSelect, onNew, onDelete }) {
  const t = useT();
  const timeAgo = useTimeAgo();
  const [hovered, setHovered] = useState(null);

  return (
    <div className="flex flex-col h-full">
      {/* Bouton nouvelle conv */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl glass-pill text-sm font-medium text-delt-text hover:bg-white/80 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          {t("sidebar.new_conv")}
        </button>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 stagger-children">
        {conversations.length === 0 ? (
          <div className="text-xs text-delt-muted text-center py-8 px-3">
            {t("sidebar.empty")}
          </div>
        ) : (
          conversations.map((conv) => {
            const active = conv.id === activeId;
            return (
              <div
                key={conv.id}
                className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  active ? "bg-white/80 shadow-sm ring-1 ring-delt-border/60" : "hover:bg-white/50"
                }`}
                onMouseEnter={() => setHovered(conv.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect(conv.id)}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-delt-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H2a1 1 0 00-1 1v9a1 1 0 001 1h3l3 2 3-2h3a1 1 0 001-1V3a1 1 0 00-1-1z" />
                </svg>

                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${active ? "text-delt-text" : "text-delt-muted group-hover:text-delt-text"}`}>
                    {conv.title}
                  </div>
                  <div className="text-[10px] text-delt-muted mt-0.5">
                    {timeAgo(conv.updatedAt)} · {conv.messageCount ?? conv.messages?.length ?? 0} msg
                  </div>
                </div>

                {(hovered === conv.id || active) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="flex-shrink-0 p-0.5 rounded text-delt-muted hover:text-red-500 transition-colors cursor-pointer"
                    title={t("sidebar.delete")}
                  >
                    <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 2l10 10M12 2L2 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
