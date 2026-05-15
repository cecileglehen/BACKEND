import { useState } from "react";
import { api, setToken } from "../lib/api.js";

export default function PrivacySettingsPage({ onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const downloadExport = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const data = await api.exportPrivacyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delt-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone("Export genere.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    const ok = window.confirm("Supprimer definitivement ton compte DELT et ses donnees liees ? Cette action supprime aussi tes cles API et conversations.");
    if (!ok) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await api.deleteAccount();
      localStorage.removeItem("delt-conversations");
      setToken(null);
      onDeleted?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-10 space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-delt-text">Donnees & confidentialite</h1>
        <p className="text-sm text-delt-muted mt-1">
          Exerce tes droits d'acces, portabilite et effacement sur les donnees stockees cote serveur.
        </p>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {done && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{done}</div>}

      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-delt-text">Exporter mes donnees</h2>
        <p className="text-sm text-delt-muted mt-2">
          Telecharge un fichier JSON contenant ton compte, tes consentements, tes cles API masquees, l'usage et les donnees de conversation serveur disponibles.
        </p>
        <button onClick={downloadExport} disabled={busy} className="btn-primary mt-4 disabled:opacity-50">
          Exporter mes donnees
        </button>
      </div>

      <div className="card p-4 sm:p-5 border-red-200 bg-red-50">
        <h2 className="text-sm font-semibold text-red-700">Supprimer mon compte</h2>
        <p className="text-sm text-red-700/80 mt-2">
          Le compte, les conversations, les messages, les cles API, les consentements, les compteurs d'usage et l'historique local du navigateur sont supprimes.
          Les donnees de paiement conservees par les prestataires restent soumises a leurs obligations legales.
        </p>
        <button onClick={deleteAccount} disabled={busy} className="mt-4 rounded-lg bg-red-600 text-white text-sm font-semibold px-4 py-2 disabled:opacity-50">
          Supprimer mon compte
        </button>
      </div>
    </div>
  );
}
