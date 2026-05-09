import { useState } from "react";
import { api } from "../lib/api.js";

export default function AgeGateModal({ open, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.ageVerify();
      onConfirm();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-pop w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#d97706" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-delt-text">Accès restreint · +18</h2>
            <p className="text-xs text-delt-muted">Venice — Dolphin Mistral 24B</p>
          </div>
        </div>

        <p className="text-sm text-delt-muted leading-relaxed mb-5">
          Ce modèle génère du contenu réservé aux adultes. En confirmant, tu attestes avoir{" "}
          <span className="font-semibold text-delt-text">18 ans ou plus</span> et acceptes la pleine responsabilité du contenu produit.
        </p>

        {error && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary text-sm py-2"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? "Vérification…" : "J'ai 18 ans et plus"}
          </button>
        </div>
      </div>
    </div>
  );
}
