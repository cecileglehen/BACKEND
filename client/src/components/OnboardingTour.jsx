import { useEffect, useLayoutEffect, useState } from "react";
import { useT } from "../lib/i18n.jsx";

const STEPS = [
  { id: "welcome",  selector: null,                  pos: "center" },
  { id: "composer", selector: '[data-tour="composer"]', pos: "top" },
  { id: "attach",   selector: '[data-tour="attach"]',   pos: "top" },
  { id: "models",   selector: '[data-tour="models"]',   pos: "top" },
  { id: "pills",    selector: '[data-tour="pills"]',    pos: "top" },
  { id: "tools",    selector: '[data-tour="tools"]',    pos: "top" },
  { id: "deep",     selector: '[data-tour="deep"]',     pos: "top" },
  { id: "debate",   selector: '[data-tour="debate"]',   pos: "top" },
  { id: "parallel", selector: '[data-tour="parallel"]', pos: "top" },
  { id: "done",     selector: null,                  pos: "center" }
];

export default function OnboardingTour({ open, onClose }) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);

  const visibleSteps = STEPS.filter((s) => {
    if (!s.selector) return true;
    return Boolean(document.querySelector(s.selector));
  });
  const step = visibleSteps[idx] || visibleSteps[0];

  useLayoutEffect(() => {
    if (!open || !step) return;
    if (!step.selector) { setRect(null); return; }
    const measure = () => {
      const el = document.querySelector(step.selector);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const id = setTimeout(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step?.id]);

  if (!open || !step) return null;

  const isFirst = idx === 0;
  const isLast = idx === visibleSteps.length - 1;
  const PAD = 8;
  const spotlight = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2
  };

  // Bubble position
  let bubbleStyle = { position: "fixed", zIndex: 10001 };
  if (!rect) {
    bubbleStyle = { ...bubbleStyle, top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  } else {
    const BUBBLE_W = 360;
    const margin = 16;
    const wantTop = rect.top - margin;
    const placeAbove = wantTop > 220;
    const top = placeAbove ? Math.max(16, rect.top - 16) : Math.min(window.innerHeight - 240, rect.top + rect.height + 16);
    const transformY = placeAbove ? "translateY(-100%)" : "translateY(0)";
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(16, Math.min(window.innerWidth - BUBBLE_W - 16, centerX - BUBBLE_W / 2));
    bubbleStyle = { ...bubbleStyle, top, left, width: BUBBLE_W, transform: transformY };
  }

  return (
    <>
      {/* Dark backdrop with spotlight cutout via big box-shadow */}
      {spotlight ? (
        <div
          className="fixed pointer-events-none transition-all duration-300"
          style={{
            ...spotlight,
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.65)",
            zIndex: 10000
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/65 z-[10000]" />
      )}

      {/* Pulsing ring on target */}
      {spotlight && (
        <div
          className="fixed pointer-events-none animate-pulse"
          style={{
            ...spotlight,
            borderRadius: 12,
            border: "2px solid rgba(99,102,241,0.9)",
            zIndex: 10000
          }}
        />
      )}

      {/* Bubble */}
      <div style={bubbleStyle} className="rounded-2xl bg-white shadow-2xl border border-indigo-200 overflow-hidden animate-fade-in">
        <div className="px-5 pt-4 pb-3 bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-100">
              {idx + 1} / {visibleSteps.length}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-indigo-100 hover:text-white text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="text-lg font-extrabold mt-1">{t(`tour.${step.id}.title`)}</div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-delt-text leading-relaxed">{t(`tour.${step.id}.body`)}</p>
          {(() => {
            const ex = t(`tour.${step.id}.example`);
            return ex && ex !== `tour.${step.id}.example` ? (
              <p className="text-xs text-delt-muted italic mt-2 leading-relaxed">{ex}</p>
            ) : null;
          })()}
        </div>
        <div className="flex items-center justify-between px-5 pb-4 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-delt-muted hover:text-delt-text"
          >
            {t("tour.skip")}
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-delt-text hover:bg-delt-surface"
              >
                {t("tour.prev")}
              </button>
            )}
            <button
              type="button"
              onClick={() => isLast ? onClose() : setIdx((i) => i + 1)}
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isLast ? t("tour.finish") : t("tour.next")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
