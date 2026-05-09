export default function AutoToggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center gap-3 w-full text-left cursor-pointer"
    >
      <div className={`toggle ${on ? "on" : ""}`} />
      <div>
        <div className="text-sm font-semibold text-delt-text">
          {on ? "Mode automatique" : "Mode manuel"}
        </div>
        <div className="text-xs text-delt-muted mt-0.5">
          {on ? "Triage via Groq · Llama 4 Scout" : "Choisis ton modèle"}
        </div>
      </div>
    </button>
  );
}
