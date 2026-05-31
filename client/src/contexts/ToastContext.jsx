import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = ++_id;
    const t = { id, type: "info", duration: 4000, ...toast };
    setToasts((prev) => [...prev, t]);
    if (t.duration > 0) {
      setTimeout(() => remove(id), t.duration);
    }
    return id;
  }, [remove]);

  const toast = {
    info: (message, opts) => push({ type: "info", message, ...opts }),
    success: (message, opts) => push({ type: "success", message, ...opts }),
    error: (message, opts) => push({ type: "error", message, duration: 6000, ...opts }),
    warn: (message, opts) => push({ type: "warn", message, ...opts }),
    dismiss: remove
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastContainer({ toasts, onClose }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

const TOAST_STYLES = {
  info:    { bg: "bg-white", border: "border-delt-border", icon: "ℹ", iconColor: "text-delt-accent" },
  success: { bg: "bg-white", border: "border-emerald-200", icon: "✓", iconColor: "text-emerald-600" },
  error:   { bg: "bg-white", border: "border-red-200", icon: "✕", iconColor: "text-red-600" },
  warn:    { bg: "bg-white", border: "border-amber-200", icon: "!", iconColor: "text-amber-600" }
};

function ToastItem({ toast, onClose }) {
  const s = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  return (
    <div
      role="status"
      className={`pointer-events-auto ${s.bg} ${s.border} border rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-slideInRight`}
    >
      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${s.iconColor}`}>
        {s.icon}
      </span>
      <div className="flex-1 text-sm text-delt-text min-w-0">
        {toast.title && <div className="font-semibold mb-0.5">{toast.title}</div>}
        <div className="break-words">{toast.message}</div>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-delt-muted hover:text-delt-text text-sm leading-none"
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  );
}
