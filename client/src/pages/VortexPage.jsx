// Vortex — dépose tout ce que tu veux (photos, docs, notes), ça orbite autour
// du trou noir. Stocké côté serveur, chiffré (AES-256-GCM), indexé en
// embeddings multimodaux (google/gemini-embedding-2). Chaque IA n'accède
// JAMAIS à tout le Vortex — uniquement aux extraits pertinents pour la
// question posée, et seulement si tu actives l'option dans le chat.
//
// Anti fourre-tout : dédoublonnage automatique à l'ajout (une quasi-copie
// n'est jamais re-stockée), auto-classification en catégories fixes, et un
// panneau « Nettoyer » qui suggère les quasi-doublons restants + le contenu
// jamais réutilisé depuis longtemps (jamais supprimé sans confirmation).
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

const MAX_ITEMS = 60; // rendu visuel — le backend stocke davantage
const TAGS = ["Documents", "Photos", "Notes", "Travail", "Personnel", "Factures", "Contacts", "Autre"];
const TAG_COLORS = {
  Documents: "#2563eb", Photos: "#a855f7", Notes: "#f59e0b", Travail: "#059669",
  Personnel: "#ec4899", Factures: "#ef4444", Contacts: "#0891b2", Autre: "#94a3b8"
};

const EXT_META = {
  pdf:  { color: "#ef4444", label: "PDF" },
  doc:  { color: "#2563eb", label: "DOC" }, docx: { color: "#2563eb", label: "DOC" },
  txt:  { color: "#64748b", label: "TXT" }, md:   { color: "#64748b", label: "MD" },
  png:  { color: "#a855f7", label: "IMG" }, jpg:  { color: "#a855f7", label: "IMG" }, jpeg: { color: "#a855f7", label: "IMG" }, webp: { color: "#a855f7", label: "IMG" }, gif: { color: "#a855f7", label: "IMG" },
  csv:  { color: "#059669", label: "CSV" }, xlsx: { color: "#059669", label: "XLS" },
  note: { color: "#f59e0b", label: "NOTE" }
};
function metaFor(name, isNote) {
  if (isNote) return EXT_META.note;
  const ext = String(name).split(".").pop()?.toLowerCase();
  return EXT_META[ext] || { color: "#94a3b8", label: ext ? ext.toUpperCase().slice(0, 4) : "FILE" };
}

