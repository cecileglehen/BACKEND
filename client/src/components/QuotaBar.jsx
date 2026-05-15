const PLAN_COLORS = {
  FREE:  "#94a3b8",
  BASIC: "#10b981",
  PLUS:  "#6366f1",
  PRO:   "#0891b2",
  ULTRA: "#f59e0b"
};

export default function QuotaBar({ plan }) {
  const planColor = PLAN_COLORS[plan] ?? "#6366f1";
  const isFree = plan === "FREE";

  if (isFree) {
    return (
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-delt-muted uppercase tracking-wider">Plan</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: planColor }}>
            FREE
          </span>
        </div>
        <div className="text-xs text-delt-muted leading-relaxed">
          Accès aux modèles gratuits.<br />
          <span className="text-delt-accent font-medium cursor-pointer">Passe à BASIC</span> pour tout débloquer.
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-delt-muted uppercase tracking-wider">Plan</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: planColor }}>
          {plan}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span className="text-base font-bold text-delt-text">Tout est dispo</span>
      </div>
      <div className="text-[11px] text-delt-muted leading-relaxed">
        Tous les modèles, image, vidéo, musique et API inclus.
      </div>
    </div>
  );
}
