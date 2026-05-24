import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../lib/i18n.jsx";
import { api, getToken } from "../lib/api.js";

const MODELS = [
  {
    id: "inclusionai/ring-2.6-1t:free",
    label: "Ring 2.6",
    sub: "Gratuit",
    brand: "InclusionAI",
    color: "#10b981"
  },
  {
    id: "mistralai/codestral-2508",
    label: "Codestral 2508",
    sub: "Spécialiste code",
    brand: "Mistral",
    color: "#f97316"
  },
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    sub: "Rapide & smart",
    brand: "Google",
    color: "#4285f4"
  }
];

const EXAMPLE_CATEGORIES = [
  {
    label: "Web",
    icon: "globe",
    examples: [
      "Crée une landing page moderne pour un SaaS de facturation avec hero, features et tarifs.",
      "Crée un portfolio de développeur avec sections about, projets, contact.",
      "Crée un site multi-pages (index.html + about.html + contact.html) avec menu de nav cohérent."
    ]
  },
  {
    label: "App",
    icon: "layout",
    examples: [
      "Crée un dashboard analytics avec graphiques mockés et stats cards.",
      "Crée une todo app interactive en HTML/CSS/JS avec localStorage.",
      "Crée un calculateur de pourboire interactif beau et responsive."
    ]
  },
  {
    label: "Backend",
    icon: "server",
    examples: [
      "Crée une API Node Express avec CRUD utilisateurs en mémoire.",
      "Crée un serveur Python Flask avec routes /api/items et stockage JSON.",
      "Crée un mini blog en Node + EJS avec articles statiques."
    ]
  },
  {
    label: "Jeux",
    icon: "gamepad",
    examples: [
      "Crée un Snake en HTML/CSS/JS jouable directement dans le navigateur.",
      "Crée un jeu de Tic-Tac-Toe React minimaliste.",
      "Crée un puzzle 2048 en HTML/JS avec animations fluides."
    ]
  }
];

const ICONS = {
  globe:   <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>,
  layout:  <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></>,
  server:  <><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
  gamepad: <><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258C21.305 7.077 19.715 5 17.32 5z"/></>
};

const FILE_ICONS = {
  html: { color: "#e34c26", label: "HTML" },
  css:  { color: "#1572b6", label: "CSS" },
  js:   { color: "#f0db4f", label: "JS" },
  jsx:  { color: "#61dafb", label: "JSX" },
  ts:   { color: "#3178c6", label: "TS" },
  tsx:  { color: "#3178c6", label: "TSX" },
  py:   { color: "#3776ab", label: "PY" },
  json: { color: "#8b8b8b", label: "JSON" },
  md:   { color: "#0080ff", label: "MD" },
  yml:  { color: "#cb171e", label: "YML" },
  yaml: { color: "#cb171e", label: "YAML" },
  txt:  { color: "#94a3b8", label: "TXT" },
  sh:   { color: "#2e8b57", label: "SH" },
  rb:   { color: "#cc342d", label: "RB" },
  go:   { color: "#00add8", label: "GO" },
  rs:   { color: "#dea584", label: "RS" },
  java: { color: "#ed8b00", label: "JAVA" },
  c:    { color: "#5c6bc0", label: "C" },
  cpp:  { color: "#5c6bc0", label: "C++" },
  php:  { color: "#777bb4", label: "PHP" }
};

function getFileExt(path) {
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

function FileIcon({ path, size = 16 }) {
  const ext = getFileExt(path);
  const info = FILE_ICONS[ext];
  if (!info) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded text-white font-bold flex-shrink-0"
      style={{ background: info.color, width: size + 2, height: size + 2, fontSize: Math.max(7, size - 9), letterSpacing: "-0.3px" }}
    >
      {info.label}
    </div>
  );
}

function SvgIcon({ name, size = 14, stroke = "currentColor" }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}

