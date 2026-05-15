import { useState } from "react";
import { api } from "../lib/api.js";

const STYLE_PRESETS = [
  "Pop", "Rock", "Hip-Hop", "R&B", "Electronic", "Jazz", "Classical",
  "Folk", "Country", "Reggae", "Lo-fi", "Cinematic", "Ambient", "Funk"
];

async function downloadMedia(url, ext = "mp3") {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `delt-music-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

export default function MusicComposer({ cost = 25, onCreditsUsed }) {
  const [title, setTitle]               = useState("");
  const [style, setStyle]               = useState("Pop");
  const [prompt, setPrompt]             = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [vocalGender, setVocalGender]   = useState("");
  const [negativeTags, setNegativeTags] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [styleWeight, setStyleWeight]               = useState(0.65);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(0.5);
  const [audioWeight, setAudioWeight]               = useState(0.65);

  // État de génération
  const [busy, setBusy]       = useState(false);
  const [tracks, setTracks]   = useState([]);
  const [error, setError]     = useState(null);

  const titleOk  = title.trim().length > 0;
  const styleOk  = style.trim().length > 0;
  const promptOk = prompt.trim().length > 0;
  const formValid = titleOk && styleOk && promptOk;

  const handleGenerate = async () => {
    if (!formValid || busy) return;
    setBusy(true);
    setError(null);
    setTracks([]);
    try {
      const result = await api.music({
        title: title.trim(),
        style: style.trim(),
        prompt: prompt.trim(),
        instrumental,
        ...(vocalGender && { vocalGender }),
        ...(negativeTags.trim() && { negativeTags: negativeTags.trim() }),
        styleWeight,
        weirdnessConstraint,
        audioWeight,
        customMode: true,
        model: "V5_5"
      });
      setTracks(result.tracks || []);
      onCreditsUsed?.();
    } catch (e) {
      setError(e.message || "Erreur de génération");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setTracks([]);
    setError(null);
  };

  return (
    <div className="bg-white border border-delt-border rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          <h3 className="font-bold text-delt-text">Studio musique — Suno V5.5</h3>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
          {cost} Cr / piste
        </span>
      </div>

      {/* Title */}
      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-delt-muted mb-1.5">
          Titre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="Ex : Coucher de soleil sur la plage"
          disabled={busy}
          className="w-full px-4 py-2.5 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm disabled:opacity-50"
        />
      </div>

      {/* Style */}
      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-delt-muted mb-1.5">
          Style musical <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={style}
          onChange={(e) => setStyle(e.target.value.slice(0, 100))}
          placeholder="Ex : Lo-fi hip-hop chill"
          disabled={busy}
          className="w-full px-4 py-2.5 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm mb-2 disabled:opacity-50"
        />
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => setStyle(s)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                style === s
                  ? "bg-purple-100 border-purple-300 text-purple-700"
                  : "bg-white border-delt-border text-delt-muted hover:border-delt-text/30 hover:text-delt-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt / Paroles */}
      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-delt-muted mb-1.5">
          {instrumental ? "Description musicale" : "Paroles ou description"} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 3000))}
          rows={5}
          disabled={busy}
          placeholder={instrumental
            ? "Ex : Mélodie piano douce avec un crescendo épique au milieu, ambiance cinématographique nostalgique..."
            : "Écris tes paroles ici, ou décris l'ambiance que tu veux pour que Suno génère les paroles..."
          }
          className="w-full px-4 py-3 rounded-xl border border-delt-border bg-delt-surface focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm resize-none font-mono disabled:opacity-50"
        />
        <div className="text-[10px] text-delt-muted mt-1 text-right">{prompt.length} / 3000</div>
      </div>

      {/* Options rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-delt-border bg-white hover:bg-delt-surface cursor-pointer transition-colors ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          <input
            type="checkbox"
            checked={instrumental}
            onChange={(e) => setInstrumental(e.target.checked)}
            className="w-4 h-4 rounded accent-purple-500"
          />
          <span className="text-sm font-medium text-delt-text">Instrumental (sans voix)</span>
        </label>

        <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border border-delt-border bg-white ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          <span className="text-sm font-medium text-delt-text whitespace-nowrap">Voix :</span>
          {[
            { v: "",  l: "Auto" },
            { v: "m", l: "♂" },
            { v: "f", l: "♀" }
          ].map(({ v, l }) => (
            <button
              key={v || "auto"}
              type="button"
              disabled={instrumental}
              onClick={() => setVocalGender(v)}
              className={`flex-1 text-xs px-2 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                vocalGender === v
                  ? "bg-purple-100 text-purple-700"
                  : "text-delt-muted hover:text-delt-text hover:bg-delt-surface"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-delt-muted hover:text-delt-text transition-colors"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${advancedOpen ? "rotate-90" : ""}`}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          Options avancées
        </button>

        {advancedOpen && (
          <div className="mt-3 space-y-3 p-4 rounded-xl bg-delt-surface border border-delt-border">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-delt-muted mb-1">
                Tags négatifs (à éviter)
              </label>
              <input
                type="text"
                value={negativeTags}
                onChange={(e) => setNegativeTags(e.target.value.slice(0, 200))}
                placeholder="Ex : heavy metal, screaming, distortion"
                disabled={busy}
                className="w-full px-3 py-2 rounded-lg border border-delt-border bg-white text-sm outline-none focus:border-purple-400 disabled:opacity-50"
              />
            </div>

            {[
              { label: "Force du style", value: styleWeight, setter: setStyleWeight, hint: "0 = libre · 1 = strict" },
              { label: "Originalité",     value: weirdnessConstraint, setter: setWeirdnessConstraint, hint: "0 = classique · 1 = expérimental" },
              { label: "Poids audio",     value: audioWeight, setter: setAudioWeight, hint: "Qualité du mix" }
            ].map(({ label, value, setter, hint }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-delt-muted">{label}</label>
                  <span className="text-[11px] font-mono text-delt-text">{value.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={value}
                  onChange={(e) => setter(parseFloat(e.target.value))}
                  disabled={busy}
                  className="w-full accent-purple-500 disabled:opacity-50"
                />
                <div className="text-[10px] text-delt-muted">{hint}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!formValid || busy}
        className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
        style={{ background: formValid && !busy ? "linear-gradient(135deg, #a855f7, #ec4899)" : "#94a3b8" }}
      >
        {busy ? (
          <>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin" style={{ animationDuration: "1.5s" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
            </svg>
            Composition en cours… (1-3 min)
          </>
        ) : (
          `Générer la musique · ${cost} Cr`
        )}
      </button>

      {!formValid && !busy && (
        <p className="text-[11px] text-delt-muted text-center mt-2">
          Remplis le titre, le style et la description / paroles pour générer
        </p>
      )}

      {/* État de chargement */}
      {busy && (
        <div className="mt-5 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex gap-1">
              {[0, 0.15, 0.3].map((d) => (
                <span
                  key={d}
                  className="w-2 h-2 rounded-full bg-purple-400"
                  style={{ animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${d}s` }}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-purple-700">Suno compose ta musique…</span>
          </div>
          <p className="text-xs text-purple-600/70">Suno génère 2 pistes différentes à partir de tes paramètres. Patience, ça vaut le coup ⏱️</p>
        </div>
      )}

      {/* Erreur */}
      {error && !busy && (
        <div className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2.5">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-700">Erreur</div>
            <div className="text-xs text-red-600 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Pistes générées */}
      {tracks.length > 0 && !busy && (
        <div className="mt-6 pt-5 border-t border-delt-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-delt-text flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {tracks.length} piste{tracks.length > 1 ? "s" : ""} générée{tracks.length > 1 ? "s" : ""}
            </h4>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-delt-muted hover:text-delt-text font-medium"
            >
              Nouvelle génération
            </button>
          </div>

          <div className="space-y-3">
            {tracks.map((track, idx) => (
              <div
                key={track.id || idx}
                className="flex gap-3 items-start p-3 rounded-xl bg-gradient-to-r from-purple-50/40 to-pink-50/40 border border-purple-100"
              >
                {track.imageUrl ? (
                  <img
                    src={track.imageUrl}
                    alt={track.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex-shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="2">
                      <path d="M9 18V5l12-2v13"/>
                      <circle cx="6" cy="18" r="3"/>
                      <circle cx="18" cy="16" r="3"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-delt-text truncate">
                    {track.title || `Piste ${idx + 1}`}
                  </div>
                  {track.tags && (
                    <div className="text-[11px] text-delt-muted truncate mb-1.5">{track.tags}</div>
                  )}
                  {track.duration && (
                    <div className="text-[10px] text-delt-muted font-mono mb-1.5">{Math.round(track.duration)}s</div>
                  )}
                  <audio src={track.audioUrl} controls className="w-full" style={{ height: 32 }} />
                </div>
                <button
                  type="button"
                  onClick={() => downloadMedia(track.audioUrl, "mp3")}
                  className="p-2 rounded-lg text-delt-muted hover:text-purple-600 hover:bg-purple-50 flex-shrink-0 transition-colors"
                  title="Télécharger MP3"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
