const TIER_COLORS = {
  EXPERT: { bar: "#f59e0b", bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  PRICE:  { bar: "#ec4899", bg: "#fdf2f8", text: "#9d174d", border: "#fbcfe8" },
  NORMAL: { bar: "#6366f1", bg: "#eef2ff", text: "#3730a3", border: "#c7d2fe" },
  MINI:   { bar: "#0891b2", bg: "#ecfeff", text: "#155e75", border: "#a5f3fc" },
  NANO:   { bar: "#10b981", bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  FREE:   { bar: "#94a3b8", bg: "#f8fafc", text: "#475569", border: "#e2e8f0" }
};

const PLAN_COLORS = {
  LITE:  "#10b981",
  PLUS:  "#6366f1",
  PRO:   "#0891b2",
  ULTRA: "#f59e0b"
};

function TierRow({ tier, data }) {
  const c = TIER_COLORS[tier] ?? TIER_COLORS.NANO;
  const pct = data.quota5h > 0 ? Math.min(100, (data.used5h / data.quota5h) * 100) : 0;
  const full = pct >= 100;
  const remaining = Math.max(0, Math.round(100 - pct));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
        >
          {tier}
        </span>
        <span className="text-[10px] text-delt-muted">
          {full ? "limite atteinte" : `${remaining}% disponible`}
        </span>
      </div>
      <div className="h-1 rounded-full bg-delt-panel overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: full ? "#ef4444" : c.bar }}
        />
      </div>
    </div>
  );
}

export default function QuotaBar({ plan, quota, resetAt }) {
  if (!quota) return null;
  const planColor = PLAN_COLORS[plan] ?? "#6366f1";

  const nextReset = Object.values(quota)
    .map((q) => q.windowResetAt)
    .filter(Boolean)
    .sort()[0];

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-delt-muted uppercase tracking-wider">Utilisation · fenêtre 5h</span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
          style={{ background: planColor }}
        >
          {plan}
        </span>
      </div>

      {["EXPERT", "PRICE", "NORMAL", "MINI", "NANO", "FREE"].map((tier) => (
        <TierRow key={tier} tier={tier} data={quota[tier] ?? { used5h: 0, quota5h: tier === "FREE" ? 99999 : 0 }} />
      ))}

      {nextReset && (
        <div className="text-[10px] text-delt-muted text-right">
          Reset :{" "}
          {new Date(nextReset).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