export default function CodeStudio() {
  const t = useT();
  const [prompt, setPrompt]                 = useState("");
  const [busy, setBusy]                     = useState(false);
  const [editing, setEditing]               = useState(false);
  const [editPrompt, setEditPrompt]         = useState("");
  const [session, setSession]               = useState(null);
  const [selectedFile, setSelectedFile]     = useState(null);
  const [error, setError]                   = useState(null);
  const [modelId, setModelId]               = useState(MODELS[0].id);
  const [activeCategory, setActiveCategory] = useState(EXAMPLE_CATEGORIES[0].label);
  const [viewMode, setViewMode]             = useState("preview"); // preview | code
  const [fileContent, setFileContent]       = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const promptRef = useRef(null);

  const selectedModel = MODELS.find((m) => m.id === modelId);

  const sortedFiles = useMemo(() => {
    const files = session?.files ?? [];
    return [...files].sort((a, b) => {
      if (a.path === "index.html") return -1;
      if (b.path === "index.html") return 1;
      return a.path.localeCompare(b.path);
    });
  }, [session]);

  const isHtmlFile = (path) => /\.html?$/i.test(path);
  const previewUrl = session?.id && selectedFile && isHtmlFile(selectedFile)
    ? api.codePreviewUrl(session.id, selectedFile) : null;

  // Charge le contenu d'un fichier non-HTML pour affichage code
  useEffect(() => {
    if (!session?.id || !selectedFile || isHtmlFile(selectedFile)) {
      setFileContent(null);
      return;
    }
    let aborted = false;
    setContentLoading(true);
    const token = getToken();
    fetch(api.codePreviewUrl(session.id, selectedFile), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((r) => r.text())
      .then((text) => { if (!aborted) setFileContent(text); })
      .catch(() => { if (!aborted) setFileContent("// Erreur de chargement"); })
      .finally(() => { if (!aborted) setContentLoading(false); });
    return () => { aborted = true; };
  }, [session?.id, selectedFile]);

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setError(null); setSession(null); setSelectedFile(null);
    try {
      const result = await api.codeSession(prompt, modelId);
      setSession(result);
      const first = result.files?.find((f) => isHtmlFile(f.path)) ?? result.files?.[0];
      setSelectedFile(first?.path ?? null);
      setViewMode("preview");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const applyEdit = async () => {
    if (!session?.id || !editPrompt.trim() || editing) return;
    setEditing(true); setError(null);
    try {
      const result = await api.codeEditSession(session.id, editPrompt, modelId);
      setSession(result);
      if (!result.files?.some((f) => f.path === selectedFile)) {
        const first = result.files?.find((f) => isHtmlFile(f.path)) ?? result.files?.[0];
        setSelectedFile(first?.path ?? null);
      }
      setEditPrompt("");
    } catch (e) {
      setError(e.message);
    } finally {
      setEditing(false);
    }
  };

  const downloadZip = async () => {
    if (!session?.id) return;
    try {
      const blob = await api.codeZip(session.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delt-code-${session.id.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const newProject = () => {
    setSession(null); setSelectedFile(null); setFileContent(null);
    setPrompt(""); setEditPrompt(""); setError(null);
    promptRef.current?.focus();
  };

  const copyCode = () => {
    if (fileContent) navigator.clipboard?.writeText(fileContent).catch(() => {});
  };

  const currentCategory = EXAMPLE_CATEGORIES.find((c) => c.label === activeCategory);

  // ═══════════════════════════════════════════════════════════════
  // EMPTY STATE — hero + examples + composer
  // ═══════════════════════════════════════════════════════════════
  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-md"
            style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-delt-text tracking-tight">{t("code.title")}</h1>
          <p className="text-sm sm:text-base text-delt-muted max-w-lg mx-auto">
            {t("code.description")}
          </p>
        </div>

        {/* Model selector */}
        <div className="flex justify-center">
          <div className="inline-flex p-1 rounded-full bg-delt-surface border border-delt-border">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModelId(m.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  modelId === m.id
                    ? "bg-white shadow-sm text-delt-text"
                    : "text-delt-muted hover:text-delt-text"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                  {m.label}
                  <span className="text-[10px] text-delt-muted font-normal">· {m.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div className="rounded-2xl bg-white border border-delt-border shadow-sm p-4">
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
            }}
            rows={5}
            placeholder={t("code.project_placeholder")}
            className="w-full text-sm outline-none resize-none placeholder:text-delt-muted bg-transparent"
          />
          <div className="flex items-center justify-between gap-3 mt-2">
            <span className="text-[11px] text-delt-muted hidden sm:block">{t("code.cmd_enter")}</span>
            <button
              onClick={generate}
              disabled={busy || !prompt.trim()}
              className="ml-auto inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: prompt.trim() && !busy ? "linear-gradient(135deg, #2563eb, #06b6d4)" : "#94a3b8" }}
            >
              {busy ? (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
                  </svg>
                  {t("code.generating")}
                </>
              ) : (
                <>
                  {t("code.generate")}
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Examples */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-delt-muted mb-3 text-center">
            {t("code.inspire")}
          </div>
          <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
            {EXAMPLE_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(cat.label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === cat.label
                    ? "bg-delt-text text-white"
                    : "bg-delt-surface text-delt-muted hover:text-delt-text"
                }`}
              >
                <SvgIcon name={cat.icon} size={12} />
                {cat.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {currentCategory?.examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => { setPrompt(ex); promptRef.current?.focus(); }}
                className="text-left rounded-xl bg-white border border-delt-border p-3 hover:border-delt-text/40 hover:shadow-sm transition-all"
              >
                <div className="text-xs text-delt-text leading-relaxed line-clamp-3">{ex}</div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION ACTIVE — file explorer + viewer + edit panel
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-3 px-2 sm:px-4 py-3">

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={newProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-delt-muted hover:text-delt-text hover:bg-delt-surface transition-colors"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            {t("code.new_project")}
          </button>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted">{t("code.project")}</div>
            <h2 className="text-sm sm:text-base font-bold text-delt-text truncate">{session.summary}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-delt-muted">
            <span className="w-2 h-2 rounded-full" style={{ background: selectedModel?.color }} />
            {selectedModel?.label}
            {session.tokensOut > 0 && <span className="font-mono ml-1">· {session.tokensOut.toLocaleString("fr-FR")} tokens</span>}
          </span>
          <button
            onClick={downloadZip}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ZIP
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-3">

        {/* File explorer */}
        <div className="rounded-2xl bg-white border border-delt-border overflow-hidden flex flex-col min-h-0 lg:max-h-[calc(100vh-180px)]">
          <div className="px-3 py-2.5 border-b border-delt-border flex items-center justify-between bg-delt-surface">
            <span className="text-[11px] font-bold uppercase tracking-widest text-delt-muted">
              {sortedFiles.length} fichier{sortedFiles.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {sortedFiles.map((file) => {
              const selected = selectedFile === file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => { setSelectedFile(file.path); setViewMode(isHtmlFile(file.path) ? "preview" : "code"); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    selected ? "bg-indigo-50" : "hover:bg-delt-surface"
                  }`}
                >
                  <FileIcon path={file.path} size={16} />
                  <span className={`flex-1 font-mono text-[12px] truncate ${selected ? "text-delt-accent font-semibold" : "text-delt-text"}`}>
                    {file.path}
                  </span>
                  <span className="text-[10px] text-delt-muted font-mono flex-shrink-0">{Math.ceil(file.bytes / 1024) || 1}k</span>
                </button>
              );
            })}
          </div>
          {session.run?.instructions && (
            <div className="border-t border-delt-border px-3 py-2 text-[11px] text-delt-muted bg-delt-surface">
              <div className="font-semibold mb-0.5 text-delt-text">▶ Lancement</div>
              <div className="leading-relaxed">{session.run.instructions}</div>
            </div>
          )}
        </div>

        {/* Viewer */}
        <div className="rounded-2xl bg-white border border-delt-border overflow-hidden flex flex-col min-h-0 lg:max-h-[calc(100vh-180px)]">
          {/* Tabs + file info */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-delt-border bg-delt-surface">
            <div className="flex items-center gap-2 min-w-0">
              {selectedFile && <FileIcon path={selectedFile} size={14} />}
              <span className="font-mono text-xs text-delt-text truncate">{selectedFile || "—"}</span>
            </div>
            {selectedFile && isHtmlFile(selectedFile) && (
              <div className="inline-flex p-0.5 rounded-full bg-white border border-delt-border">
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    viewMode === "preview" ? "bg-delt-text text-white" : "text-delt-muted hover:text-delt-text"
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("code")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    viewMode === "code" ? "bg-delt-text text-white" : "text-delt-muted hover:text-delt-text"
                  }`}
                >
                  Code
                </button>
              </div>
            )}
            {selectedFile && !isHtmlFile(selectedFile) && fileContent && (
              <button
                type="button"
                onClick={copyCode}
                className="text-[11px] text-delt-muted hover:text-delt-text font-semibold flex items-center gap-1"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copier
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden bg-white">
            {viewMode === "preview" && previewUrl ? (
              <iframe
                key={previewUrl}
                src={previewUrl}
                title="Preview"
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                className="w-full h-full border-0 bg-white"
              />
            ) : selectedFile && !isHtmlFile(selectedFile) ? (
              contentLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-delt-muted">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin mr-2">
                    <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
                  </svg>
                  Chargement…
                </div>
              ) : (
                <pre className="h-full overflow-auto p-4 text-xs leading-relaxed font-mono bg-slate-50 text-slate-800 whitespace-pre">
                  {fileContent}
                </pre>
              )
            ) : viewMode === "code" && selectedFile && isHtmlFile(selectedFile) ? (
              <CodeView sessionId={session.id} filePath={selectedFile} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-delt-muted">
                Sélectionne un fichier
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: edit input */}
      <div className="rounded-2xl bg-white border border-delt-border p-3 flex items-end gap-2">
        <textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) applyEdit();
          }}
          rows={1}
          placeholder={t("code.edit_placeholder")}
          className="flex-1 min-w-0 text-sm outline-none resize-none bg-transparent placeholder:text-delt-muted py-1.5 max-h-24"
        />
        <button
          onClick={applyEdit}
          disabled={editing || !editPrompt.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          style={{ background: editPrompt.trim() && !editing ? "#0f172a" : "#94a3b8" }}
        >
          {editing ? (
            <>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
              </svg>
              Modif…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Modifier
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}

// Affiche le code source d'un fichier HTML (récupère le source brut)
function CodeView({ sessionId, filePath }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    const token = getToken();
    fetch(api.codePreviewUrl(sessionId, filePath), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((r) => r.text())
      .then((text) => { if (!aborted) setContent(text); })
      .catch(() => { if (!aborted) setContent("// Erreur"); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [sessionId, filePath]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-delt-muted">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin mr-2">
          <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
        </svg>
        Chargement…
      </div>
    );
  }
  return (
    <pre className="h-full overflow-auto p-4 text-xs leading-relaxed font-mono bg-slate-50 text-slate-800 whitespace-pre">
      {content}
    </pre>
  );
}
