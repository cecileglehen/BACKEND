import { useState } from "react";
import { api } from "../lib/api.js";

export default function ArtistStudio() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("image");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const label = mode === "image" ? "Recraft V4 Pro" : "Sora 2 Pro";
  const videoWarning = "Attention : une génération avec ce modèle vous coûte 12 euros.";

  const submit = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fn = mode === "image" ? api.image : api.video;
      const r = await fn(prompt);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card p-6">
        <h2 className="font-bold text-lg text-delt-text mb-1">Studio Artiste</h2>
        <p className="text-sm text-delt-muted mb-5">Génère des images et vidéos avec les meilleurs modèles créatifs.</p>

        {/* Mode selector */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setMode("image"); setResult(null); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
              mode === "image"
                ? "bg-delt-text text-white border-delt-text"
                : "border-delt-border text-delt-muted hover:text-delt-text bg-white"
            }`}
          >
            Image
          </button>
          <button
            onClick={() => { setMode("video"); setResult(null); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
              mode === "video"
                ? "bg-delt-text text-white border-delt-text"
                : "border-delt-border text-delt-muted hover:text-delt-text bg-white"
            }`}
          >
            Vidéo · Sora 2 Pro
          </button>
        </div>

        {mode === "video" && (
          <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {videoWarning}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === "image"
              ? "Décris l'image : style, sujet, ambiance, palette de couleurs…"
              : "Décris la vidéo : scène, action, durée, style cinématographique…"
          }
          rows={4}
          className="w-full rounded-xl bg-delt-surface border border-delt-border px-4 py-3 text-sm outline-none focus:border-delt-accent focus:ring-1 focus:ring-delt-accent/20 transition-all resize-none"
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-delt-muted">
            Modèle : <span className="font-medium text-delt-text">{label}</span>
          </span>
          <button
            disabled={busy || !prompt.trim()}
            onClick={submit}
            className="btn-primary"
          >
            {busy ? "Génération…" : "Générer"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-3">Résultat</div>
          {result.url && (
            <div className="mb-4">
              <img
                src={result.url}
                alt={result.prompt}
                className="w-full rounded-xl border border-delt-border"
              />
              <a
                href={result.url}
                download="delt-image.png"
                className="inline-block mt-3 text-xs text-delt-accent hover:underline"
              >
                Télécharger l'image
              </a>
            </div>
          )}
          <div className="text-sm space-y-1.5">
            <div><span className="text-delt-muted">Provider :</span> <code className="font-mono text-xs">{result.provider}</code></div>
            <div><span className="text-delt-muted">Prompt :</span> {result.prompt}</div>
          </div>
          {result.placeholder && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {result.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
