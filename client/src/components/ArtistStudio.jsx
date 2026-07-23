import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import MusicComposer from "./MusicComposer.jsx";
import { useT } from "../lib/i18n.jsx";
import { BRAND_CONFIG } from "../lib/brands.js";

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

function BrandLogo({ brand, size = 20 }) {
  const cfg = BRAND_CONFIG[brand];
  if (!cfg?.icon) {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-delt-text text-white text-[10px] font-bold flex-shrink-0"
        style={{ width: size, height: size }}>
        {brand.charAt(0)}
      </span>
    );
  }
  return <img src={cfg.icon} alt={brand} width={size} height={size} className="flex-shrink-0 object-contain" />;
}

// Sélecteur de modèles groupé par marque : logos en grille, clic → déroule les
// modèles de cette marque (même principe que le picker curé du chat/Launch).
function BrandModelPicker({ models, modelId, onChange }) {
  const brands = [...new Set(models.map((m) => m.brand))];
  const [openBrand, setOpenBrand] = useState(() => models.find((m) => m.id === modelId)?.brand || brands[0]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {brands.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => setOpenBrand(openBrand === brand ? null : brand)}
            title={brand}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all ${
              openBrand === brand ? "border-delt-accent bg-indigo-50" : "border-transparent glass-card hover:border-delt-border"
            }`}
          >
            <BrandLogo brand={brand} size={22} />
          </button>
        ))}
      </div>
      {openBrand && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-fadeIn">
          {models.filter((m) => m.brand === openBrand).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={`text-left rounded-xl p-3 border-2 transition-all ${
                modelId === m.id ? "border-delt-accent bg-indigo-50" : "border-transparent glass-card"
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
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${
        active
          ? "border-transparent text-white shadow-md"
          : "border-transparent glass-card text-delt-text"
      }`}
      style={active ? { background: "#0f172a" } : {}}
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
  const [modelId, setModelId]     = useState("google/gemini-3.1-flash-lite-image");
  const [style, setStyle]         = useState(STYLE_PRESETS[0].label);
  const [aspect, setAspect]       = useState("1:1");
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState(null);
  const [history, setHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("delt-studio-history") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem("delt-studio-history", JSON.stringify(history)); }
    catch { /* quota localStorage (data URLs volumineuses) — on garde en mémoire */ }
  }, [history]);
  const [refs, setRefs]           = useState([]); // images de référence (image-à-image)
  const fileRef = useRef(null);

  const imageModels = catalog?.creative?.IMAGE?.models || [];
  const selectedModel = imageModels.find((m) => m.id === modelId) || imageModels[0];

  const addRefs = async (files) => {
    for (const f of Array.from(files || [])) {
      if (!f.type.startsWith("image/")) continue;
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      setRefs((p) => [...p, { id: Math.random().toString(36).slice(2), url, name: f.name }].slice(0, 4));
    }
  };
  const removeRef = (id) => setRefs((p) => p.filter((x) => x.id !== id));

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setError(null);
    const stylePrompt = STYLE_PRESETS.find((s) => s.label === style)?.prompt || "";
    const fullPrompt = prompt + stylePrompt + (aspect !== "1:1" ? `, aspect ratio ${aspect}` : "");
    try {
      const result = await api.image(fullPrompt, modelId, refs.map((r) => r.url));
      setHistory((prev) => [{
        id: Date.now(),
        url: result.url,
        prompt: prompt,
        model: selectedModel,
        style,
        aspect,
        timestamp: Date.now()
      }, ...prev].slice(0, 24));
      onCreditsUsed?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Model selector — groupé par marque, clic sur le logo pour dérouler */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-2">Modèle</div>
        <BrandModelPicker models={imageModels} modelId={modelId} onChange={setModelId} />
      </div>

      {/* Prompt */}
      <div className="rounded-2xl glass-card p-4 focus-within:border-indigo-200">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
          rows={4}
          placeholder={t("artist.prompt_image")}
          className="w-full text-sm outline-none resize-none bg-transparent placeholder:text-delt-muted"
        />
        {/* Images de référence (image-à-image) */}
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-delt-border/50">
          {refs.map((r) => (
            <div key={r.id} className="relative group">
              <img src={r.url} alt="" className="w-12 h-12 rounded-lg object-cover border border-delt-border" />
              <button onClick={() => removeRef(r.id)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-delt-text text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100">✕</button>
            </div>
          ))}
          {refs.length < 4 && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) addRefs(e.target.files); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} type="button"
                className="w-12 h-12 rounded-lg border-2 border-dashed border-delt-border text-delt-muted hover:border-indigo-300 hover:text-delt-accent flex items-center justify-center text-lg"
                title="Ajouter une image de référence (image-à-image)">＋</button>
            </>
          )}
          {refs.length > 0 && <span className="text-[10px] text-delt-muted">image(s) de référence</span>}
        </div>
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
                  : "glass-pill text-delt-muted border-transparent hover:text-delt-text"
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
                  : "border-transparent glass-card text-delt-muted hover:text-delt-text"
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
        style={{ background: prompt.trim() && !busy ? "#0f172a" : "#94a3b8" }}
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
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-delt-muted">Galerie</span>
            <button type="button" onClick={() => { if (confirm("Vider la galerie ?")) setHistory([]); }}
              className="text-[10px] text-delt-muted hover:text-red-500 transition-colors">Vider</button>
          </div>
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

function VoiceTab({ catalog, onCreditsUsed }) {
  const [text, setText]     = useState("");
  const [modelId, setModelId] = useState("minimax/speech-2.8-turbo");
  const [voiceId, setVoiceId] = useState(null);
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);

  const voiceModels = catalog?.creative?.VOICE?.models || [];
  const selectedModel = voiceModels.find((m) => m.id === modelId) || voiceModels[0];
  const voiceOptions = selectedModel?.voices || [];

  const changeModel = (id) => {
    setModelId(id);
    setVoiceId(voiceModels.find((m) => m.id === id)?.voices?.[0]?.id || null);
  };

  const generate = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api.voice(text, modelId, voiceId ? { voiceId } : {});
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
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-2">Modèle</div>
        <BrandModelPicker models={voiceModels} modelId={modelId} onChange={changeModel} />
      </div>

      {voiceOptions.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-2">Voix</div>
          <div className="flex flex-wrap gap-1.5">
            {voiceOptions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoiceId(v.id)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  voiceId === v.id
                    ? "bg-delt-text text-white border-delt-text"
                    : "glass-pill text-delt-muted border-transparent hover:text-delt-text"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl glass-card p-4 focus-within:border-indigo-200">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 5000))}
          rows={5}
          placeholder="Le texte à transformer en voix…"
          className="w-full text-sm outline-none resize-none bg-transparent placeholder:text-delt-muted"
        />
        <div className="text-[10px] text-delt-muted text-right mt-1">{text.length} / 5000</div>
      </div>

      <button
        onClick={generate}
        disabled={busy || !text.trim()}
        className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: text.trim() && !busy ? "#0f172a" : "#94a3b8" }}
      >
        {busy ? (
          <>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
            </svg>
            Génération…
          </>
        ) : (
          `Générer la voix · ${selectedModel?.cost || 8} Cr`
        )}
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {result?.url && (
        <div className="rounded-2xl glass-card p-4 focus-within:border-indigo-200">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted">Résultat</div>
            <button
              type="button"
              onClick={() => downloadMedia(result.url, "mp3")}
              className="text-xs font-semibold text-delt-muted hover:text-delt-text flex items-center gap-1"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              MP3
            </button>
          </div>
          <audio src={result.url} controls className="w-full" />
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

      <div className="rounded-2xl glass-card p-4 focus-within:border-indigo-200">
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
        <div className="rounded-2xl glass-card p-4 focus-within:border-indigo-200">
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
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg shadow-pink-500/30 animate-bounceIn"
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
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">{t("artist.title")}</h1>
        <p className="text-sm text-delt-muted max-w-md mx-auto">
          {t("artist.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <TabButton
          active={tab === "image"}
          onClick={() => setTab("image")}
          label={t("artist.tab_image")}
          sub="Gemini, Nano Banana, GPT Image"
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
        <TabButton
          active={tab === "voice"}
          onClick={() => setTab("voice")}
          label="Voix"
          sub="MiniMax Speech 2.8"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={tab === "voice" ? "white" : "#f59e0b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
            </svg>
          }
        />
      </div>

      {/* Content */}
      {tab === "image" && <ImageTab catalog={catalog} onCreditsUsed={refresh} />}
      {tab === "video" && <VideoTab catalog={catalog} onCreditsUsed={refresh} />}
      {tab === "music" && <MusicComposer cost={catalog?.creative?.MUSIC?.models?.[0]?.cost ?? 25} onCreditsUsed={refresh} />}
      {tab === "voice" && <VoiceTab catalog={catalog} onCreditsUsed={refresh} />}
    </div>
  );
}
