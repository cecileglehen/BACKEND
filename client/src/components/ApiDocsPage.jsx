import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useT } from "../lib/i18n.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://deltai-backend.onrender.com").replace(/\/$/, "");

const TIER_ORDER = ["FREE", "UNCENSORED", "PICO", "NANO", "MINI", "NORMAL", "EXPERT", "PRO"];
const TIER_BADGE = {
  FREE: "", UNCENSORED: "badge-venice", PICO: "badge-pico", NANO: "badge-eco", MINI: "badge-mini",
  NORMAL: "badge-normal", EXPERT: "badge-expert", PRO: "badge-pro"
};

const SECTION_KEYS = [
  { id: "intro",       labelKey: "docs.intro" },
  { id: "quickstart",  labelKey: "docs.quickstart" },
  { id: "auth",        labelKey: "docs.auth" },
  { id: "base-url",    labelKey: "docs.base_url_sdk" },
  { id: "endpoints",   labelKey: "docs.endpoints" },
  { id: "chat",        labelKey: "docs.chat_completions" },
  { id: "streaming",   labelKey: "docs.streaming" },
  { id: "multimodal",  labelKey: "docs.vision" },
  { id: "models",      labelKey: "docs.catalog" },
  { id: "pricing",     labelKey: "docs.pricing_label" },
  { id: "limits",      labelKey: "docs.limits" },
  { id: "errors",      labelKey: "docs.errors" },
  { id: "cookbook",    labelKey: "docs.cookbook" },
  { id: "faq",         labelKey: "docs.faq" }
];

function formatCtx(n) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })}
      className="absolute top-2 right-2 z-10 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
    >
      {copied ? "✓ Copié" : "Copier"}
    </button>
  );
}

function Code({ children, lang }) {
  return (
    <div className="relative rounded-xl bg-slate-950 my-3 overflow-hidden">
      <CopyBtn text={children} />
      {lang && (
        <div className="absolute top-2 left-3 z-10 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
          {lang}
        </div>
      )}
      <pre className={`p-4 ${lang ? "pt-8" : ""} text-[11px] sm:text-xs leading-relaxed overflow-x-auto text-slate-200 font-mono`}>
        {children}
      </pre>
    </div>
  );
}

function H2({ id, children }) {
  return (
    <h2 id={id} className="text-2xl font-extrabold text-delt-text tracking-tight mt-12 mb-4 scroll-mt-20 flex items-center gap-2">
      <span className="inline-block w-1.5 h-7 rounded-full" style={{ background: "linear-gradient(180deg,#2563eb,#06b6d4)" }} />
      {children}
    </h2>
  );
}

function H3({ children }) {
  return <h3 className="text-base font-bold text-delt-text mt-6 mb-2">{children}</h3>;
}

function P({ children }) {
  return <p className="text-sm text-delt-muted leading-relaxed mb-3">{children}</p>;
}

function Endpoint({ method, path, desc }) {
  const colors = {
    GET:    "bg-emerald-100 text-emerald-700",
    POST:   "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700"
  };
  return (
    <div className="rounded-xl border border-delt-border p-3 sm:p-4 mb-2 bg-white hover:border-delt-text/30 transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colors[method]}`}>{method}</span>
        <code className="font-mono text-sm font-semibold text-delt-text">{path}</code>
      </div>
      <p className="text-xs text-delt-muted">{desc}</p>
    </div>
  );
}

function Param({ name, type, required, desc }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_80px_1fr] gap-1 sm:gap-3 py-2 border-b border-delt-border last:border-0 text-xs">
      <code className="font-mono text-delt-text font-bold">
        {name}
        {required && <span className="text-red-500 ml-1">*</span>}
      </code>
      <code className="text-delt-muted font-mono">{type}</code>
      <span className="text-delt-muted leading-relaxed">{desc}</span>
    </div>
  );
}

