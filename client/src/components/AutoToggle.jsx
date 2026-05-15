export default function AutoToggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      className={`flex items-center gap-3 w-full text-left ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className={`toggle ${on && !disabled ? "on" : ""}`} />
      <div>
        <div className="text-sm font-semibold text-delt-text">
          {on ? "Mode automatique" : "Mode manuel"}
        </div>
        <div className="text-xs text-delt-muted mt-0.5">
          {disabled
            ? "Disponible à partir du plan BASIC"
            : on
            ? "Le routeur choisit automatiquement le meilleur modèle pour ta requête."
            : "Choisis ton modèle"}
        </div>
      </div>
    </button>
  );
}
