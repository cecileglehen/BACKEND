import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import MusicComposer from "./MusicComposer.jsx";
import { useT } from "../lib/i18n.jsx";

const STYLE_PRESETS = [
  { label: "Aucun",         prompt: "" },
  { label: "Photoréaliste", prompt: ", photorealistic, ultra detailed, 8k, professional photography, sharp focus" },
  { label: "Cinematic",     prompt: ", cinematic lighting, film grain, dramatic shadows, anamorphic, depth of field" },
  { label: "Anime",         prompt: ", anime style, vibrant colors, cel shading, studio ghibli inspired" },
  { label: "3D / Pixar",    prompt: ", 3d render, pixar style, soft lighting, smooth surfaces, octane render" },
  { label: "Aquarelle",     prompt: ", watercolor painting, soft brushstrokes, paper texture, pastel colors" },
  { label: "Minimaliste",   prompt: ", minimalist, clean composition, negative space, simple shapes, flat colors" },
  { label: "Cyberpunk",     prompt: ", cyberpunk, neon lights, futuristic city, rain, blade runner aesthetic" },
  { label: "Vintage",       prompt: ", vintage photo, sepia tones, film grain, 1970s, nostalgic" },
];

const ASPECT_RATIOS = [
  { label: "Carré",    value: "1:1",  w: 32, h: 32 },
  { label: "Portrait", value: "9:16", w: 22, h: 38 },
  { label: "Paysage",  value: "16:9", w: 40, h: 22 },
  { label: "Vertical", value: "3:4",  w: 26, h: 34 },
  { label: "Wide",     value: "21:9", w: 42, h: 18 },
];

async function downloadMedia(url, ext = "png") {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `delt-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

function TabButton({ active, onClick, icon, label, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${
        active
          ? "border-transparent text-white shadow-md"
          : "border-delt-border bg-white text-delt-text hover:border-delt-text/30"
      }`}
      style={active ? { background: "linear-gradient(135deg, #6366f1, #06b6d4)" } : {}}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          active ? "bg-white/20" : "bg-delt-surface"
        }`}
      >
        {icon}
      </div>
      <div className="text-left min-w-0">
        <div className={`text-sm font-bold ${active ? "text-white" : "text-delt-text"}`}>{label}</div>
        <div className={`text-[10px] ${active ? "text-white/80" : "text-delt-muted"} truncate`}>{sub}</div>
      </div>
    </button>
  );
}

function ImageTab({ catalog, onCreditsUsed }) {
  const t = useT();
  const [prompt, setPrompt]       = useState("");
  const [modelId, setModelId]     = useState("fal-ai/flux-1/schnell");
  const [style, setStyle]         = useState(STYLE_PRESETS[0].label);
  const [aspect, setAspect]       = useState("1:1");
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState(null);
  const [history, setHistory]     = useState([]);

  const imageModels = catalog?.creative?.IMAGE?.models || [];
  const selectedModel = imageModels.find((m) => m.id === modelId) || imageModels[0];

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setError(null);
    const stylePrompt = STYLE_PRESETS.find((s) => s.label === style)?.prompt || "";
    const fullPrompt = prompt + stylePrompt + (aspect !== "1:1" ? `, aspect ratio ${aspect}` : "");
    try {
      const result = await api.image(fullPrompt, modelId);
      setHistory((prev) => [{
        id: Date.now(),
        url: result.url,
        prompt: prompt,
        model: selectedModel,
        style,
        aspect,
        timestamp: new Date()
      }, ...prev].slice(0, 12));
      onCreditsUsed?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Model selector */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-2">Modèle</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {imageModels.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModelId(m.id)}
              className={`text-left rounded-xl p-3 border-2 transition-all ${
                modelId === m.id
                  ? "border-delt-accent bg-indigo-50"
                  : "border-delt-border bg-white hover:border-delt-text/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-delt-text truncate">{m.display}</span>
                <span className="text-[10px] font-bold text-delt-accent flex-shrink-0 ml-1">{m.cost} Cr</span>
              </div>
              <div className="text-[10px] text-delt-muted truncate">{m.tagline}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div className="rounded-2xl bg-white border border-delt-border p-4 shadow-sm">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
          rows={4}
          placeholder={t("artist.prompt_image")}
          className="w-full text-sm outline-none resize-none bg-transparent placeholder:text-delt-muted"
        />
        <div className="flex items-center justify-between text-[10px] text-delt-muted mt-1">
          <span>{prompt.length} / 2000</span>
          <span>⌘+Entrée pour générer</span>
        </div>
      </div>

      {/* Style presets */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-2">Style</div>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setStyle(s.label)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                style === s.label
                  ? "bg-delt-text text-white border-delt-text"
                  : "bg-white text-delt-muted border-delt-border hover:text-delt-text hover:border-delt-text/30"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect ratio */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-2">Format</div>
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setAspect(r.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-colors ${
                aspect === r.value
                  ? "border-delt-accent bg-indigo-50 text-delt-text"
                  : "border-delt-border bg-white text-delt-muted hover:border-delt-text/30 hover:text-delt-text"
              }`}
            >
              <div className="rounded-sm border-2 border-current"
                style={{ width: r.w / 2, height: r.h / 2 }} />
              <div className="text-left leading-tight">
                <div className="text-xs font-bold">{r.label}</div>
                <div className="text-[10px] opacity-60 font-mono">{r.value}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={generate}
        disabled={busy || !prompt.trim()}
        className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: prompt.trim() && !busy ? "linear-gradient(135deg, #6366f1, #06b6d4)" : "#94a3b8" }}
      >
        {busy ? (
          <>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
            </svg>
            Génération…
          </>
        ) : (
          `Générer l'image · ${selectedModel?.cost || 5} Cr`
        )}
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-3">Galerie · session</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {history.map((item) => (
              <div key={item.id} className="group relative rounded-xl overflow-hidden bg-delt-surface border border-delt-border">
                <img
                  src={item.url}
                  alt={item.prompt}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end opacity-0 group-hover:opacity-100">
                  <div className="p-2 w-full flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-white truncate">{item.model?.display}</span>
                    <button
                      type="button"
                      onClick={() => downloadMedia(item.url, "png")}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white"
                      title={t("artist.download")}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VideoTab({ catalog, onCreditsUsed }) {
  const t = useT();
  const [prompt, setPrompt]   = useState("");
  const [duration, setDuration] = useState(5);
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const videoModel = catalog?.creative?.VIDEO?.models?.[0];
  const cost = (videoModel?.crPerSecond720p || 50) * duration;

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api.video(prompt, videoModel?.id);
      setResult(r);
      onCreditsUsed?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-xs font-bold text-purple-700">Seedance 2 · ByteDance</div>
            <div className="text-[11px] text-purple-600/70">Text-to-video · 720p · 1-3 min de génération</div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
            {cost} Cr
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-delt-border p-4 shadow-sm">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
          rows={5}
          placeholder={t("artist.prompt_video")}
          className="w-full text-sm outline-none resize-none bg-transparent placeholder:text-delt-muted"
        />
        <div className="text-[10px] text-delt-muted text-right mt-1">{prompt.length} / 2000</div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted">Durée</div>
          <div className="text-xs font-bold text-delt-text">{duration} sec</div>
        </div>
        <input
          type="range"
          min="3" max="10" step="1"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value))}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-[10px] text-delt-muted mt-1">
          <span>3s</span><span>10s</span>
        </div>
      </div>

      <button
        onClick={generate}
        disabled={busy || !prompt.trim()}
        className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: prompt.trim() && !busy ? "linear-gradient(135deg, #a855f7, #ec4899)" : "#94a3b8" }}
      >
        {busy ? (
          <>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
            </svg>
            Génération vidéo… (1-3 min)
          </>
        ) : (
          `Générer la vidéo · ${cost} Cr`
        )}
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {result?.url && (
        <div className="rounded-2xl bg-white border border-delt-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted">Résultat</div>
            <button
              type="button"
              onClick={() => downloadMedia(result.url, "mp4")}
              className="text-xs font-semibold text-delt-muted hover:text-delt-text flex items-center gap-1"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              MP4
            </button>
          </div>
          <video src={result.url} controls className="w-full rounded-xl bg-black" />
        </div>
      )}
    </div>
  );
}

