import MessageRenderer from "./MessageRenderer.jsx";

const CAT_BADGE = {
  FREE:   "",
  UNCENSORED: "badge-venice",
  VENICE: "badge-venice",
  NANO:   "badge-eco",
  MINI:   "badge-mini",
  NORMAL: "badge-normal",
  PRICE:  "badge-price",
  EXPERT: "badge-expert"
};

export default function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  const generatedTokens = Number(msg.tokensOut ?? 0);
  return (
    <div className={`flex gap-3 animate-fadeIn ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
        isUser
          ? "bg-delt-text text-white"
          : "bg-delt-panel border border-delt-border"
      }`}>
        {isUser ? "T" : (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
            <path d="M12 4 L20 20 H4 Z" fill="#6366f1" />
          </svg>
        )}
      </div>

      {/* Bulle */}
      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {/* Meta modèle */}
        {!isUser && (msg.model || msg.tier) && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            {msg.model?.display && (
              <span className="text-xs font-medium text-delt-muted font-mono">{msg.model.display}</span>
            )}
            {msg.tier && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CAT_BADGE[msg.tier] ?? ""}`}>
                {msg.tier}
              </span>
            )}
            {Number.isFinite(generatedTokens) && generatedTokens > 0 && (
              <span className="text-[10px] text-delt-muted font-mono">
                {generatedTokens.toLocaleString("fr-FR")} tokens générés
              </span>
            )}
          </div>
        )}

        {/* Contenu */}
        <div className={`px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-delt-text text-white rounded-tr-sm text-sm leading-relaxed"
            : "bg-delt-surface border border-delt-border text-delt-text rounded-tl-sm"
        } ${msg.error ? "!bg-red-50 !border-red-200 !text-red-700" : ""}`}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          ) : (
            <MessageRenderer content={msg.content} />
          )}
        </div>
      </div>
    </div>
  );
}
