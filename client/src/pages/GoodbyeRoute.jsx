import { useEffect, useState } from "react";
import { useT } from "../lib/i18n.jsx";

export default function GoodbyeRoute() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">

        <div className={`transition-all duration-700 ease-out ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-5xl mb-8 shadow-md">
            👋
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-delt-text leading-tight tracking-tight">
            {t("goodbye.title")}
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-delt-muted leading-relaxed max-w-xl mx-auto">
            {t("goodbye.body")}
            <span className="block mt-2 text-delt-text font-semibold">
              {t("goodbye.body_emphasis")}
            </span>
          </p>

          <div className="mt-10 grid sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
            <div className="rounded-xl border border-delt-border bg-white p-5">
              <div className="text-2xl mb-2">⭐</div>
              <div className="text-sm font-bold text-delt-text mb-1">{t("goodbye.alt_share")}</div>
              <p className="text-xs text-delt-muted">{t("goodbye.alt_share_desc")}</p>
            </div>
            <div className="rounded-xl border border-delt-border bg-white p-5">
              <div className="text-2xl mb-2">💼</div>
              <div className="text-sm font-bold text-delt-text mb-1">{t("goodbye.alt_sub")}</div>
              <p className="text-xs text-delt-muted">{t("goodbye.alt_sub_desc")}</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/notre-modele"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-md"
            >
              {t("goodbye.cta_retry")}
            </a>
            <a
              href="/billing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-delt-border hover:bg-delt-surface text-delt-text font-semibold transition-colors"
            >
              {t("goodbye.cta_billing")}
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-delt-muted hover:text-delt-text font-medium transition-colors"
            >
              {t("goodbye.cta_chat")}
            </a>
          </div>

          <p className="text-xs text-delt-muted mt-10 italic">
            {t("goodbye.note")}
          </p>

        </div>

      </div>
    </div>
  );
}
