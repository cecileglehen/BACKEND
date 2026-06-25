import { useState, useRef, useEffect } from "react";
import { PICKER, pickerEntry, KindIcon, estimateCost } from "../lib/modelPicker.jsx";

// Sélecteur de modèle du haut — visible MÊME en Auto. Liste « Auto » (le routeur
// choisit) + tous les modèles curés groupés par marque. Grise ceux hors quota.
export default function TopModelPicker({ selected, onSelect, onAuto, credits, catalog, lockBrand }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isAuto = !selected || String(selected.id || "").startsWith("brand:");
  const cur = !isAuto ? pickerEntry(selected.id) : null;
  // Verrou marque : une fois le chat sur une marque, on ne propose QUE cette marque.
  const brands = lockBrand ? PICKER.filter((b) => b.brand === lockBrand) : PICKER;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full glass-pill px-3 py-1.5 text-sm font-semibold text-delt-text hover:shadow-sm transition-all">
        {cur ? <KindIcon kind={cur.kind} /> : (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z"/></svg>
        )}
        <span>{cur ? cur.label : (selected?.display || "Auto")}</span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`text-delt-muted transition-transform ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-40 w-64 max-h-[60vh] overflow-y-auto rounded-2xl glass-strong shadow-xl border border-delt-border/60 p-1.5">
          {/* Auto — masqué quand le chat est verrouillé sur une marque */}
          {!lockBrand && (
            <button onClick={() => { onAuto(); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors ${isAuto ? "bg-delt-surface" : "hover:bg-delt-surface/60"}`}>
              <span className="w-7 h-7 rounded-lg bg-delt-surface flex items-center justify-center text-delt-muted flex-shrink-0">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" /></svg>
              </span>
              <span className="text-[13px] font-medium text-delt-text flex-1">Auto <span className="text-delt-muted">— le routeur choisit</span></span>
              {isAuto && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>}
            </button>
          )}

          {brands.map((b) => (
            <div key={b.brand}>
              <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-delt-muted">{b.label}</div>
              {b.models.map((m) => {
                const cost = estimateCost(m.id, catalog);
                const locked = credits != null && cost > credits;
                const sel = selected?.id === m.id;
                return (
                  <button key={m.id} disabled={locked}
                    onClick={() => { if (locked) return; onSelect({ id: m.id, brand: b.brand, display: m.label, tier: "NORMAL" }); setOpen(false); }}
                    title={locked ? "Quota insuffisant — recharge pour débloquer" : undefined}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors ${locked ? "opacity-40 cursor-not-allowed" : sel ? "bg-delt-surface" : "hover:bg-delt-surface/60"}`}>
                    <span className="w-7 h-7 rounded-lg bg-delt-surface flex items-center justify-center text-delt-muted flex-shrink-0"><KindIcon kind={m.kind} size={15} /></span>
                    <span className="text-[13px] font-medium text-delt-text flex-1">{m.label}</span>
                    {locked
                      ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-delt-muted flex-shrink-0"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                      : sel && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>}
                  </button>
                );
              })}
            </div>
          ))}

          {/* ── Légendes : les premiers modèles de chaque provider ── */}
          {(() => {
            const legacy = (catalog?.categories?.LEGACY?.models || []).filter((m) => !lockBrand || m.brand === lockBrand);
            if (!legacy.length) return null;
            return (
              <div className="mt-1.5 pt-2 border-t border-delt-border/50">
                <div className="px-2 pb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-delt-muted">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                  Time Machine
                </div>
                {legacy.map((m) => {
                  const sel = selected?.id === m.id;
                  return (
                    <button key={m.id}
                      onClick={() => { onSelect({ id: m.id, brand: m.brand, display: m.display, tier: "LEGACY" }); setOpen(false); }}
                      title={m.tagline || ""}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors ${sel ? "bg-delt-surface" : "hover:bg-delt-surface/60"}`}>
                      <span className="w-7 h-7 rounded-lg bg-delt-surface flex items-center justify-center text-delt-muted flex-shrink-0">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                      </span>
                      <span className="text-[13px] font-medium text-delt-text flex-1 truncate">{m.display}</span>
                      {sel && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
