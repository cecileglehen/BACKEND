export default function ExpertModal({ open, level, onChoice, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white shadow-pop w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 animate-slideUp"
      >
        <div className="mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-delt-gold">
            Niveau {level} · Requête complexe
          </span>
        </div>
        <h2 className="text-xl font-bold text-delt-text mb-1">Choix du moteur</h2>
        <p className="text-sm text-delt-muted mb-6">
          Cette requête demande une puissance de calcul élevée. Quel modèle veux-tu utiliser ?
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => onChoice("expert")}
            className="text-left p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100 transition-all cursor-pointer"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">Expert</div>
            <div className="font-bold text-delt-text">GPT-5.5 Pro</div>
            <div className="text-xs text-delt-muted mt-1">Raisonnement profond</div>
          </button>

          <button
            onClick={() => onChoice("normal")}
            className="text-left p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-all cursor-pointer"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700 mb-1">Standard</div>
            <div className="font-bold text-delt-text">GPT-5.4</div>
            <div className="text-xs text-delt-muted mt-1">Excellent compromis</div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full text-xs text-delt-muted hover:text-delt-text transition-colors cursor-pointer py-1"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
