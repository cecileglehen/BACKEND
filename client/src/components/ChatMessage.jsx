import { useState, useRef, useEffect } from "react";
import MessageRenderer from "./MessageRenderer.jsx";

// Dérive la marque + le label depuis l'id OpenRouter du modèle.
// Permet d'afficher le logo même si le catalog n'a pas la version complète.
const ID_PREFIX_TO_BRAND = [
  [/^openai\//i,           { brand: "OpenAI",      display: "GPT" }],
  [/^anthropic\//i,        { brand: "Anthropic",   display: "Claude" }],
  [/^google\//i,           { brand: "Google",      display: "Gemini" }],
  [/^mistralai\//i,        { brand: "Mistral",     display: "Mistral" }],
  [/^x-ai\//i,             { brand: "xAI",         display: "Grok" }],
  [/^perplexity\//i,       { brand: "Perplexity",  display: "Perplexity" }],
  [/^meta-llama\//i,       { brand: "Meta",        display: "Llama" }],
  [/^cognitivecomputations\/dolphin/i, { brand: "Venice", display: "Venice" }],
  [/^inclusionai\//i,      { brand: "InclusionAI", display: "Inclusion" }],
  [/^deepseek\//i,         { brand: "DeepSeek",    display: "DeepSeek" }],
  [/^arcee-ai\//i,         { brand: "Arcee",       display: "Arcee" }],
  [/^moonshotai\//i,       { brand: "Moonshot",    display: "Kimi" }],
  [/^amazon\/nova/i,       { brand: "Nova",        display: "Nova" }],
  [/^qwen\//i,             { brand: "Qwen",        display: "Qwen" }],
  [/^delt\//i,             { brand: "DELT",        display: "DELT" }],
  [/^bytedance\//i,        { brand: "ByteDance",   display: "Seedance" }],
  [/^suno\//i,             { brand: "Suno",        display: "Suno" }],
  [/flux/i,                { brand: "Flux",        display: "FLUX" }],
  [/recraft/i,             { brand: "Recraft",     display: "Recraft" }]
];

function deriveBrandFromId(id) {
  if (!id) return null;
  for (const [re, info] of ID_PREFIX_TO_BRAND) {
    if (re.test(id)) return info;
  }
  return null;
}

// Masque les blocs de commande %% (write_file, generate_image) du texte affiché.
// Les blocs deviennent des cartes interactives ailleurs dans l'UI.
// Pendant le streaming, un bloc peut être incomplet (pas encore de %%end) — on
// coupe alors tout depuis le marqueur d'ouverture pour éviter de l'afficher.
function stripSkillBlocks(content) {
  if (!content) return content;
  return content
    .replace(/%%write_file:[^\n\r]+\r?\n[\s\S]*?%%end\r?\n?/g, "")
    .replace(/%%generate_image:[^\n\r]+(?:\r?\n)?%%end\r?\n?/g, "")
    // Bloc en cours de streaming (pas encore fermé) → masque jusqu'à la fin
    .replace(/%%write_file:[\s\S]*$/g, "")
    .replace(/%%generate_image:[\s\S]*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CAT_BADGE = {
  FREE:   "",
  UNCENSORED: "badge-venice",
  VENICE: "badge-venice",
  PICO:   "badge-pico",
  NANO:   "badge-eco",
  MINI:   "badge-mini",
  NORMAL: "badge-normal",
  PRICE:  "badge-expert",
  EXPERT: "badge-expert",
  PRO:    "badge-pro"
};

const BRAND_LOGO = {
  OpenAI:     "/brands/openai.svg",
  Google:     "/brands/gemini-color.svg",
  Anthropic:  "/brands/claude-color.svg",
  Mistral:    "/brands/mistral-color.svg",
  Meta:       "/brands/meta-color.svg",
  xAI:        "/brands/grok.svg",
  Perplexity: "/brands/perplexity-color.svg",
  Venice:     "/brands/venice-color.svg",
  InclusionAI:"/brands/antgroup-color.svg",
  ByteDance:  "/brands/bytedance-color.svg",
  Flux:       "/brands/flux.svg",
  Arcee:      "/brands/arcee-color.png",
  DeepSeek:   "/brands/deepseek-color.svg",
  Moonshot:   "/brands/moonshot-color.svg",
  Nova:       "/brands/nova-color.svg",
  Qwen:       "/brands/qwen-color.svg",
};

const TIER_ORDER = ["FREE", "UNCENSORED", "PICO", "NANO", "MINI", "NORMAL", "EXPERT", "PRO"];

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

function WebSearchBlock({ status, results = [], streaming }) {
  const [open, setOpen] = useState(false);
  const searching = status === "searching" && streaming;
  const count = results?.length || 0;

  const hostname = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  };

  return (
    <div className="text-sm w-full">
      <button
        type="button"
        onClick={() => count > 0 && setOpen((v) => !v)}
        disabled={count === 0}
        className={`inline-flex items-center gap-2 text-delt-muted hover:text-delt-text transition-colors ${count === 0 ? "cursor-default" : ""}`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 ${searching ? "animate-spin" : ""}`}
          style={searching ? { animationDuration: "2s" } : {}}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span className={`font-medium ${searching ? "thinking-pulse" : ""}`}>
          {searching ? "Recherche web en cours" : `${count} source${count > 1 ? "s" : ""} trouvée${count > 1 ? "s" : ""}`}
          {searching && <span className="thinking-dots" />}
        </span>
        {count > 0 && (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-90" : ""}`}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
      </button>

      {open && count > 0 && (
        <div className="mt-2 ml-4 border-l-2 border-delt-border pl-3 space-y-1.5">
          {results.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 group"
            >
              <span className="text-[10px] font-mono text-delt-muted mt-0.5 flex-shrink-0 w-4">{i + 1}.</span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-delt-text group-hover:text-delt-accent truncate">
                  {r.title || hostname(r.url)}
                </div>
                <div className="text-[10px] text-delt-muted font-mono truncate">{hostname(r.url)}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DeepSearchBlock({ data, streaming }) {
  if (!data) return null;
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const active = steps.find((s) => s.status === "running")?.label;
  const reasoning = data.reasoningGraph;
  const confidence = data.confidence;
  const velocity = data.velocity;
  const [showReasoning, setShowReasoning] = useState(false);

  const hostname = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  };

  const confChip = (() => {
    if (typeof confidence !== "number") return null;
    const pct = Math.round(confidence * 100);
    const color = pct >= 75 ? "bg-emerald-100 text-emerald-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>Confiance {pct}%</span>;
  })();

  return (
    <div className="w-full rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0f766e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            className={streaming ? "animate-spin" : ""} style={streaming ? { animationDuration: "2s" } : {}}>
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <div className="min-w-0">
            <div className="text-xs font-bold text-teal-900 truncate flex items-center gap-2">
              {data.title || "DELT Deep Search Beta"}
              {confChip}
              {velocity === "fast" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">⚡ Sujet rapide</span>}
              {velocity === "slow" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">🐢 Sujet stable</span>}
            </div>
            <div className="text-[11px] text-teal-700 truncate">
              {streaming ? (active || "Recherche en cours") : `${sources.length} source${sources.length > 1 ? "s" : ""} analysée${sources.length > 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
        {Number.isFinite(Number(data.creditCost)) && (
          <span className="text-[11px] font-mono text-teal-800 bg-white/80 border border-teal-100 rounded-full px-2 py-1">
            {Number(data.creditCost).toFixed(2)} Cr
          </span>
        )}
      </div>

      {steps.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {steps.map((step, i) => (
            <div key={`${step.label}-${i}`} className="flex items-center gap-2 text-[11px]">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                step.status === "done"
                  ? "bg-teal-600 text-white"
                  : step.status === "running"
                  ? "bg-white text-teal-700 border border-teal-300"
                  : "bg-white/70 text-teal-300 border border-teal-100"
              }`}>
                {step.status === "done" ? "✓" : i + 1}
              </span>
              <span className={step.status === "pending" ? "text-teal-400" : "text-teal-800"}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {!streaming && sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sources.slice(0, 8).map((s) => (
            <a
              key={`${s.index}-${s.url}`}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-full inline-flex items-center gap-1.5 rounded-full bg-white border border-teal-100 px-2 py-1 text-[11px] text-teal-800 hover:border-teal-300"
              title={s.title}
            >
              <span className="font-mono">[{s.index}]</span>
              <span className="truncate max-w-[10rem]">{hostname(s.url)}</span>
            </a>
          ))}
        </div>
      )}

      {/* Reasoning graph collapsible */}
      {reasoning && (reasoning.supports?.length > 0 || reasoning.contradictions?.length > 0) && (
        <div className="mt-3 border-t border-teal-100 pt-2">
          <button
            type="button"
            onClick={() => setShowReasoning((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-800 hover:text-teal-900"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showReasoning ? "rotate-90" : ""}`}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            🧠 Comment ça pense ({reasoning.supports?.length || 0} claims · {reasoning.contradictions?.length || 0} contradictions)
          </button>
          {showReasoning && (
            <div className="mt-2 space-y-1.5 text-[11px]">
              {reasoning.supports?.slice(0, 8).map((node, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-white/70 border border-teal-100">
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded font-bold text-[9px] ${
                    node.confidence === "high" ? "bg-emerald-600 text-white" :
                    node.confidence === "low"  ? "bg-amber-500 text-white" : "bg-slate-400 text-white"
                  }`}>
                    {node.confidence?.[0]?.toUpperCase() || "M"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-teal-900">{node.claim}</div>
                    <div className="text-teal-600 mt-0.5">
                      → supportée par {(node.sources || []).map((id) => `[${id}]`).join(" ")}
                      {node.avgSourceScore != null && ` · score moyen ${node.avgSourceScore}`}
                    </div>
                  </div>
                </div>
              ))}
              {reasoning.contradictions?.slice(0, 4).map((c, i) => (
                <div key={`c-${i}`} className="flex items-start gap-2 p-2 rounded bg-rose-50 border border-rose-200">
                  <span className="flex-shrink-0 text-[10px] font-bold text-rose-700">⚠</span>
                  <div className="flex-1 text-rose-900">
                    <strong>Contradiction</strong> : {c.note}
                    <div className="text-rose-600 text-[10px] mt-0.5">
                      [{(c.sourcesA || []).join(",")}] ↔ [{(c.sourcesB || []).join(",")}]
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PREVIEW_EXT_LABEL = {
  html: "HTML", svg: "SVG", md: "MD", csv: "CSV", json: "JSON", pptx: "PPTX",
  py: "PY", js: "JS", jsx: "JSX", ts: "TS", tsx: "TSX", css: "CSS",
  sql: "SQL", sh: "SH", yaml: "YAML", yml: "YAML", xml: "XML",
  dart: "DART", go: "GO", rs: "RS", java: "JAVA", kt: "KT", swift: "SWIFT",
  cpp: "C++", c: "C", rb: "RB", php: "PHP", txt: "TXT"
};
const PREVIEWABLE = new Set(["html", "svg", "md", "csv", "json", "pptx"]);

function ArtifactCard({ artifact, onOpen }) {
  const { filename, content, ext } = artifact;
  const lines = (content || "").split("\n").length;
  const size = new Blob([content || ""]).size;
  const sizeLabel = size < 1024 ? `${size} o` : `${(size / 1024).toFixed(1)} Ko`;
  const extLabel = PREVIEW_EXT_LABEL[ext] || (ext || "FILE").toUpperCase();
  const isPreviewable = PREVIEWABLE.has(ext);

  return (
    <button
      onClick={() => onOpen(artifact)}
      className="flex items-stretch gap-0 rounded-xl border border-delt-border bg-white hover:bg-delt-surface hover:border-blue-400 hover:shadow-md transition-all text-left min-w-[260px] max-w-md group overflow-hidden"
    >
      <div className="flex-shrink-0 w-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex flex-col items-center justify-center font-bold text-[10px] uppercase tracking-wider">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5 opacity-80">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>{extLabel}</span>
      </div>
      <div className="flex-1 min-w-0 px-3 py-2.5">
        <div className="font-semibold text-sm text-delt-text truncate">{filename}</div>
        <div className="text-[11px] text-delt-muted mt-0.5">{lines} lignes · {sizeLabel}</div>
        <div className="inline-flex items-center gap-1 text-[10px] text-white bg-blue-600 group-hover:bg-blue-700 font-bold mt-1.5 uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors">
          {isPreviewable ? "▶ Ouvrir l'aperçu" : "▶ Voir le code"}
        </div>
      </div>
      <div className="flex-shrink-0 px-3 flex items-center text-delt-muted group-hover:text-blue-600 transition-colors">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </button>
  );
}

function ThinkingBlock({ reasoning, thinking, streaming }) {
  const [open, setOpen] = useState(false);
  if (!reasoning && !thinking) return null;
  const inProgress = thinking && streaming;

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-delt-muted hover:text-delt-text transition-colors"
      >
        <svg
          viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform flex-shrink-0 ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span className={`font-medium ${inProgress ? "thinking-pulse" : ""}`}>
          {inProgress ? "Thinking" : "Thinked"}
          {inProgress && <span className="thinking-dots" />}
        </span>
      </button>
      {open && reasoning && (
        <div className="mt-3 ml-4 border-l-2 border-delt-border pl-4 text-delt-muted leading-relaxed whitespace-pre-wrap font-mono text-xs">
          {reasoning}
        </div>
      )}
    </div>
  );
}

function RemakePicker({ models, onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [onClose]);

  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    items: models.filter((m) => m.tier === tier && !m.adult)
  })).filter((g) => g.items.length > 0);

  return (
    <div
      ref={ref}
      className="absolute left-10 top-full mt-2 z-50 w-72 bg-white border border-delt-border rounded-xl shadow-lg overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-delt-border text-xs font-semibold text-delt-muted uppercase tracking-widest">
        Refaire avec…
      </div>
      <div className="max-h-80 overflow-y-auto">
        {grouped.map(({ tier, items }) => (
          <div key={tier}>
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-delt-muted bg-delt-surface/60">
              {tier}
            </div>
            {items.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onSelect(m); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-delt-surface text-left transition-colors"
              >
                {BRAND_LOGO[m.brand] && (
                  <img src={BRAND_LOGO[m.brand]} alt={m.brand} className="w-4 h-4 object-contain flex-shrink-0" />
                )}
                <span className="text-sm text-delt-text">{m.display}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatMessage({ msg, models = [], onRemake, onChooseVariant, onMerge, onOpenArtifact, hideAvatar = false, variantIndex, userQuestion }) {
  const isUser = msg.role === "user";
  const generatedTokens = Number(msg.tokensOut ?? 0);
  const [hovered, setHovered] = useState(false);
  const [remakeOpen, setRemakeOpen] = useState(false);

  // Si le message vient du serveur, msg.model n'a que `{ id }` (genre
  // "openai/gpt-4o-mini") — on enrichit avec la marque dérivée du préfixe
  // pour récupérer le logo et un display lisible.
  const fullModel = (() => {
    if (isUser || !msg.model) return msg.model;
    if (msg.model.brand) return msg.model; // déjà enrichi
    const derived = deriveBrandFromId(msg.model.id);
    if (!derived) return msg.model;
    return { ...msg.model, brand: derived.brand, display: msg.model.display || derived.display };
  })();
  const brandLogo = !isUser && fullModel?.brand ? BRAND_LOGO[fullModel.brand] : null;

  // ─── Mode débat : timeline verticale d'agents ───
  if (!isUser && msg.debate && Array.isArray(msg.debate.agents)) {
    return <DebateView msg={msg} />;
  }

  // ─── Mode comparaison : plusieurs variantes côte à côte ───
  if (!isUser && Array.isArray(msg.variants) && msg.variants.length > 0) {
    const anyStreaming = msg.variants.some((v) => v.streaming);
    return (
      <div className="flex flex-col gap-2 animate-fadeIn">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-delt-muted font-semibold pl-10">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>
          </svg>
          Comparaison ({msg.variants.length} réponses)
        </div>
        <div className="flex gap-2 sm:gap-3">
          <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-delt-panel border border-delt-border mt-0.5">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
              <path d="M12 4 L20 20 H4 Z" fill="#6366f1" />
            </svg>
          </div>
          <div
            className="flex-1 min-w-0 grid divide-x divide-delt-border overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${msg.variants.length}, minmax(280px, 1fr))` }}
          >
            {msg.variants.map((v, idx) => (
              <div key={idx} className={`flex flex-col ${idx === 0 ? "pr-3 sm:pr-4" : "px-3 sm:px-4"}`}>
                <div className="flex-1">
                  <ChatMessage
                    msg={{ role: "assistant", ...v }}
                    models={models}
                    onRemake={onRemake}
                    hideAvatar
                    variantIndex={idx}
                  />
                </div>
                {/* Bouton "Choisir celle-ci" — masqué pendant le stream */}
                {!v.streaming && onChooseVariant && (
                  <button
                    type="button"
                    onClick={() => onChooseVariant(idx)}
                    className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-full text-xs font-semibold border border-delt-border text-delt-text hover:bg-delt-surface transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Garder celle-ci
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bouton "Fusionner les réponses" — disponible quand toutes les variantes sont prêtes */}
        {!anyStreaming && onMerge && msg.variants.length >= 2 && !msg.merging && (
          <div className="pl-10 mt-1">
            <button
              type="button"
              onClick={onMerge}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white shadow-md hover:shadow-lg transition-all"
              style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Fusionner les réponses ({msg.variants.length})
            </button>
          </div>
        )}
        {msg.merging && (
          <div className="pl-10 mt-1 text-xs text-delt-muted flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
            </svg>
            Fusion intelligente en cours…
          </div>
        )}
      </div>
    );
  }

  // Mode rendu normal (mais avec option pour cacher l'avatar quand utilisé dans une variante)
  return (
    <div
      className={`flex gap-2 sm:gap-3 animate-fadeIn ${isUser ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      {!hideAvatar && (
        <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 overflow-hidden ${
          isUser
            ? "bg-delt-text text-white"
            : "bg-delt-panel border border-delt-border"
        }`}>
          {isUser ? "T" : brandLogo ? (
            <img src={brandLogo} alt={fullModel?.brand ?? "AI"} className="w-4 h-4 object-contain" />
          ) : (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
              <path d="M12 4 L20 20 H4 Z" fill="#6366f1" />
            </svg>
          )}
        </div>
      )}

      {/* Container : bulle restreinte côté user, pleine largeur côté IA */}
      <div className={`flex flex-col gap-1 relative ${
        isUser
          ? "max-w-[calc(100%-2.25rem)] sm:max-w-[82%] items-end"
          : "flex-1 min-w-0 items-start"
      }`}>
        {/* Indicateur recherche web (Sonar) */}
        {!isUser && msg.websearchStatus && (
          <WebSearchBlock status={msg.websearchStatus} results={msg.webResults} streaming={msg.streaming} />
        )}

        {!isUser && msg.deepSearch && (
          <DeepSearchBlock data={msg.deepSearch} streaming={msg.streaming} />
        )}

        {/* Thinking block */}
        {!isUser && (msg.reasoning || msg.thinking) && (
          <ThinkingBlock reasoning={msg.reasoning} thinking={msg.thinking} streaming={msg.streaming} />
        )}

        {/* Meta modèle — juste le nom du modèle, plus de tier/tokens */}
        {!isUser && fullModel?.display && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-medium text-delt-muted font-mono">{fullModel.display}</span>
          </div>
        )}

        {/* Indicateur de génération musicale */}
        {!isUser && msg.musicLoading && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 text-sm text-purple-700">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin" style={{ animationDuration: "1.5s" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
            </svg>
            <span className="font-medium">Composition en cours… <span className="text-xs text-purple-500">(1-3 min)</span></span>
          </div>
        )}

        {/* Artifacts (fichiers générés via %%write_file) */}
        {!isUser && msg.artifacts?.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {msg.artifacts.map((a, i) => (
              <ArtifactCard key={i} artifact={a} onOpen={onOpenArtifact} />
            ))}
          </div>
        )}

        {/* Images générées via %%generate_image */}
        {!isUser && msg.imagePending && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-sm text-blue-700">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin" style={{ animationDuration: "1.5s" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
            </svg>
            <span className="font-medium truncate">Génération image : {msg.imagePending.slice(0, 60)}…</span>
          </div>
        )}
        {!isUser && msg.generatedImages?.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {msg.generatedImages.map((img, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-delt-border max-w-sm">
                <img src={img.url} alt={img.prompt} className="w-full h-auto block" />
                <div className="px-3 py-2 text-[11px] text-delt-muted bg-delt-surface">
                  {img.model && <span className="font-semibold text-delt-text">{img.model}</span>} · {img.prompt.slice(0, 80)}{img.prompt.length > 80 ? "…" : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contenu */}
        {(isUser || msg.content || msg.imageUrl || msg.videoUrl || msg.musicTracks?.length > 0 || msg.error) && (
          <div className={`w-full ${
            isUser
              ? "px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-tr-sm bg-delt-text text-white text-sm leading-relaxed"
              : msg.error
              ? "px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-tl-sm bg-red-50 border border-red-200 text-red-700"
              : (msg.imageUrl || msg.videoUrl || msg.musicTracks?.length > 0)
              ? "" // pas de bulle, le média gère son propre rendu
              : "text-delt-text" // texte IA brut sur le fond du site
          }`}>
            {isUser ? (
              <>
                {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.attachments.map((att, i) => (
                      <div
                        key={att._id || i}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/15 border border-white/25 max-w-[14rem]"
                      >
                        {att.type === "image" && att.dataUrl ? (
                          <img src={att.dataUrl} alt={att.name} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium truncate">{att.name || att.type}</div>
                          {att.type === "pdf" && att.pageCount && (
                            <div className="text-[10px] opacity-70">{att.readPages}/{att.pageCount} pages</div>
                          )}
                          {att.type === "text" && Number.isFinite(att.size) && (
                            <div className="text-[10px] opacity-70">{(att.size / 1024).toFixed(1)} KB</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {msg.content && <span className="whitespace-pre-wrap">{msg.content}</span>}
              </>
            ) : msg.musicTracks?.length > 0 ? (
              <div className="space-y-3">
                {msg.musicTracks.map((track, idx) => (
                  <div key={track.id || idx} className="flex gap-3 items-start bg-white/60 rounded-xl p-2.5 border border-slate-200">
                    {track.imageUrl && (
                      <img
                        src={track.imageUrl}
                        alt={track.title}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-delt-text truncate">
                        {track.title || `Piste ${idx + 1}`}
                      </div>
                      {track.tags && (
                        <div className="text-[11px] text-delt-muted truncate mb-1.5">{track.tags}</div>
                      )}
                      <audio src={track.audioUrl} controls className="w-full" style={{ height: 32 }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadMedia(track.audioUrl, "mp3")}
                      className="text-delt-muted hover:text-delt-text flex-shrink-0 mt-1"
                      title="Télécharger"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                  </div>
                ))}
                {msg.content && (
                  <div className="text-xs text-delt-muted italic px-1">{msg.content}</div>
                )}
              </div>
            ) : msg.videoUrl ? (
              <div className="space-y-2">
                <video
                  src={msg.videoUrl}
                  controls
                  className="rounded-lg max-w-full"
                  style={{ maxHeight: 512 }}
                />
                <div className="flex items-center justify-between gap-2">
                  {msg.content && (
                    <div className="text-xs text-delt-muted italic truncate">{msg.content}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadMedia(msg.videoUrl, "mp4")}
                    className="flex items-center gap-1 text-xs text-delt-muted hover:text-delt-text transition-colors flex-shrink-0"
                    title="Télécharger la vidéo"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Télécharger
                  </button>
                </div>
              </div>
            ) : msg.imageUrl ? (
              <div className="space-y-2">
                <img
                  src={msg.imageUrl}
                  alt={msg.content || "Image générée"}
                  className="rounded-lg max-w-full"
                  style={{ maxHeight: 512 }}
                />
                <div className="flex items-center justify-between gap-2">
                  {msg.content && (
                    <div className="text-xs text-delt-muted italic truncate">{msg.content}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadMedia(msg.imageUrl, "png")}
                    className="flex items-center gap-1 text-xs text-delt-muted hover:text-delt-text transition-colors flex-shrink-0"
                    title="Télécharger l'image"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Télécharger
                  </button>
                </div>
              </div>
            ) : (
              <MessageRenderer content={stripSkillBlocks(msg.content)} sources={msg.deepSearch?.sources} />
            )}
          </div>
        )}

        {/* Bouton Remake */}
        {!isUser && !msg.streaming && onRemake && models.length > 0 && (
          <div className={`relative transition-opacity ${hovered || remakeOpen ? "opacity-100" : "opacity-0"}`}>
            <button
              type="button"
              onClick={() => setRemakeOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-delt-muted hover:text-delt-text border border-delt-border hover:border-delt-text/30 bg-white transition-colors"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              Refaire
            </button>
            {remakeOpen && (
              <RemakePicker
                models={models}
                onSelect={(m) => onRemake(m)}
                onClose={() => setRemakeOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ROLE_INFO = {
  propose:    { label: "Propose",    color: "#2563eb", emoji: "💡" },
  critique:   { label: "Critique",   color: "#f59e0b", emoji: "🔍" },
  optimize:   { label: "Optimise",   color: "#10b981", emoji: "⚙️" },
  synthesize: { label: "Synthétise", color: "#a855f7", emoji: "✨" }
};

function DebateView({ msg }) {
  const agents = msg.debate.agents;
  const done = msg.debate.done;

  return (
    <div className="flex flex-col gap-3 animate-fadeIn">
      <div className="flex items-center gap-2 pl-10 text-[10px] uppercase tracking-widest text-delt-muted font-semibold">
        🎭 Débat IA · {agents.length} agents
        {!done && (
          <span className="flex items-center gap-1 text-delt-accent">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-delt-accent animate-pulse" />
            en cours
          </span>
        )}
      </div>

      <div className="flex gap-2 sm:gap-3">
        {/* Avatar global */}
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-delt-panel border border-delt-border mt-0.5">
          🎭
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {agents.map((agent, idx) => {
            const role = ROLE_INFO[agent.role] || ROLE_INFO.propose;
            const isLast = idx === agents.length - 1;
            const isFinal = agent.role === "synthesize" || isLast;
            return (
              <div key={idx} className="relative">
                {/* Connecteur vertical entre étapes */}
                {idx < agents.length - 1 && (
                  <div
                    className="absolute left-3.5 top-9 bottom-[-12px] w-0.5"
                    style={{ background: `${role.color}40` }}
                  />
                )}

                <div className={`flex gap-3 ${isFinal ? "pb-2" : ""}`}>
                  {/* Pastille étape */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 z-10 shadow-sm"
                    style={{ background: role.color }}
                  >
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* En-tête agent */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs font-bold text-delt-text flex items-center gap-1">
                        <span>{role.emoji}</span>
                        {role.label}
                      </span>
                      {agent.model && BRAND_LOGO[agent.model.brand] && (
                        <img src={BRAND_LOGO[agent.model.brand]} alt={agent.model.brand} className="w-3.5 h-3.5 object-contain" />
                      )}
                      <span className="text-[11px] text-delt-muted font-mono">
                        {agent.model?.display || agent.model?.id}
                      </span>
                      {agent.streaming && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-delt-accent font-semibold">
                          <span className="inline-block w-1 h-1 rounded-full bg-delt-accent animate-pulse" />
                          écrit…
                        </span>
                      )}
                    </div>

                    {/* Contenu */}
                    {agent.content || agent.streaming ? (
                      <div
                        className={`text-sm leading-relaxed ${
                          isFinal
                            ? "px-3 py-2.5 rounded-xl border-2"
                            : "px-3 py-2 rounded-xl bg-delt-surface/60 border border-delt-border"
                        }`}
                        style={isFinal ? { borderColor: role.color, background: `${role.color}08` } : {}}
                      >
                        {agent.content ? (
                          <MessageRenderer content={agent.content} />
                        ) : (
                          <span className="text-delt-muted italic">…</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-delt-muted italic px-1">En attente…</div>
                    )}
                    {(agent.reasoning || agent.thinking) && (
                      <ThinkingBlock
                        reasoning={agent.reasoning}
                        thinking={agent.thinking}
                        streaming={agent.streaming}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
