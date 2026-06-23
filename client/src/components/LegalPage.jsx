import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LEGAL_DOCS } from "../lib/legalDocs.js";

// Page légale — rendu "papier juridique" sobre (document, pas de cartes).
export default function LegalPage({ type = "privacy" }) {
  const doc = LEGAL_DOCS[type] || LEGAL_DOCS.privacy;

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-12">
        <a href="/" className="text-[13px] text-slate-500 hover:text-slate-800">← Retour</a>
        <article className="legal-doc mt-6 text-slate-800">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="text-[26px] font-bold text-slate-900 tracking-tight mb-1">{children}</h1>,
              h2: ({ children }) => <h2 className="text-[17px] font-bold text-slate-900 mt-8 mb-2 border-b border-slate-200 pb-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-[15px] font-semibold text-slate-900 mt-5 mb-1.5">{children}</h3>,
              p: ({ children }) => <p className="text-[14px] leading-7 text-slate-700 my-3 text-justify">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-6 my-3 space-y-1.5 text-[14px] leading-7 text-slate-700">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-6 my-3 space-y-1.5 text-[14px] leading-7 text-slate-700">{children}</ol>,
              li: ({ children }) => <li className="leading-7">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
              a: ({ href, children }) => <a href={href} className="text-indigo-600 underline underline-offset-2">{children}</a>,
              table: ({ children }) => (
                <div className="my-5 overflow-x-auto">
                  <table className="w-full text-[13px] border-collapse border border-slate-300">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
              th: ({ children }) => <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">{children}</th>,
              td: ({ children }) => <td className="border border-slate-300 px-3 py-2 text-slate-700 align-top">{children}</td>,
              hr: () => <hr className="my-8 border-slate-200" />
            }}
          >
            {doc.md}
          </ReactMarkdown>
        </article>

        <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-500">
          <a href="/mentions-legales" className="hover:text-slate-800">Mentions légales</a>
          <a href="/terms" className="hover:text-slate-800">CGU / CGV</a>
          <a href="/privacy" className="hover:text-slate-800">Confidentialité</a>
          <a href="/cookies" className="hover:text-slate-800">Cookies</a>
        </footer>
      </div>
    </div>
  );
}
