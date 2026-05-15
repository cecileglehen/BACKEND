import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import katex from "katex";

// Normalise les délimiteurs LaTeX vers $...$ / $$...$$ que remark-math comprend
function preprocessLatex(content) {
  if (!content) return "";
  return content
    // \[...\] → $$...$$ (display)
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, math) => `$$\n${math.trim()}\n$$`)
    // \(...\) → $...$ (inline)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, math) => `$${math.trim()}$`);
}

// Remet en forme les tableaux GFM aplatis sur une seule ligne
// Plusieurs cas gérés :
//  1. Tableau complet sur une ligne : "| a | b | |---|---| | 1 | 2 |"
//  2. Texte avant le tableau : "Voici : | a | b | |---|---|"
//  3. Manque de blank line avant le tableau (requis par GFM)
function normalizeTables(content) {
  if (!content) return "";

  const lines = content.split("\n");
  const out = [];
  let justSawSeparator = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const hasSeparator = /\|\s*:?-{2,}:?\s*\|/.test(line);
    const pipeCount = (line.match(/\|/g) || []).length;

    // Cas A : ligne unique contenant header + séparateur + corps squishés
    if (hasSeparator && pipeCount >= 6 && /\|\s*\|/.test(line)) {
      const firstPipe = line.indexOf("|");
      const prefix = line.slice(0, firstPipe).trimEnd();
      let tablePart = line.slice(firstPipe).replace(/\|\s*\|/g, "|\n|");
      tablePart = tablePart.split("\n").map((l) => l.trimEnd()).join("\n");
      if (prefix) { out.push(prefix); out.push(""); }
      else if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      out.push(tablePart);
      justSawSeparator = false;
      if (i + 1 < lines.length && lines[i + 1].trim() !== "" && !/^\s*\|/.test(lines[i + 1])) out.push("");
      continue;
    }

    // Cas B : séparateur sur sa propre ligne — flag pour la suite
    if (hasSeparator) {
      // Assure une blank line avant le séparateur si pas déjà
      out.push(line);
      justSawSeparator = true;
      continue;
    }

    // Cas C : juste après un séparateur, ligne avec plusieurs `| |` collés = corps squishé
    if (justSawSeparator && pipeCount >= 4 && /\|\s*\|/.test(line)) {
      const split = line.replace(/\|\s*\|/g, "|\n|").split("\n").map((l) => l.trimEnd());
      for (const row of split) out.push(row);
      justSawSeparator = false;
      // blank line après le tableau si la prochaine n'est pas une ligne de tableau
      if (i + 1 < lines.length && lines[i + 1].trim() !== "" && !/^\s*\|/.test(lines[i + 1])) out.push("");
      continue;
    }

    // Reset le flag si on quitte le tableau
    if (justSawSeparator && !/^\s*\|/.test(line)) justSawSeparator = false;

    out.push(line);
  }

  return out.join("\n");
}

// Extrait le texte brut d'une arborescence React (children peut contenir des
// <span> imbriqués générés par rehype-highlight)
function extractText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node.props?.children !== undefined) return extractText(node.props.children);
  return "";
}

function CopyButton({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      title="Copier"
      className="absolute top-2.5 right-2.5 px-2 py-1 text-[11px] font-medium rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors cursor-pointer"
    >
      {copied ? "Copié !" : "Copier"}
    </button>
  );
}

function KatexBlock({ code }) {
  try {
    const html = katex.renderToString(code.trim(), { displayMode: true, throwOnError: false, trust: true });
    return (
      <div
        className="my-4 overflow-x-auto text-center py-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <pre className="text-xs text-red-500 whitespace-pre-wrap">{code}</pre>;
  }
}

function CodeBlock({ children, className }) {
  const lang = (className || "").replace("language-", "") || "text";

  // Extrait le texte réel pour la copie (les children sont des nœuds React après highlight)
  const rawText = extractText(children);

  // Blocs LaTeX → rendu KaTeX direct
  if (lang === "latex" || lang === "tex") {
    return <KatexBlock code={rawText} />;
  }

  const code = rawText.replace(/\n$/, "");
  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-slate-200 shadow-card">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
          {lang}
        </span>
        <CopyButton code={code} />
      </div>
      <div className="overflow-x-auto">
        <pre className="!m-0 !rounded-none !border-0 !shadow-none !bg-white px-4 py-3 text-sm leading-relaxed">
          <code className={className}>{children}</code>
        </pre>
      </div>
    </div>
  );
}

