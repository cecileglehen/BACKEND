import { useState } from "react";
import { useT } from "../lib/i18n.jsx";
import { BRAND_CONFIG } from "../lib/brands.js";

// Déduit la marque depuis l'id du modèle (préfixe provider) → logo dans la liste.
const PREFIX_BRAND = {
  "openai/": "OpenAI", "anthropic/": "Anthropic", "google/": "Google",
  "x-ai/": "xAI", "mistralai/": "Mistral", "deepseek/": "DeepSeek",
  "qwen/": "Qwen", "meta-llama/": "Meta", "z-ai/": "Z.ai",
  "perplexity/": "Perplexity", "moonshotai/": "Moonshot", "fal-ai/": "fal"
};
function brandIconOf(modelId) {
  if (!modelId) return null;
  for (const [p, b] of Object.entries(PREFIX_BRAND)) {
    if (modelId.startsWith(p)) return BRAND_CONFIG[b]?.icon || null;
  }
  return null;
}

export default function ConversationList({ conversations, activeId, onSelect, onNew, onDelete }) {
  const t = useT();
  const [hovered, setHovered] = useState(null);

  return (
    <div className="flex flex-col h-full">
      {/* En-tête épuré + nouvelle conv */}
      <div className="px-3 pt-1 pb-2 flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-delt-muted">{t("sidebar.new_conv")}</span>
        <button
          onClick={onNew}
          title={t("sidebar.new_conv")}
          className="w-7 h-7 flex items-center justify-center rounded-full text-delt-muted hover:text-delt-text hover:bg-white/70 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>

      {/* Liste — ligne unique : icône provider + titre */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-px stagger-children">
        {conversations.length === 0 ? (
          <div className="text-xs text-delt-muted text-center py-8 px-3">
            {t("sidebar.empty")}
          </div>
        ) : (
          conversations.map((conv) => {
            const active = conv.id === activeId;
            const icon = brandIconOf(conv.lastModelId);
            return (
              <div
                key={conv.id}
                className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  active ? "bg-white/80 text-delt-text" : "hover:bg-white/50"
                }`}
                onMouseEnter={() => setHovered(conv.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect(conv.id)}
              >
                {icon ? (
                  <img src={icon} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0 text-delt-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H2a1 1 0 00-1 1v9a1 1 0 001 1h3l3 2 3-2h3a1 1 0 001-1V3a1 1 0 00-1-1z" />
                  </svg>
                )}

                <span className={`flex-1 min-w-0 text-[14px] truncate ${active ? "text-delt-text font-medium" : "text-delt-muted group-hover:text-delt-text"}`}>
                  {conv.title}
                </span>

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
