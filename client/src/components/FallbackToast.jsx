import { useEffect, useState } from "react";

export default function FallbackToast({ fellBack, from, tier }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (fellBack) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [fellBack, tier]);

  if (!visible || !fellBack) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fadeIn">
      <div className="card px-4 py-3 shadow-pop flex items-center gap-3 text-sm">
        <span className="text-amber-500">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 4a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 5zm0 6.5a1 1 0 110-2 1 1 0 010 2z"/>
          </svg>
        </span>
        <div>
          <span className="text-delt-muted">Quota </span>
          <span className="font-semibold">{from}</span>
          <span className="text-delt-muted"> atteint — passage automatique sur </span>
          <span className="font-semibold">{tier}</span>
        </div>
        <button onClick={() => setVisible(false)} className="text-delt-muted hover:text-delt-text cursor-pointer ml-1">
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
      </div>
    </div>
  );
}