function InlineCode({ children }) {
  return (
    <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded-md font-mono text-[0.875em] border border-slate-200">
      {children}
    </code>
  );
}

// Transforme [1], [1,2], [5, 6, 8] en liens markdown vers les sources
// (ne touche pas aux références qui ne sont pas purement numériques, ex: [s1])
function linkifyCitations(content, sources) {
  if (!content || !Array.isArray(sources) || sources.length === 0) return content;
  const byIndex = new Map(sources.map((s) => [Number(s.index), s]));

  // On évite les zones de code (fenced ``` et inline `…`)
  const segments = [];
  let i = 0;
  const text = String(content);
  while (i < text.length) {
    const fence = text.indexOf("```", i);
    const tick = text.indexOf("`", i);
    const next = (fence !== -1 && (tick === -1 || fence < tick)) ? { type: "fence", at: fence }
              : (tick !== -1) ? { type: "tick", at: tick }
              : null;
    if (!next) { segments.push({ kind: "text", value: text.slice(i) }); break; }
    if (next.at > i) segments.push({ kind: "text", value: text.slice(i, next.at) });
    if (next.type === "fence") {
      const end = text.indexOf("```", next.at + 3);
      const stop = end === -1 ? text.length : end + 3;
      segments.push({ kind: "code", value: text.slice(next.at, stop) });
      i = stop;
    } else {
      const end = text.indexOf("`", next.at + 1);
      const stop = end === -1 ? text.length : end + 1;
      segments.push({ kind: "code", value: text.slice(next.at, stop) });
      i = stop;
    }
  }

  const replaceInText = (s) => s.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (full, nums) => {
    const ids = nums.split(",").map((n) => Number(n.trim())).filter((n) => byIndex.has(n));
    if (!ids.length) return full;
    const parts = ids.map((id) => {
      const src = byIndex.get(id);
      // Marqueur citation:N pour reconnaître côté <a/>
      return `[${id}](${src.url} "citation:${id}")`;
    });
    return `[${parts.join(", ")}]`;
  });

  return segments.map((seg) => seg.kind === "text" ? replaceInText(seg.value) : seg.value).join("");
}

export default function MessageRenderer({ content, sources }) {
  const withCitations = linkifyCitations(content, sources);
  const processed = preprocessLatex(normalizeTables(withCitations));

  return (
    <div className="prose-delt">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const isBlock = !inline && (className || String(children).includes("\n"));
            if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
            return <InlineCode>{children}</InlineCode>;
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mt-4 mb-2 text-delt-text">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mt-3 mb-1.5 text-delt-text">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold mt-2 mb-1 text-delt-text">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-delt-accent pl-4 italic text-delt-muted my-2">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="my-4 -mx-1 sm:mx-0 rounded-xl border border-slate-200 shadow-sm overflow-x-auto max-w-full">
                <table className="text-sm border-collapse" style={{ minWidth: "max-content" }}>
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-slate-50">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-slate-100">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-slate-50/60 transition-colors">{children}</tr>;
          },
          th({ children }) {
            return (
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="px-4 py-2.5 text-sm text-delt-text">{children}</td>;
          },
          a({ href, title, children }) {
            // Citation : title commence par "citation:" → badge compact
            if (typeof title === "string" && title.startsWith("citation:")) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" title={href}
                  className="inline-flex items-center justify-center min-w-[1.25rem] h-[1.1rem] mx-[1px] px-1 text-[0.7rem] font-mono font-semibold rounded-md bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 no-underline align-baseline">
                  {children}
                </a>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="text-delt-accent underline underline-offset-2 hover:text-indigo-700">
                {children}
              </a>
            );
          },
          hr() {
            return <hr className="my-4 border-delt-border" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-delt-text">{children}</strong>;
          }
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