export default function ApiDocsPage() {
  const t = useT();
  const [catalog, setCatalog] = useState(null);
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => {
      const offset = 80;
      for (const sec of [...SECTION_KEYS].reverse()) {
        const el = document.getElementById(sec.id);
        if (el && el.getBoundingClientRect().top <= offset) {
          setActiveSection(sec.id);
          return;
        }
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const allModels = [];
  if (catalog) {
    for (const tier of TIER_ORDER) {
      const cat = catalog.categories?.[tier];
      if (!cat) continue;
      for (const m of cat.models) allModels.push({ ...m, tier, tierCost: cat.cost });
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">

      {/* Hero */}
      <div className="mb-10 flex items-center gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-2xl shadow-md flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-delt-text tracking-tight">{t("docs.title")}</h1>
          <p className="text-sm text-delt-muted">API REST compatible OpenAI · {allModels.length || "30+"} modèles dans un seul endpoint</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-6 sm:gap-10">

        {/* Sidebar TOC */}
        <aside className="hidden lg:block">
          <nav className="sticky top-6 space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-delt-muted mb-2 px-2">{t("docs.toc")}</div>
            {SECTION_KEYS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`block px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  activeSection === s.id
                    ? "bg-indigo-50 text-delt-accent font-semibold"
                    : "text-delt-muted hover:text-delt-text hover:bg-delt-surface"
                }`}
              >
                {t(s.labelKey)}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 max-w-3xl">

          {/* ─── INTRO ───────────────────────────── */}
          <section id="intro" className="scroll-mt-20">
            <H2 id="intro">{t("docs.intro")}</H2>
            <P>
              L'<strong className="text-delt-text">API DELT</strong> donne accès à tous les meilleurs modèles d'IA du marché — GPT-5, Claude Sonnet/Opus, Gemini, Grok, Mistral, Llama, DeepSeek, Perplexity Sonar et plus — derrière un <strong>endpoint unique</strong> compatible avec le SDK OpenAI.
            </P>
            <P>
              Tu n'as <strong className="text-delt-text">qu'une seule clé</strong>, qu'un seul abonnement, et tu changes de modèle juste en changeant le paramètre <code className="font-mono bg-delt-surface px-1.5 py-0.5 rounded text-[11px]">model</code>.
            </P>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {[
                { t: "Compatible OpenAI", d: "Drop-in replacement" },
                { t: "Streaming SSE",     d: "Tokens en temps réel" },
                { t: "Multimodal",        d: "Vision + texte" },
                { t: "Tarif unique",      d: "Un seul abonnement" }
              ].map((f) => (
                <div key={f.t} className="rounded-xl bg-delt-surface p-3 text-center">
                  <div className="text-xs font-bold text-delt-text">{f.t}</div>
                  <div className="text-[10px] text-delt-muted mt-0.5">{f.d}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── QUICK START ─────────────────────── */}
          <section id="quickstart">
            <H2 id="quickstart">{t("docs.quickstart")}</H2>
            <P>{t("docs.steps")}</P>
            <div className="space-y-3">
              {[
                { n: 1, t: "Crée une clé API", d: <>Va dans l'onglet <a href="/api" className="text-delt-accent font-semibold hover:underline">API</a>, clique "Créer une clé", et copie-la (elle ne sera affichée qu'une seule fois).</> },
                { n: 2, t: "Active ta clé", d: <>Depuis le même onglet, active l'usage API associé à ta clé.</> },
                { n: 3, t: "Lance ta première requête", d: <>Pointe ton SDK OpenAI vers <code className="font-mono bg-delt-surface px-1 py-0.5 rounded text-[11px]">{API_BASE}/v1</code> et c'est parti.</> }
              ].map((step) => (
                <div key={step.n} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#2563eb,#06b6d4)" }}>
                    {step.n}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-delt-text">{step.t}</div>
                    <div className="text-xs text-delt-muted mt-0.5">{step.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <H3>{t("docs.complete_example")}</H3>
            <Code lang="python">{`from openai import OpenAI

client = OpenAI(
    api_key="sk-delt-...",
    base_url="${API_BASE}/v1"
)

response = client.chat.completions.create(
    model="openai/gpt-5.4",
    messages=[{"role": "user", "content": "Explique la photosynthèse en 2 phrases."}]
)

print(response.choices[0].message.content)`}</Code>
          </section>

          {/* ─── AUTH ────────────────────────────── */}
          <section id="auth">
            <H2 id="auth">{t("docs.auth")}</H2>
            <P>
              Toutes les requêtes doivent inclure ta clé API dans le header :
            </P>
            <Code>{`Authorization: Bearer sk-delt-VOTRE_CLE`}</Code>

            <H3>{t("docs.key_format")}</H3>
            <P>
              Toutes les clés DELT commencent par <code className="font-mono bg-delt-surface px-1.5 py-0.5 rounded text-[11px]">sk-delt-</code> suivi de 64 caractères hex aléatoires. Exemple :
              <br />
              <code className="font-mono text-[11px] text-delt-muted">sk-delt-533ea05dac3b...</code>
            </P>

            <H3>{t("docs.security")}</H3>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs space-y-2">
              <div><strong className="text-amber-900">⚠ Ne mets jamais ta clé dans du code public.</strong> Stocke-la côté serveur ou dans un gestionnaire de secrets (env vars, AWS Secrets, etc.).</div>
              <div>Une clé compromise peut être <strong>révoquée immédiatement</strong> depuis l'onglet API.</div>
              <div>Crée une clé distincte par environnement (dev, staging, prod) pour mieux tracer.</div>
            </div>
          </section>

          {/* ─── BASE URL & SDK ──────────────────── */}
          <section id="base-url">
            <H2 id="base-url">{t("docs.base_url_sdk")}</H2>
            <P>
              L'API DELT est <strong>strictement compatible</strong> avec l'API <code className="font-mono bg-delt-surface px-1 py-0.5 rounded text-[11px]">/v1/chat/completions</code> d'OpenAI. Tu peux donc utiliser n'importe quel SDK officiel ou tiers — il suffit de changer la base URL.
            </P>
            <div className="rounded-xl bg-delt-surface p-4 mb-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-delt-muted">{t("docs.base_url")}</div>
              <div className="font-mono text-sm font-bold text-delt-text mt-1">{API_BASE}/v1</div>
            </div>

            <H3>Python</H3>
            <Code lang="python">{`pip install openai

from openai import OpenAI
client = OpenAI(api_key="sk-delt-...", base_url="${API_BASE}/v1")`}</Code>

            <H3>Node.js / TypeScript</H3>
            <Code lang="typescript">{`npm install openai

import OpenAI from "openai";
const client = new OpenAI({ apiKey: "sk-delt-...", baseURL: "${API_BASE}/v1" });`}</Code>

            <H3>Go</H3>
            <Code lang="go">{`import (
    "github.com/sashabaranov/go-openai"
)

config := openai.DefaultConfig("sk-delt-...")
config.BaseURL = "${API_BASE}/v1"
client := openai.NewClientWithConfig(config)`}</Code>

            <H3>cURL</H3>
            <Code lang="bash">{`curl ${API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer sk-delt-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openai/gpt-5.4-nano","messages":[{"role":"user","content":"hi"}]}'`}</Code>
          </section>

          {/* ─── ENDPOINTS ───────────────────────── */}
          <section id="endpoints">
            <H2 id="endpoints">{t("docs.endpoints")}</H2>
            <Endpoint method="GET"  path="/v1/models" desc="Liste tous les modèles disponibles avec leur ID, tier et capacités." />
            <Endpoint method="POST" path="/v1/chat/completions" desc="Génère une réponse texte. Supporte le streaming SSE et le multimodal (images)." />
          </section>

          {/* ─── CHAT COMPLETIONS ────────────────── */}
          <section id="chat">
            <H2 id="chat">{t("docs.chat_completions")}</H2>
            <P>
              Endpoint principal pour générer du texte. <strong>Drop-in replacement</strong> de l'endpoint OpenAI du même nom.
            </P>

            <H3>{t("docs.params")}</H3>
            <div className="rounded-xl border border-delt-border bg-white p-4">
              <Param name="model"        type="string"  required desc="ID exact du modèle (ex: openai/gpt-5.4, anthropic/claude-sonnet-4-5)" />
              <Param name="messages"     type="array"   required desc="Historique au format [{role, content}]. Roles : system, user, assistant" />
              <Param name="stream"       type="boolean" desc="Active le streaming SSE token par token (défaut : false)" />
              <Param name="temperature"  type="number"  desc="0 à 2. Plus haut = plus créatif (défaut : 1)" />
              <Param name="max_tokens"   type="number"  desc="Limite de tokens en sortie (défaut : illimité)" />
              <Param name="top_p"        type="number"  desc="Nucleus sampling (0-1). Alternative à temperature" />
              <Param name="stop"         type="string|array" desc="Séquence(s) qui arrêtent la génération" />
              <Param name="presence_penalty"  type="number"  desc="-2 à 2. Pénalise les tokens déjà utilisés" />
              <Param name="frequency_penalty" type="number"  desc="-2 à 2. Pénalise la répétition" />
              <Param name="seed"         type="number"  desc="Pour reproductibilité (si supporté par le modèle)" />
            </div>

            <H3>{t("docs.example")}</H3>
            <Code lang="python">{`response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4-5",
    messages=[
        {"role": "system", "content": "Tu es un expert en biologie marine."},
        {"role": "user",   "content": "Quel est le plus grand mammifère ?"}
    ],
    temperature=0.7,
    max_tokens=500
)
print(response.choices[0].message.content)`}</Code>

            <H3>{t("docs.response_format")}</H3>
            <Code lang="json">{`{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1730000000,
  "model": "anthropic/claude-sonnet-4-5",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "La baleine bleue..." },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 42,
    "total_tokens": 60,
    "reasoning_tokens": 0
  },
  "delt": {
    "tier": "NORMAL"
  }
}`}</Code>
            <P>
              Le champ <code className="font-mono bg-delt-surface px-1.5 py-0.5 rounded text-[11px]">delt</code> est <strong className="text-delt-text">spécifique à DELT</strong> et indique le tier du modèle utilisé.
            </P>
          </section>

          {/* ─── STREAMING ──────────────────────── */}
          <section id="streaming">
            <H2 id="streaming">{t("docs.streaming")}</H2>
            <P>
              Active <code className="font-mono bg-delt-surface px-1 py-0.5 rounded text-[11px]">stream: true</code> pour recevoir les tokens au fur et à mesure (Server-Sent Events au format OpenAI standard).
            </P>

            <H3>Python</H3>
            <Code lang="python">{`stream = client.chat.completions.create(
    model="openai/gpt-5.4",
    messages=[{"role": "user", "content": "Compte jusqu'à 10."}],
    stream=True
)

for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)`}</Code>

            <H3>Node.js</H3>
            <Code lang="javascript">{`const stream = await client.chat.completions.create({
  model: "openai/gpt-5.4",
  messages: [{ role: "user", content: "Compte jusqu'à 10." }],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}`}</Code>

            <H3>{t("docs.chunks_format")}</H3>
            <Code lang="text">{`data: {"id":"...","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"...","choices":[{"delta":{"content":" world"}}]}

data: {"id":"...","choices":[{"delta":{},"finish_reason":"stop"}]}

data: [DONE]`}</Code>
          </section>

          {/* ─── MULTIMODAL ──────────────────────── */}
          <section id="multimodal">
            <H2 id="multimodal">{t("docs.vision")}</H2>
            <P>
              Plusieurs modèles supportent la vision (analyse d'images). Passe l'image en base64 ou via URL dans le content du message :
            </P>
            <Code lang="python">{`response = client.chat.completions.create(
    model="openai/gpt-5.4",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Décris cette image."},
            {"type": "image_url", "image_url": {
                "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
            }}
        ]
    }]
)`}</Code>
            <P>
              Modèles compatibles : <strong>GPT-5.4</strong>, <strong>GPT-5.5</strong>, <strong>Claude Sonnet/Opus 4.5</strong>, <strong>Gemini 2.5 Flash/Pro</strong>, <strong>Grok 4.20</strong>.
            </P>
          </section>

          {/* ─── MODELS CATALOG ──────────────────── */}
          <section id="models">
            <H2 id="models">{t("docs.catalog")}</H2>
            <P>
              <strong className="text-delt-text">{allModels.length}</strong> modèles disponibles, organisés par tier. Les modèles <strong>FREE</strong> sont 100 % gratuits.
            </P>

            <div className="rounded-2xl border border-delt-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[700px] w-full text-sm">
                  <thead className="bg-delt-surface border-b border-delt-border">
                    <tr>
                      <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-delt-muted">{t("usage.col_tier")}</th>
                      <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-delt-muted">ID</th>
                      <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-delt-muted">{t("usage.col_model")}</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-delt-muted">Ctx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-delt-border">
                    {allModels.map((m) => (
                      <tr key={m.id} className="hover:bg-delt-surface transition-colors">
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${TIER_BADGE[m.tier] ?? ""}`}>
                            {m.tier}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-delt-text whitespace-nowrap">{m.id}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-delt-text text-xs">{m.display}</div>
                          <div className="text-[10px] text-delt-muted">{m.brand}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-delt-muted">{formatCtx(m.ctx)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <H3>{t("docs.creative_cats")}</H3>
            <P>
              Génération d'image (<code className="font-mono text-[11px]">/api/image</code>), vidéo (<code className="font-mono text-[11px]">/api/video</code>) et musique (<code className="font-mono text-[11px]">/api/music</code>) facturées par génération, pas par tokens.
            </P>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="rounded-xl bg-delt-surface p-3 text-center">
                <div className="text-xs font-bold text-delt-text">{t("artist.tab_image")}</div>
                <div className="text-[10px] text-delt-muted mt-1">FLUX · Nano Banana · GPT Image</div>
              </div>
              <div className="rounded-xl bg-delt-surface p-3 text-center">
                <div className="text-xs font-bold text-delt-text">{t("artist.tab_video")}</div>
                <div className="text-[10px] text-delt-muted mt-1">Seedance 2 — 720p</div>
              </div>
              <div className="rounded-xl bg-delt-surface p-3 text-center">
                <div className="text-xs font-bold text-delt-text">Musique</div>
                <div className="text-[10px] text-delt-muted mt-1">Suno V5.5 — 2 pistes / requête</div>
              </div>
            </div>
          </section>

          {/* ─── PRICING ─────────────────────────── */}
          <section id="pricing">
            <H2 id="pricing">Facturation</H2>

            <P>
              L'API DELT est incluse dans ton abonnement. Tu actives l'API depuis l'onglet <a href="/api" className="text-delt-accent font-semibold hover:underline">API</a> et tu utilises ta clé <code className="font-mono">sk-delt-...</code> avec n'importe quel SDK compatible OpenAI.
            </P>

            <H3>Plans mensuels</H3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { n: "BASIC", p: "10€",  c: "Usage inclus" },
                { n: "PLUS",  p: "23€",  c: "2,5× Starter" },
                { n: "PRO",   p: "75€",  c: "8,5× Starter" },
                { n: "ULTRA", p: "200€", c: "25× Starter" }
              ].map((p) => (
                <div key={p.n} className="rounded-xl border border-delt-border bg-white p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-delt-muted">{p.n}</div>
                  <div className="text-xl font-extrabold text-delt-text mt-1">{p.p}</div>
                  <div className="text-[11px] font-bold text-delt-accent mt-0.5">{p.c}</div>
                </div>
              ))}
            </div>

            <P>
              Les <strong>reasoning tokens</strong> (Sonar Deep Research, GPT-5.5 Pro…) sont comptés comme output dans le champ <code className="font-mono">usage</code>.
            </P>
          </section>

          {/* ─── LIMITS ──────────────────────────── */}
          <section id="limits">
            <H2 id="limits">Limites & bonnes pratiques</H2>
            <H3>Limites par défaut</H3>
            <div className="rounded-xl border border-delt-border bg-white p-4">
              <Param name="Rate limit"      type="—" desc="60 requêtes / minute par clé. Au-delà : 429" />
              <Param name="Max tokens IN"   type="—" desc="≈ 50k caractères (~13k tokens) par message" />
              <Param name="Max tokens OUT"  type="—" desc="Selon le modèle (4k–128k typiquement)" />
              <Param name="Concurrent"      type="—" desc="10 requêtes en parallèle par clé" />
              <Param name="Timeout"         type="—" desc="120 s par requête (10 min pour vidéo)" />
            </div>

            <H3>Best practices</H3>
            <ul className="space-y-2 text-xs text-delt-muted list-disc pl-5">
              <li><strong className="text-delt-text">Cache</strong> les réponses identiques côté serveur — chaque appel consomme du quota.</li>
              <li>Utilise <strong className="text-delt-text">stream=true</strong> pour l'UX et pour pouvoir abort si l'utilisateur change d'idée.</li>
              <li>Limite <strong className="text-delt-text">max_tokens</strong> à ce dont tu as besoin — ça réduit la consommation.</li>
              <li>Pour les retries, utilise un <strong className="text-delt-text">exponential backoff</strong> (2s, 4s, 8s, …) sur les 429 et 5xx.</li>
              <li>Garde une <strong className="text-delt-text">clé par environnement</strong>. Révoque immédiatement si fuite.</li>
              <li>Pour les apps multi-users, <strong className="text-delt-text">ne mets jamais la clé côté client</strong> — proxy via ton backend.</li>
            </ul>
          </section>

          {/* ─── ERRORS ──────────────────────────── */}
          <section id="errors">
            <H2 id="errors">Codes d'erreur</H2>
            <div className="rounded-xl border border-delt-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-delt-surface border-b border-delt-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-[10px] text-delt-muted">Code</th>
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-[10px] text-delt-muted">Type</th>
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-[10px] text-delt-muted">Cause / Solution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-delt-border">
                  {[
                    ["400", "invalid_request_error", "Paramètre manquant ou mal formaté. Vérifie ton JSON."],
                    ["401", "authentication_error", "Clé invalide, manquante ou révoquée."],
                    ["402", "insufficient_quota",   "Quota API atteint. Vérifie ton plan ou attends le renouvellement."],
                    ["403", "permission_error",     "Modèle non accessible pour ton plan."],
                    ["404", "model_not_found",      "Vérifie l'ID du modèle dans la table."],
                    ["429", "rate_limit_error",     "Trop de requêtes. Attends ou implémente un backoff."],
                    ["500", "api_error",            "Erreur serveur DELT. Retry après quelques secondes."],
                    ["502", "upstream_error",       "Le provider amont (OpenRouter, fal.ai…) est down. Retry."],
                    ["504", "timeout",              "Modèle trop lent. Réduis max_tokens ou change de modèle."]
                  ].map(([c, t, d]) => (
                    <tr key={c} className="hover:bg-delt-surface">
                      <td className="px-4 py-2.5 font-mono font-bold text-delt-text">{c}</td>
                      <td className="px-4 py-2.5 font-mono text-delt-accent text-[11px]">{t}</td>
                      <td className="px-4 py-2.5 text-delt-muted">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <H3>Format d'erreur</H3>
            <Code lang="json">{`{
  "error": {
    "message": "Quota API atteint pour ce plan.",
    "type": "insufficient_quota",
    "code": 402
  }
}`}</Code>
          </section>

          {/* ─── COOKBOOK ────────────────────────── */}
          <section id="cookbook">
            <H2 id="cookbook">Cookbook</H2>

            <H3>1 · Switch dynamique de modèle selon le contexte</H3>
            <Code lang="python">{`def smart_route(question):
    if len(question) < 50:
        model = "openai/gpt-5.4-nano"       # Court → modèle léger
    elif "code" in question.lower():
        model = "openai/gpt-5.3-codex"      # Code spécialisé
    elif "actualité" in question.lower():
        model = "perplexity/sonar"          # Web search
    else:
        model = "openai/gpt-5.4"            # Default
    return client.chat.completions.create(model=model, messages=[...])`}</Code>

            <H3>2 · Retry avec exponential backoff</H3>
            <Code lang="python">{`import time

def call_with_retry(messages, max_retries=3):
    for i in range(max_retries):
        try:
            return client.chat.completions.create(
                model="openai/gpt-5.4", messages=messages
            )
        except Exception as e:
            if i == max_retries - 1: raise
            time.sleep(2 ** i)  # 1s, 2s, 4s`}</Code>

            <H3>3 · Compteur de tokens</H3>
            <Code lang="python">{`total_tokens = 0

for question in questions:
    r = client.chat.completions.create(
        model="openai/gpt-5.4-mini",
        messages=[{"role": "user", "content": question}]
    )
    total_tokens += r.usage.total_tokens
    print(f"{question[:30]:<30} → {r.usage.total_tokens} tok")

print(f"\\nTotal : {total_tokens} tokens")`}</Code>

            <H3>4 · Streaming avec interruption</H3>
            <Code lang="javascript">{`const ctrl = new AbortController();

// Après 5s, on coupe
setTimeout(() => ctrl.abort(), 5000);

const stream = await client.chat.completions.create({
  model: "openai/gpt-5.4",
  messages: [...],
  stream: true
}, { signal: ctrl.signal });

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}`}</Code>
          </section>

          {/* ─── FAQ ─────────────────────────────── */}
          <section id="faq">
            <H2 id="faq">FAQ</H2>
            {[
              { q: "Puis-je utiliser le SDK OpenAI officiel ?", a: "Oui. C'est même recommandé. DELT est strictement compatible — change juste base_url." },
              { q: "Mon usage est-il reporté d'un mois sur l'autre ?", a: "Non. L'usage mensuel est renouvelé à chaque échéance d'abonnement." },
              { q: "Y a-t-il des frais de mise en route ?", a: "Aucun. Pas d'engagement non plus." },
              { q: "Puis-je avoir une facture ?", a: "Oui, depuis l'onglet Settings → Facturation." },
              { q: "L'API est-elle stable ?", a: "Endpoints v1 stables. Toute breaking change sera annoncée 90 jours à l'avance et un endpoint v2 sera dispo en parallèle." },
              { q: "Mes données sont-elles entraînées ?", a: "Non. Aucune donnée client n'est utilisée pour entraîner des modèles. Voir notre politique de confidentialité." },
              { q: "Quelle latence ?", a: "Première token : 200-800 ms selon le modèle. Throughput : 50-150 tokens/sec en moyenne." }
            ].map((f) => (
              <details key={f.q} className="border border-delt-border rounded-xl bg-white mb-2 group">
                <summary className="px-4 py-3 cursor-pointer text-sm font-bold text-delt-text flex items-center justify-between">
                  {f.q}
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180 flex-shrink-0 ml-2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </summary>
                <div className="px-4 pb-3 text-xs text-delt-muted leading-relaxed">{f.a}</div>
              </details>
            ))}
          </section>

          {/* CTA */}
          <div className="mt-16 mb-4 rounded-2xl p-6 text-center text-white"
            style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0e7490 100%)" }}>
            <div className="text-lg font-extrabold mb-1">Prêt à coder avec DELT ?</div>
            <div className="text-sm text-blue-200 mb-4">Crée ta première clé en moins de 30 secondes.</div>
            <a href="/api" className="inline-block px-6 py-2.5 rounded-full bg-white text-slate-900 text-sm font-bold hover:bg-slate-50 transition-colors">
              Aller au panneau API →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
