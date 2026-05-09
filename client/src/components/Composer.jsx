import { useEffect, useRef } from "react";

export default function Composer({ value, onChange, onSend, disabled, hint }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(160, el.scrollHeight) + "px";
  }, [value]);

  return (
    <div className="card p-3">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && value.trim()) onSend();
          }
        }}
        placeholder="Envoie un message…"
        rows={1}
        className="w-full outline-none resize-none text-sm text-delt-text placeholder:text-delt-muted leading-relaxed bg-transparent"
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-delt-border">
        <span className="text-xs text-delt-muted">{hint}</span>
        <button
          disabled={disabled || !value.trim()}
          onClick={onSend}
          className="btn-primary text-xs py-1.5 px-3"
        >
          {disabled ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay:"0.2s"}} />
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay:"0.4s"}} />
            </span>
          ) : (
            <>
              Envoyer
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                <path d="M14.5 8L2 14l2-6L2 2z"/>
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
