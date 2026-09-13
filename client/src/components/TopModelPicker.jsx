import { useState, useRef, useEffect } from "react";
import { PICKER, pickerEntry, KindIcon, estimateCost, brandGroupFromCatalog } from "../lib/modelPicker.jsx";

// Sélecteur de modèle du haut — visible MÊME en Auto. Liste « Auto » (le routeur
// choisit) + tous les modèles curés groupés par marque. Grise ceux hors quota.
export default function TopModelPicker({ selected, onSelect, onAuto, credits, catalog, lockBrand }) {
  const [open, setOpen] = useState(false);
  const [openFamily, setOpenFamily] = useState(null); // label de la famille dépliée (ex. "GPT-5.6")
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isAuto = !selected || String(selected.id || "").startsWith("brand:");
  const cur = !isAuto ? pickerEntry(selected.id) : null;
  const [proPrompt, setProPrompt] = useState(null); // confirmation avant le mode Pro
  // Verrou marque : une fois le chat sur une marque, on ne propose QUE cette marque.
  // Si la marque n'est pas dans le catalogue curé (marques peu connues), on
  // reconstruit son groupe depuis le catalogue serveur — jamais tout afficher.
  let brands;
  if (lockBrand) {
    const curated = PICKER.filter((b) => b.brand === lockBrand);
    brands = curated.length ? curated : [brandGroupFromCatalog(lockBrand, catalog)].filter(Boolean);
  } else {
    brands = PICKER;
  }

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
                // Famille dépliable (ex. GPT-5.6 → Sol / Terra / Luna)
                if (m.children) {
                  const isOpen = openFamily === m.label;
                  const childSel = m.children.some((c) => c.id === selected?.id);
                  return (
                    <div key={m.label}>
                      <button
                        onClick={() => setOpenFamily(isOpen ? null : m.label)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors ${childSel ? "bg-delt-surface" : "hover:bg-delt-surface/60"}`}>
                        <span className="w-7 h-7 rounded-lg bg-delt-surface flex items-center justify-center text-delt-muted flex-shrink-0"><KindIcon kind={m.kind} size={15} /></span>
                        <span className="text-[13px] font-medium text-delt-text flex-1">{m.label}</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`text-delt-muted flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      {isOpen && (
                        <div className="ml-4 pl-2 border-l border-delt-border/60">
                          {m.children.map((c) => {
                            const cCost = estimateCost(c.id, catalog);
                            const cLocked = credits != null && cCost > credits;
                            const cSel = selected?.id === c.id;
                            return (
                              <button key={c.id} disabled={cLocked}
                                onClick={() => { if (cLocked) return; onSelect({ id: c.id, brand: b.brand, display: c.label, tier: "NORMAL" }); setOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors ${cLocked ? "opacity-40 cursor-not-allowed" : cSel ? "bg-delt-surface" : "hover:bg-delt-surface/60"}`}>
                                <span className="w-6 h-6 rounded-lg bg-delt-surface flex items-center justify-center text-delt-muted flex-shrink-0"><KindIcon kind={c.kind} size={13} /></span>
                                <span className="text-[13px] font-medium text-delt-text flex-1">{c.label}</span>
                                {cSel && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                const cost = estimateCost(m.id, catalog);
                const locked = credits != null && cost > credits;
                const sel = selected?.id === m.id;
                // Variante « Pro » (ex. GPT-6 Astra) : sélectionnée, le modèle
                // affiche un interrupteur Pro qui bascule vers l'id premium.
                const proSel = m.proId && selected?.id === m.proId;
                return (
                  <div key={m.id}>
                  <button disabled={locked}
                    onClick={() => { if (locked) return; onSelect({ id: m.id, brand: b.brand, display: m.label, tier: "NORMAL" }); setOpen(false); }}
                    title={locked ? "Quota insuffisant — recharge pour débloquer" : undefined}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors ${locked ? "opacity-40 cursor-not-allowed" : (sel || proSel) ? "bg-delt-surface" : "hover:bg-delt-surface/60"}`}>
                    <span className="w-7 h-7 rounded-lg bg-delt-surface flex items-center justify-center text-delt-muted flex-shrink-0"><KindIcon kind={m.kind} size={15} /></span>
                    <span className="text-[13px] font-medium text-delt-text flex-1">{m.label}</span>
                    {locked
                      ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-delt-muted flex-shrink-0"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                      : (sel || proSel) && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>}
                  </button>
                  {m.proId && (sel || proSel) && (
                    <div className="ml-9 mb-1 flex items-center gap-2 px-2 py-1">
                      <button
                        onClick={() => {
                          if (proSel) { onSelect({ id: m.id, brand: b.brand, display: m.label, tier: "NORMAL" }); return; }
                          setProPrompt({ model: m, brand: b.brand });
                        }}
                        className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${proSel ? "bg-amber-500" : "bg-delt-border"}`}
                        aria-label="Mode Pro"
                      >
                        <span className={`absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${proSel ? "left-[16px]" : "left-0.5"}`} />
                      </button>
                      <span className={`text-[11px] font-semibold ${proSel ? "text-amber-600" : "text-delt-muted"}`}>Pro</span>
                    </div>
                  )}
                  </div>
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

      {/* Confirmation avant d'activer le mode Pro : il consomme le quota
          beaucoup plus vite, l'utilisateur doit le savoir avant, pas après. */}
      {proPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setProPrompt(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
              </span>
              <h3 className="text-sm font-bold text-delt-text">Activer le mode Pro ?</h3>
            </div>
            <p className="text-[13px] text-delt-muted leading-relaxed">
              Le mode Pro de <b>{proPrompt.model.label}</b> va consommer <b>beaucoup plus vite</b> ta limite.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setProPrompt(null)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-delt-muted hover:bg-delt-surface">
                Annuler
              </button>
              <button
                onClick={() => {
                  onSelect({ id: proPrompt.model.proId, brand: proPrompt.brand, display: `${proPrompt.model.label} Pro`, tier: "EXPERT" });
                  setProPrompt(null);
                  setOpen(false);
                }}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-amber-500 hover:bg-amber-600">
                Activer le mode Pro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
