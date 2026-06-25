import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { api } from "../lib/api.js";
import { BRAND_CONFIG } from "../lib/brands.js";

// Widget de quota glissant 3h (façon Mammouth) — barre qui SE REMPLIT à la conso.
// Hover : zoom + popover (% total consommé, répartition par provider, simulation
// de l'usage sur les autres plans).
function countdown(resetAt) {
  const ms = new Date(resetAt).getTime() - Date.now();
  if (!(ms > 0)) return "0min";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}
const PLAN_ORDER = ["FREE", "BASIC", "PLUS", "PRO", "ULTRA"];
const brandLabel = (b) => BRAND_CONFIG[b]?.label || b;
const brandIcon = (b) => BRAND_CONFIG[b]?.icon || null;

export default function CreditMeter({ window: win, credits }) {
  const { user, windowQuotas } = useAuth();
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  const [bd, setBd] = useState(null);
  const ref = useRef(null);
  const hoverTimer = useRef(null);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Charge la répartition à l'ouverture (lazy).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api.quotaBreakdown().then((d) => { if (alive) setBd(d); }).catch(() => {});
    return () => { alive = false; };
  }, [open]);

  if (!win) {
    if (credits == null) return null;
    return <span className="text-[11px] font-mono font-semibold text-delt-muted">{Math.round(credits)} Cr</span>;
  }

  const { used = 0, quota = 1, resetAt } = win;
  const consumed = Math.max(0, Math.min(100, (used / quota) * 100)); // % CONSOMMÉ → la barre se remplit
  const color = consumed > 92 ? "#ef4444" : consumed > 75 ? "#f59e0b" : "#6366f1";
  const total = bd?.total ?? used;
  const quotas = windowQuotas || bd?.allQuotas || {};

  const show = () => { clearTimeout(hoverTimer.current); setOpen(true); };
  const hide = () => { hoverTimer.current = setTimeout(() => setOpen(false), 120); };

  return (
    <div className="relative" ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      {/* Pastille + barre qui se remplit, zoom au hover */}
      <div className={`flex items-center gap-2 min-w-[150px] cursor-default transition-transform duration-200 ${open ? "scale-110" : ""}`}
        title="Quota — survole pour le détail">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <div className="flex-1 h-1.5 rounded-full bg-delt-surface overflow-hidden min-w-[44px]">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${consumed}%`, background: color }} />
        </div>
        <span className="text-[10px] font-mono text-delt-muted flex-shrink-0 tabular-nums">{Math.round(consumed)}%</span>
      </div>

      {/* Popover détaillé */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl glass-strong shadow-xl border border-delt-border/60 p-3 animate-popIn">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-delt-text">Quota — fenêtre {win.windowHours || 3}h</span>
            <span className="text-[10px] font-mono text-delt-muted">↻ {countdown(resetAt)}</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-extrabold" style={{ color }}>{Math.round(consumed)}%</span>
            <span className="text-[11px] text-delt-muted">consommé</span>
          </div>
          <div className="h-2 rounded-full bg-delt-surface overflow-hidden mb-3">
            <div className="h-full rounded-full transition-all" style={{ width: `${consumed}%`, background: color }} />
          </div>

          {/* Répartition par provider */}
          <div className="text-[10px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">Par provider</div>
          {bd === null ? (
            <div className="text-[11px] text-delt-muted py-1">Chargement…</div>
          ) : (bd.byBrand?.length ? (
            <div className="space-y-1.5 mb-3">
              {bd.byBrand.map((b) => (
                <div key={b.brand} className="flex items-center gap-2">
                  {brandIcon(b.brand)
                    ? <img src={brandIcon(b.brand)} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
                    : <span className="w-3.5 h-3.5 rounded-full bg-delt-muted/40 flex-shrink-0" />}
                  <span className="text-[12px] font-medium text-delt-text w-16 flex-shrink-0 truncate">{brandLabel(b.brand)}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-delt-surface overflow-hidden">
                    <div className="h-full rounded-full bg-delt-accent" style={{ width: `${b.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-delt-muted w-8 text-right tabular-nums">{b.pct}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-delt-muted py-1 mb-2">Aucune conso sur cette fenêtre.</div>
          ))}

          {/* Simulation sur les autres plans */}
          <div className="text-[10px] font-bold uppercase tracking-widest text-delt-muted mb-1.5">Où en serais-tu sur…</div>
          <div className="flex flex-wrap gap-1.5">
            {PLAN_ORDER.filter((p) => quotas[p]).map((p) => {
              const pct = Math.round((total / quotas[p]) * 100);
              const isCur = p === user?.plan;
              const over = pct >= 100;
              return (
                <div key={p}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 ${
                    isCur ? "bg-delt-text text-white" : over ? "bg-red-50 text-red-600 border border-red-200" : "bg-delt-surface text-delt-muted"
                  }`}
                  title={`${p} : ${quotas[p]} Cr / ${win.windowHours || 3}h`}>
                  <span>{p}</span>
                  <span className="font-mono tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