export default function ArtistStudio() {
  const t = useT();
  const [tab, setTab] = useState("image");
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {});
  }, []);

  const refresh = () => api.catalog().then(setCatalog).catch(() => {});

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-6">

      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-md"
          style={{ background: "linear-gradient(135deg, #ec4899, #f97316)" }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4"/>
            <line x1="22" y1="12" x2="18" y2="12"/>
            <line x1="6" y1="12" x2="2" y2="12"/>
            <line x1="12" y1="6" x2="12" y2="2"/>
            <line x1="12" y1="22" x2="12" y2="18"/>
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-delt-text tracking-tight">{t("artist.title")}</h1>
        <p className="text-sm text-delt-muted max-w-md mx-auto">
          {t("artist.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <TabButton
          active={tab === "image"}
          onClick={() => setTab("image")}
          label={t("artist.tab_image")}
          sub="FLUX, Nano Banana, GPT Image"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={tab === "image" ? "white" : "#6366f1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          }
        />
        <TabButton
          active={tab === "video"}
          onClick={() => setTab("video")}
          label={t("artist.tab_video")}
          sub="Seedance 2 · 720p"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={tab === "video" ? "white" : "#a855f7"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          }
        />
        <TabButton
          active={tab === "music"}
          onClick={() => setTab("music")}
          label={t("artist.tab_music")}
          sub="Suno V5.5"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={tab === "music" ? "white" : "#ec4899"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          }
        />
      </div>

      {/* Content */}
      {tab === "image" && <ImageTab catalog={catalog} onCreditsUsed={refresh} />}
      {tab === "video" && <VideoTab catalog={catalog} onCreditsUsed={refresh} />}
      {tab === "music" && <MusicComposer cost={catalog?.creative?.MUSIC?.models?.[0]?.cost ?? 25} onCreditsUsed={refresh} />}
    </div>
  );
}
