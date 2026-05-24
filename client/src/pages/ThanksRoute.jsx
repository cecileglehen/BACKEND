import { useEffect, useState } from "react";
import { useT } from "../lib/i18n.jsx";

export default function ThanksRoute() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-blue-50 via-white to-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">

        <div className={`transition-all duration-700 ease-out ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-5xl mb-8 shadow-lg">
            ❤️
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-delt-text leading-tight tracking-tight">
            {t("thanks.title")}
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-delt-muted leading-relaxed max-w-xl mx-auto">
            {t("thanks.body")}
            <span className="block mt-2 font-semibold text-delt-text">
              {t("thanks.body_emphasis")}
            </span>
          </p>

          <div className="mt-10 grid sm:grid-cols-3 gap-3 max-w-xl mx-auto">
            <div className="rounded-xl border border-delt-border bg-white p-4">
              <div className="text-2xl mb-1">🧠</div>
              <div className="text-xs text-delt-muted uppercase tracking-wider font-semibold">{t("thanks.step_today")}</div>
              <div className="text-sm font-bold text-delt-text mt-1">DELT 33M</div>
            </div>
            <div className="rounded-xl border-2 border-blue-400 bg-blue-50 p-4">
              <div className="text-2xl mb-1">🚀</div>
              <div className="text-xs text-blue-700 uppercase tracking-wider font-bold">{t("thanks.step_next")}</div>
              <div className="text-sm font-bold text-delt-text mt-1">DELT 750M</div>
            </div>
            <div className="rounded-xl border border-delt-border bg-white p-4">
              <div className="text-2xl mb-1">🌌</div>
              <div className="text-xs text-delt-muted uppercase tracking-wider font-semibold">{t("thanks.step_goal")}</div>
              <div className="text-sm font-bold text-delt-text mt-1">DELT 5B</div>
            </div>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/notre-modele"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-md"
            >
              {t("thanks.cta_back")}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7"/>
              </svg>
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-delt-border hover:bg-delt-surface text-delt-text font-semibold transition-colors"
            >
              {t("thanks.cta_chat")}
            </a>
          </div>

          <p className="text-xs text-delt-muted mt-10 italic">
            {t("thanks.receipt")}
          </p>

        </div>

      </div>
    </div>
  );
}
