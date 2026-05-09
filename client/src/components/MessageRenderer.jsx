import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

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

function CodeBlock({ children, className }) {
  const lang = (className || "").replace("language-", "") || "text";
  const code = String(children).replace(/\n$/, "");
  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-slate-200 shadow-card">
      {/* Header barre */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
          {lang}
        </span>
        <CopyButton code={code} />
      </div>
      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="!m-0 !rounded-none !border-0 !shadow-none !bg-white px-4 py-3 text-sm leading-relaxed">
          <code className={className}>{children}</code>
        </pre>
      </div>
    </div>
  );
}

// Inline code (non-bloc)
function InlineCode({ children }) {
  return (
    <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded-md font-mono text-[0.875em] border border-slate-200">
      {children}
    </code>
  );
}

export default function MessageRenderer({ content }) {
  return (
    <div className="prose-delt">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const isBlock = !inline && (className || String(children).includes("\n"));
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return <InlineCode>{children}</InlineCode>;
          },
          // Paragraphes sans margin excessif
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },
          // Listes
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          // Titres
          h1({ children }) {
            return <h1 className="text-xl font-bold mt-4 mb-2 text-delt-text">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mt-3 mb-1.5 text-delt-text">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold mt-2 mb-1 text-delt-text">{children}</h3>;
          },
          // Blockquote
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-delt-accent pl-4 italic text-delt-muted my-2">
                {children}
              </blockquote>
            );
          },
          // Table
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3 rounded-xl border border-slate-200">
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>;
          },
          th({ children }) {
            return <th className="px-4 py-2 text-left font-semibold text-delt-text">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-2 border-t border-slate-100 text-delt-muted">{children}</td>;
          },
          // Liens
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-delt-accent underline underline-offset-2 hover:text-indigo-700"
              >
                {children}
              </a>
            );
          },
          // Séparateur
          hr() {
            return <hr className="my-4 border-delt-border" />;
          },
          // Strong / em
          strong({ children }) {
            return <strong className="font-semibold text-delt-text">{children}</strong>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