// ─── Fond : disque d'accrétion + horizon, dessiné en canvas (léger, pas de lib) ──
function BlackHoleCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let raf, t = 0, w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    const stars = Array.from({ length: 140 }, () => ({
      a: Math.random() * Math.PI * 2, r: 140 + Math.random() * 480,
      speed: (0.15 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1),
      size: Math.random() * 1.6 + 0.3, tw: Math.random() * Math.PI * 2
    }));
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;

      // Étoiles / particules qui tournent lentement autour du centre
      for (const s of stars) {
        const a = s.a + t * 0.0025 * s.speed;
        const x = cx + Math.cos(a) * s.r;
        const y = cy + Math.sin(a) * s.r * 0.55;
        const flicker = 0.5 + 0.5 * Math.sin(t * 0.03 + s.tw);
        ctx.beginPath();
        ctx.arc(x, y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(199,210,254,${0.15 + flicker * 0.35})`;
        ctx.fill();
      }

      // Disque d'accrétion : anneaux elliptiques en dégradé violet/indigo
      for (let i = 0; i < 6; i++) {
        const rx = 70 + i * 16, ry = rx * 0.32;
        const rot = t * 0.004 * (i % 2 === 0 ? 1 : -1) + i;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot * 0.15);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        const grad = ctx.createLinearGradient(-rx, 0, rx, 0);
        grad.addColorStop(0, "rgba(99,102,241,0)");
        grad.addColorStop(0.5, `rgba(168,85,247,${0.25 - i * 0.03})`);
        grad.addColorStop(1, "rgba(99,102,241,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
      }

      // Horizon des événements : disque noir + halo
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 90);
      glow.addColorStop(0, "rgba(0,0,0,1)");
      glow.addColorStop(0.55, "rgba(10,6,20,1)");
      glow.addColorStop(0.85, "rgba(88,28,135,0.35)");
      glow.addColorStop(1, "rgba(88,28,135,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, 90, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

function FileIcon({ label, color }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

// Hash déterministe id → [0,1) : pseudo-aléatoire stable (ne rebat pas les
// paramètres d'orbite à chaque re-render), plusieurs valeurs via un "sel".
function rand01(seed, salt) {
  let h = 2166136261;
  const s = seed + "#" + salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

// Un fichier en orbite : trajectoire elliptique, inclinée, avec un rayon et
// une vitesse propres — pas un cercle parfait, chaque item a sa propre orbite
// « sale » comme un vrai débris autour d'un trou noir. Structure en 3 couches :
// plan incliné+aplati (statique) → révolution (rotation animée) → contre-
// rotation (garde la carte du fichier bien droite et lisible).
function OrbitingItem({ item, index, total, onOpen, onRemove }) {
  const ring = index % 4;
  const baseRadius = 120 + ring * 58;
  const radiusJitter = (rand01(item.id, "r") - 0.5) * 50; // ±25px
  const radius = Math.max(70, baseRadius + radiusJitter);
  const eccentricity = 0.45 + rand01(item.id, "e") * 0.45; // 0.45–0.9 → jamais un cercle
  const tilt = (rand01(item.id, "t") - 0.5) * 70; // ±35° d'inclinaison du plan
  const duration = 20 + ring * 8 + rand01(item.id, "d") * 14;
  const delay = -(rand01(item.id, "p") * duration); // déphasage aléatoire, pas synchronisé
  const dir = ring % 2 === 0 ? "normal" : "reverse";
  const meta = metaFor(item.name, item.kind === "note");
  return (
    <div
      className="absolute top-1/2 left-1/2 pointer-events-none"
      style={{
        width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius,
        transform: `rotate(${tilt}deg) scaleY(${eccentricity})`
      }}
    >
      {/* Révolution : SEULE l'animation touche le transform de cette couche */}
      <div
        className="absolute inset-0"
        style={{ animation: `vortex-spin ${duration}s linear ${delay}s infinite`, animationDirection: dir }}
      >
        {/* Ancrage statique au sommet du cercle (avant déformation ellipse) */}
        <div className="pointer-events-auto absolute" style={{ top: 0, left: "50%", transform: "translate(-50%, -50%)" }}>
          {/* Contre-révolution : annule la rotation pour garder la carte droite */}
          <div style={{ animation: `vortex-spin ${duration}s linear ${delay}s infinite`, animationDirection: dir === "normal" ? "reverse" : "normal" }}>
            {/* Contre-déformation statique : annule le tilt + l'aplatissement ellipse */}
            <div style={{ transform: `scaleY(${1 / eccentricity}) rotate(${-tilt}deg)` }}>
              <button
                onClick={() => onOpen(item)}
                title={item.name}
                className="relative rounded-xl bg-white/95 backdrop-blur border border-white/60 shadow-lg shadow-black/30 flex items-center gap-1.5 px-2 py-1.5 hover:scale-110 hover:z-10 transition-transform group"
              >
                {item.tag && (
                  <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: TAG_COLORS[item.tag] || "#94a3b8" }} title={item.tag} />
                )}
                {item.duplicateCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center" title={`${item.duplicateCount} doublon(s) évité(s)`}>×{item.duplicateCount + 1}</span>
                )}
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <FileIcon label={meta.label} color={meta.color} />
                )}
                <span className="text-[10px] font-semibold text-slate-700 max-w-[80px] truncate">{item.name}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-500 flex items-center justify-center text-[10px] flex-shrink-0"
                >✕</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VortexPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [preview, setPreview] = useState(null);
  const [sucking, setSucking] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanup, setCleanup] = useState(null);
  const fileInputRef = useRef(null);

  const refresh = () => api.vortexList().then((r) => setItems(r.items || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);

  const flashToast = (text) => { setToast(text); setTimeout(() => setToast(null), 2600); };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setSucking(true);
    for (const f of files) {
      const isImage = /image\//.test(f.type);
      const isText = /^text\//.test(f.type) || /\.(txt|md|csv|json|log|yml|yaml)$/i.test(f.name);
      try {
        if (isImage) {
          const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); });
          const result = await api.vortexAdd({ kind: "image", name: f.name, imageUrl: dataUrl, mimeType: f.type });
          if (result.duplicate) flashToast(`« ${f.name} » ressemble déjà à quelque chose dans ton Vortex — pas ajouté en double.`);
        } else {
          const text = isText
            ? await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result || "").slice(0, 6000)); r.onerror = () => res(null); r.readAsText(f); })
            : f.name; // binaire non-texte : indexé par nom (recherche par titre seulement)
          const result = await api.vortexAdd({ kind: "file", name: f.name, text, mimeType: f.type });
          if (result.duplicate) flashToast(`« ${f.name} » ressemble déjà à quelque chose dans ton Vortex — pas ajouté en double.`);
        }
      } catch (e) { flashToast(e.message); }
    }
    await refresh();
    setTimeout(() => setSucking(false), 700);
  };

  const addNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteText(""); setNoteOpen(false);
    try {
      const result = await api.vortexAdd({ kind: "note", name: text.slice(0, 40) || "Note", text });
      if (result.duplicate) flashToast("Une note très similaire existe déjà dans ton Vortex.");
      await refresh();
    } catch (e) { flashToast(e.message); }
  };

  const removeItem = async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try { await api.vortexDelete(id); } catch { refresh(); }
  };

  const openCleanup = async () => {
    setCleanupOpen(true);
    try { setCleanup(await api.vortexCleanup()); } catch { setCleanup({ nearDuplicates: [], stale: [] }); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const visibleItems = (activeTag ? items.filter((i) => i.tag === activeTag) : items).slice(0, MAX_ITEMS);

  return (
    <div
      className="relative flex-1 min-h-0 overflow-hidden bg-[#05030c]"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      <style>{`
        @keyframes vortex-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes vortex-suck {
          0% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
        }
        .vortex-item-inner { animation: vortex-spin var(--dur) linear infinite reverse; }
      `}</style>

      <BlackHoleCanvas />

      {/* Halo de dépôt actif */}
      {dragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-indigo-500/10 backdrop-blur-[2px] pointer-events-none">
          <div className="text-indigo-200 font-bold text-lg tracking-wide animate-pulse">Lâche tout ici…</div>
        </div>
      )}
      {sucking && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="w-24 h-24 rounded-full border-4 border-violet-400/60" style={{ animation: "vortex-suck 0.7s ease-in forwards" }} />
        </div>
      )}

      {/* Titre + tagline */}
      <div className="absolute top-8 left-0 right-0 text-center z-10 px-4 pointer-events-none">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="url(#vgrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <defs><linearGradient id="vgrad" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stopColor="#a855f7"/><stop offset="1" stopColor="#6366f1"/></linearGradient></defs>
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Vortex
        </h1>
        <p className="text-white/50 text-sm mt-1.5 max-w-md mx-auto">
          Dépose ici ce que tu veux — photos, documents, notes. Chiffré, dédoublonné automatiquement. Aucune IA n'y accède sans que tu l'actives dans le chat.
        </p>
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 pointer-events-auto">
            {[...new Set(items.map((i) => i.tag).filter(Boolean))].map((tag) => (
              <button key={tag} onClick={() => setActiveTag((t) => t === tag ? null : tag)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                  activeTag === tag ? "bg-white text-slate-900 border-white" : "text-white/70 border-white/20 hover:border-white/40"}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: TAG_COLORS[tag] }} />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fichiers en orbite */}
      {visibleItems.map((item, i) => (
        <OrbitingItem key={item.id} item={item} index={i} total={visibleItems.length} onOpen={setPreview} onRemove={removeItem} />
      ))}

      {/* Barre d'action bas de page */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 z-20 px-4">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <button onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2.5 rounded-full text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur transition-colors flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Déposer un fichier
        </button>
        <button onClick={() => setNoteOpen(true)}
          className="px-4 py-2.5 rounded-full text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur transition-colors flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Ajouter une note
        </button>
        {items.length > 0 && (
          <>
            <button onClick={openCleanup}
              className="px-4 py-2.5 rounded-full text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur transition-colors flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Nettoyer
            </button>
            <span className="text-white/40 text-xs font-medium">{items.length} élément{items.length > 1 ? "s" : ""}</span>
          </>
        )}
      </div>

      {/* Toast (doublon détecté, erreur…) */}
      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-white text-slate-800 text-xs font-semibold shadow-lg max-w-sm text-center">
          {toast}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-white/30 text-sm">Ouverture du Vortex…</span>
        </div>
      )}

      {/* Modal note */}
      {noteOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setNoteOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold text-slate-900">Nouvelle note</div>
            <textarea autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={5}
              placeholder="Écris ce que tu veux garder…"
              className="w-full text-sm rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-300 resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNoteOpen(false)} className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100">Annuler</button>
              <button onClick={addNote} disabled={!noteText.trim()} className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-slate-900 disabled:opacity-40">Ajouter au Vortex</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview fichier/note cliqué */}
      {preview && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{preview.name}</div>
                {preview.tag && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold" style={{ color: TAG_COLORS[preview.tag] }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: TAG_COLORS[preview.tag] }} />
                    {preview.tag}
                  </span>
                )}
              </div>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-700 flex-shrink-0">✕</button>
            </div>
            {preview.imageUrl && <img src={preview.imageUrl} alt="" className="w-full rounded-xl object-contain max-h-72" />}
            {preview.kind === "note" && <p className="text-sm text-slate-600 whitespace-pre-wrap">{preview.text}</p>}
            {preview.kind === "file" && preview.text && (
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-slate-50 rounded-xl p-3 max-h-72 overflow-y-auto">{preview.text}</pre>
            )}
            {!preview.imageUrl && !preview.text && (
              <p className="text-xs text-slate-400">Aperçu non disponible pour ce type de fichier.</p>
            )}
            <button onClick={() => { removeItem(preview.id); setPreview(null); }}
              className="text-xs font-semibold text-red-500 hover:text-red-600">Retirer du Vortex</button>
          </div>
        </div>
      )}

      {/* Nettoyer — quasi-doublons + contenu jamais réutilisé. Rien n'est
          supprimé automatiquement, tout passe par confirmation ici. */}
      {cleanupOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setCleanupOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-4 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">Nettoyer le Vortex</div>
              <button onClick={() => setCleanupOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            {!cleanup ? (
              <div className="text-center text-xs text-slate-400 py-6">Analyse…</div>
            ) : (
              <>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Quasi-doublons ({cleanup.nearDuplicates.length})</div>
                  {cleanup.nearDuplicates.length === 0 ? (
                    <p className="text-xs text-slate-400">Rien à signaler.</p>
                  ) : cleanup.nearDuplicates.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-100 text-xs">
                      <span className="flex-1 truncate text-slate-700">{d.a.name} <span className="text-slate-400">≈</span> {d.b.name}</span>
                      <span className="text-slate-400 flex-shrink-0">{Math.round(d.similarity * 100)}%</span>
                      <button onClick={async () => { await removeItem(d.b.id); setCleanup((c) => ({ ...c, nearDuplicates: c.nearDuplicates.filter((_, j) => j !== i) })); }}
                        className="text-red-500 hover:text-red-600 font-semibold flex-shrink-0">Garder « {d.a.name} »</button>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Jamais réutilisé depuis longtemps ({cleanup.stale.length})</div>
                  {cleanup.stale.length === 0 ? (
                    <p className="text-xs text-slate-400">Rien à signaler.</p>
                  ) : cleanup.stale.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 text-xs">
                      <span className="flex-1 truncate text-slate-700">{s.name}</span>
                      <span className="text-slate-400 flex-shrink-0">{s.tag}</span>
                      <button onClick={async () => { await removeItem(s.id); setCleanup((c) => ({ ...c, stale: c.stale.filter((x) => x.id !== s.id) })); }}
                        className="text-red-500 hover:text-red-600 font-semibold flex-shrink-0">Supprimer</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
