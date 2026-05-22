import { useState, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const PREVIEW_TYPES = {
  html:  { kind: "html",     label: "HTML",       hljs: "html" },
  svg:   { kind: "svg",      label: "SVG",        hljs: "xml" },
  md:    { kind: "markdown", label: "Markdown",   hljs: "markdown" },
  csv:   { kind: "csv",      label: "CSV",        hljs: "plaintext" },
  json:  { kind: "json",     label: "JSON",       hljs: "json" },
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
  const blob = useMemo(() => {
    const b = new Blob([content], { type: "text/html" });
    return URL.createObjectURL(b);
  }, [content]);
  useEffect(() => () => URL.revokeObjectURL(blob), [blob]);
  return (
    <iframe
      src={blob}
      sandbox="allow-scripts"
      title="HTML preview"
      className="w-full h-full min-h-[400px] border-0 bg-white rounded-lg"
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

  const download = () => {
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
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const hasPreview = type.kind !== "code" && type.kind !== "text";
  const size = new Blob([artifact.content || ""]).size;
  const sizeLabel = size < 1024 ? `${size} o` : `${(size / 1024).toFixed(1)} Ko`;
  const lines = (artifact.content || "").split("\n").length;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        className="w-full sm:w-[600px] lg:w-[760px] bg-white h-full flex flex-col shadow-2xl animate-slideInRight"
        onClick={(e) => e.stopPropagation()}
      >
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Télécharger
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
    </div>
  );
}
