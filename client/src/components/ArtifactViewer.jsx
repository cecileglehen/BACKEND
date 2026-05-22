import { useState, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { downloadPptx, parseForPreview } from "../lib/pptxBuilder.js";

const PREVIEW_TYPES = {
  html:  { kind: "html",     label: "HTML",       hljs: "html" },
  svg:   { kind: "svg",      label: "SVG",        hljs: "xml" },
  md:    { kind: "markdown", label: "Markdown",   hljs: "markdown" },
  csv:   { kind: "csv",      label: "CSV",        hljs: "plaintext" },
  json:  { kind: "json",     label: "JSON",       hljs: "json" },
  pptx:  { kind: "pptx",     label: "Présentation",hljs: "markdown" },
  py:    { kind: "code",     label: "Python",     hljs: "python" },
  js:    { kind: "code",     label: "JavaScript", hljs: "javascript" },
  jsx:   { kind: "code",     label: "JSX",        hljs: "javascript" },
  ts:    { kind: "code",     label: "TypeScript", hljs: "typescript" },
  tsx:   { kind: "code",     label: "TSX",        hljs: "typescript" },
  css:   { kind: "code",     label: "CSS",        hljs: "css" },
  sql:   { kind: "code",     label: "SQL",        hljs: "sql" },
  sh:    { kind: "code",     label: "Shell",      hljs: "bash" },
  yaml:  { kind: "code",     label: "YAML",       hljs: "yaml" },
  yml:   { kind: "code",     label: "YAML",       hljs: "yaml" },
  xml:   { kind: "code",     label: "XML",        hljs: "xml" },
  dart:  { kind: "code",     label: "Dart",       hljs: "dart" },
  go:    { kind: "code",     label: "Go",         hljs: "go" },
  rs:    { kind: "code",     label: "Rust",       hljs: "rust" },
  java:  { kind: "code",     label: "Java",       hljs: "java" },
  kt:    { kind: "code",     label: "Kotlin",     hljs: "kotlin" },
  swift: { kind: "code",     label: "Swift",      hljs: "swift" },
  cpp:   { kind: "code",     label: "C++",        hljs: "cpp" },
  c:     { kind: "code",     label: "C",          hljs: "c" },
  rb:    { kind: "code",     label: "Ruby",       hljs: "ruby" },
  php:   { kind: "code",     label: "PHP",        hljs: "php" },
  txt:   { kind: "text",     label: "Texte",      hljs: "plaintext" }
};

function typeOf(filename) {
  const ext = (filename.split(".").pop() || "txt").toLowerCase();
  return PREVIEW_TYPES[ext] || { kind: "text", label: ext.toUpperCase(), hljs: "plaintext", ext };
}

function CsvTable({ content }) {
  const rows = useMemo(() => content.trim().split("\n").map((line) => {
    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    return cells;
  }), [content]);
  if (!rows.length) return null;
  const [header, ...body] = rows;
  return (
    <div className="overflow-auto rounded-lg border border-delt-border">
      <table className="min-w-full text-sm">
        <thead className="bg-delt-surface sticky top-0">
          <tr>
            {header.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-delt-text border-b border-delt-border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className={ri % 2 ? "bg-white" : "bg-delt-surface/30"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-delt-text border-b border-delt-border/50 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HtmlPreview({ content }) {
  return (
    <iframe
      srcDoc={content}
      sandbox="allow-scripts allow-same-origin"
      title="HTML preview"
      className="w-full h-full min-h-[500px] border-0 bg-white rounded-lg"
    />
  );
}

function SvgPreview({ content }) {
  return (
    <div className="flex items-center justify-center bg-checkerboard rounded-lg p-6 min-h-[300px]" dangerouslySetInnerHTML={{ __html: content }} />
  );
}

function CodeView({ content, lang }) {
  return (
    <pre className="text-xs sm:text-sm overflow-auto rounded-lg bg-slate-900 text-slate-100 p-4 font-mono leading-relaxed">
      <code className={`language-${lang}`}>{content}</code>
    </pre>
  );
}

const PPTX_THEME_COLORS = {
  blue:   { primary: "#2563EB", accent: "#60A5FA", bg: "#F8FAFC", text: "#0F172A" },
  purple: { primary: "#7C3AED", accent: "#A78BFA", bg: "#FAF5FF", text: "#1E1B4B" },
  green:  { primary: "#059669", accent: "#34D399", bg: "#F0FDF4", text: "#064E3B" },
  dark:   { primary: "#F59E0B", accent: "#FBBF24", bg: "#0F172A", text: "#F8FAFC" }
};

function SlidePreview({ slide, index, total, theme }) {
  const c = PPTX_THEME_COLORS[theme] || PPTX_THEME_COLORS.blue;
  const isDark = theme === "dark";
  const layout = slide.layout || "bullets";

  // Cover & Conclusion : full color background
  if (layout === "cover" || layout === "conclusion") {
    return (
      <div className="rounded-lg overflow-hidden shadow-md aspect-[16/9] flex flex-col justify-center px-8 py-6 text-white relative" style={{ background: c.primary }}>
        <div className="absolute top-3 left-3 text-[9px] uppercase tracking-wider font-bold opacity-60">{layout === "cover" ? "Couverture" : "Conclusion"}</div>
        <div className="absolute top-3 right-3 text-[9px] opacity-60">{index + 1} / {total}</div>
        <div className="text-3xl sm:text-4xl font-extrabold leading-tight">{slide.title}</div>
        {slide.subtitle && <div className="text-base sm:text-lg italic opacity-90 mt-2">{slide.subtitle}</div>}
        {slide.author && <div className="text-xs opacity-70 mt-4">{slide.author}</div>}
        <div className="absolute bottom-3 left-3 text-[10px] font-bold opacity-60">Delt AI</div>
      </div>
    );
  }

  // Section
  if (layout === "section") {
    return (
      <div className="rounded-lg overflow-hidden shadow-md aspect-[16/9] flex flex-col justify-center px-8 py-6 relative" style={{ background: c.bg }}>
        <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: c.primary }} />
        <div className="absolute top-3 right-3 text-[9px] opacity-60">{index + 1} / {total}</div>
        <div className="text-[10px] uppercase tracking-wider font-bold opacity-60 mb-2">Section</div>
        <div className="text-3xl sm:text-4xl font-extrabold" style={{ color: c.primary }}>{slide.title}</div>
        {slide.subtitle && <div className="text-base text-slate-500 italic mt-2">{slide.subtitle}</div>}
      </div>
    );
  }

  // Quote
  if (layout === "quote") {
    return (
      <div className="rounded-lg overflow-hidden shadow-md aspect-[16/9] flex flex-col justify-center px-8 py-6 relative" style={{ background: c.bg }}>
        <div className="absolute top-3 left-3 text-[9px] uppercase tracking-wider font-bold opacity-60">Citation</div>
        <div className="absolute top-3 right-3 text-[9px] opacity-60">{index + 1} / {total}</div>
        <div className="text-7xl absolute -top-2 left-4 opacity-20" style={{ color: c.accent }}>"</div>
        <div className="text-xl sm:text-2xl italic relative pl-4" style={{ color: c.text }}>{slide.quote}</div>
        {slide.author && <div className="text-sm font-bold mt-3 pl-4" style={{ color: c.primary }}>— {slide.author}</div>}
      </div>
    );
  }

  // Stats
  if (layout === "stats") {
    return (
      <div className="rounded-lg overflow-hidden shadow-md aspect-[16/9] px-6 py-5 relative bg-white">
        <div className="h-1 absolute top-0 left-0 right-0" style={{ background: c.primary }} />
        <div className="absolute top-3 right-3 text-[9px] opacity-60">{index + 1} / {total}</div>
        <div className="text-xl font-bold mb-4 mt-2" style={{ color: c.text }}>{slide.title}</div>
        <div className={`grid grid-cols-${Math.min(slide.stats?.length || 1, 4)} gap-2`}>
          {(slide.stats || []).slice(0, 4).map((s, i) => (
            <div key={i} className="rounded-lg p-3 border" style={{ background: c.bg, borderColor: c.accent }}>
              <div className="text-2xl sm:text-3xl font-extrabold text-center" style={{ color: c.primary }}>{s.value}</div>
              <div className="text-[10px] text-slate-500 text-center mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Two-column
  if (layout === "two-column") {
    return (
      <div className="rounded-lg overflow-hidden shadow-md aspect-[16/9] px-6 py-5 relative bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: c.primary }} />
        <div className="absolute top-3 right-3 text-[9px] opacity-60">{index + 1} / {total}</div>
        <div className="text-xl font-bold mb-3 pl-3" style={{ color: c.text }}>{slide.title}</div>
        <div className="grid grid-cols-2 gap-3 pl-3">
          <div>
            <div className="text-sm font-bold mb-2" style={{ color: c.primary }}>{slide.leftTitle}</div>
            <ul className="space-y-1">
              {(slide.leftBullets || []).map((b, i) => (
                <li key={i} className="text-xs" style={{ color: c.text }}>• {b}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-sm font-bold mb-2" style={{ color: c.primary }}>{slide.rightTitle}</div>
            <ul className="space-y-1">
              {(slide.rightBullets || []).map((b, i) => (
                <li key={i} className="text-xs" style={{ color: c.text }}>• {b}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Table
  if (layout === "table") {
    const [header, ...rows] = slide.table || [];
    return (
      <div className="rounded-lg overflow-hidden shadow-md aspect-[16/9] px-6 py-5 relative bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: c.primary }} />
        <div className="absolute top-3 right-3 text-[9px] opacity-60">{index + 1} / {total}</div>
        <div className="text-xl font-bold mb-3 pl-3" style={{ color: c.text }}>{slide.title}</div>
        <div className="overflow-hidden rounded text-xs">
          {header && (
            <div className="grid gap-px text-white font-bold" style={{ background: c.primary, gridTemplateColumns: `repeat(${header.length}, 1fr)` }}>
              {header.map((h, i) => <div key={i} className="px-2 py-1">{h}</div>)}
            </div>
          )}
          {rows.slice(0, 5).map((row, ri) => (
            <div key={ri} className="grid gap-px" style={{ background: ri % 2 ? "#fff" : c.bg, gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
              {row.map((cell, ci) => <div key={ci} className="px-2 py-1" style={{ color: c.text }}>{cell}</div>)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // image-text
  if (layout === "image-text") {
    return (
      <div className="rounded-lg overflow-hidden shadow-md aspect-[16/9] px-6 py-5 relative bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: c.primary }} />
        <div className="absolute top-3 right-3 text-[9px] opacity-60">{index + 1} / {total}</div>
        <div className="text-xl font-bold mb-3 pl-3" style={{ color: c.text }}>{slide.title}</div>
        <div className="grid grid-cols-2 gap-3 pl-3">
          <div className="flex items-center justify-center rounded-lg border" style={{ background: c.bg, borderColor: c.accent }}>
            <span className="text-4xl">🖼️</span>
          </div>
          <ul className="space-y-1">
            {(slide.bullets || []).map((b, i) => (
              <li key={i} className="text-xs" style={{ color: c.text }}>• {b}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Bullets (default)
  return (
    <div className="rounded-lg overflow-hidden shadow-md aspect-[16/9] px-6 py-5 relative bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: c.primary }} />
      <div className="absolute top-3 right-3 text-[9px] opacity-60">{index + 1} / {total}</div>
      <div className="text-xl font-bold mb-1 pl-3" style={{ color: c.text }}>{slide.title}</div>
      {slide.subtitle && <div className="text-xs italic mb-3 pl-3 text-slate-500">{slide.subtitle}</div>}
      <div className="h-0.5 w-12 mb-3 ml-3" style={{ background: c.primary }} />
      <ul className="space-y-1.5 pl-3">
        {(slide.bullets || []).slice(0, 7).map((b, i) => (
          <li key={i} className="text-sm flex gap-2" style={{ color: c.text }}>
            <span className="font-bold" style={{ color: c.primary }}>•</span>
            <span>{typeof b === "string" ? b : b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PptxPreview({ content }) {
  const info = useMemo(() => parseForPreview(content), [content]);

  if (info.mode === "code") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider">Code mode</span>
            <span className="text-sm font-semibold text-amber-900">Présentation générée par code</span>
          </div>
          <p className="text-xs text-amber-800 mb-3 leading-relaxed">
            L'IA a écrit du code JavaScript pptxgenjs pour fabriquer cette présentation sur mesure.
            Click <strong>Télécharger .pptx</strong> pour exécuter le code et obtenir le fichier.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <div className="text-2xl font-extrabold text-amber-700">{info.slideCount}</div>
              <div className="text-[10px] text-amber-900 uppercase tracking-wider font-semibold">Slides</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <div className="text-2xl font-extrabold text-amber-700">{info.codeLines}</div>
              <div className="text-[10px] text-amber-900 uppercase tracking-wider font-semibold">Lignes de code</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-delt-muted">
          Aperçu non-disponible en mode code — le rendu final dépend du code exécuté.
          Va dans l'onglet <strong>Code source</strong> pour voir le script.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-delt-muted uppercase tracking-wider font-semibold">
          {info.slides.length} slide{info.slides.length > 1 ? "s" : ""} · theme {info.theme}
        </div>
      </div>
      {info.slides.map((s, i) => (
        <SlidePreview key={i} slide={s} index={i} total={info.slides.length} theme={info.theme} />
      ))}
    </div>
  );
}

function MarkdownPreview({ content }) {
  return (
    <div className="prose prose-sm sm:prose-base max-w-none prose-headings:text-delt-text prose-p:text-delt-text prose-code:text-pink-600 prose-pre:bg-slate-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ArtifactViewer({ artifact, onClose }) {
  const type = typeOf(artifact.filename);
  const [tab, setTab] = useState(type.kind === "code" || type.kind === "text" ? "code" : "preview");
  const [copied, setCopied] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    if (type.kind === "pptx") {
      try {
        setDownloading(true);
        await downloadPptx(artifact.filename, artifact.content);
      } catch (e) {
        alert("Erreur génération .pptx : " + e.message);
      } finally {
        setDownloading(false);
      }
      return;
    }
    const blob = new Blob([artifact.content], { type: artifact.mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasPreview = type.kind !== "code" && type.kind !== "text";
  const size = new Blob([artifact.content || ""]).size;
  const sizeLabel = size < 1024 ? `${size} o` : `${(size / 1024).toFixed(1)} Ko`;
  const lines = (artifact.content || "").split("\n").length;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white border-l border-delt-border animate-slideInRight overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-delt-border flex-shrink-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
            {type.ext || (artifact.filename.split(".").pop() || "FILE")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-delt-text truncate">{artifact.filename}</div>
            <div className="text-[11px] text-delt-muted">{type.label} · {lines} lignes · {sizeLabel}</div>
          </div>
          <button
            onClick={copy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-delt-muted hover:text-delt-text hover:bg-delt-surface transition-colors"
          >
            {copied ? "✓ Copié" : "Copier"}
          </button>
          <button
            onClick={download}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold transition-colors"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {downloading ? "Génération…" : (type.kind === "pptx" ? "Télécharger .pptx" : "Télécharger")}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-delt-muted hover:bg-delt-surface transition-colors"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        {hasPreview && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-delt-border flex-shrink-0 bg-delt-surface/30">
            <button
              onClick={() => setTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === "preview" ? "bg-white text-delt-text shadow-sm" : "text-delt-muted hover:text-delt-text"
              }`}
            >
              Aperçu
            </button>
            <button
              onClick={() => setTab("code")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === "code" ? "bg-white text-delt-text shadow-sm" : "text-delt-muted hover:text-delt-text"
              }`}
            >
              Code source
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {tab === "preview" && type.kind === "html"     && <HtmlPreview content={artifact.content} />}
          {tab === "preview" && type.kind === "svg"      && <SvgPreview content={artifact.content} />}
          {tab === "preview" && type.kind === "markdown" && <MarkdownPreview content={artifact.content} />}
          {tab === "preview" && type.kind === "csv"      && <CsvTable content={artifact.content} />}
          {tab === "preview" && type.kind === "pptx"     && <PptxPreview content={artifact.content} />}
          {tab === "preview" && type.kind === "json"     && (
            <pre className="text-sm overflow-auto rounded-lg bg-slate-50 border border-delt-border p-4 font-mono">
              {(() => {
                try { return JSON.stringify(JSON.parse(artifact.content), null, 2); }
                catch { return artifact.content; }
              })()}
            </pre>
          )}
          {(tab === "code" || !hasPreview) && (
            <CodeView content={artifact.content} lang={type.hljs} />
          )}
        </div>
    </div>
  );
}
