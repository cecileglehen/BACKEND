import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useT } from "../lib/i18n.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://deltai-backend.onrender.com").replace(/\/$/, "");

const LANGS = [
  {
    id: "python",
    label: "Python",
    code: (key) => `from openai import OpenAI

client = OpenAI(
    api_key="${key}",
    base_url="${API_BASE}/v1"
)

response = client.chat.completions.create(
    model="openai/gpt-5.4-nano",
    messages=[{"role": "user", "content": "Hello DELT !"}]
)
print(response.choices[0].message.content)
print("Coût :", response.delt.credit_cost, "Cr")`
  },
  {
    id: "node",
    label: "Node.js",
    code: (key) => `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${key}",
  baseURL: "${API_BASE}/v1"
});

const res = await client.chat.completions.create({
  model: "openai/gpt-5.4-nano",
  messages: [{ role: "user", content: "Hello DELT !" }]
});

console.log(res.choices[0].message.content);
console.log("Coût :", res.delt.credit_cost, "Cr");`
  },
  {
    id: "curl",
    label: "cURL",
    code: (key) => `curl ${API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-5.4-nano",
    "messages": [{"role":"user","content":"Hello"}]
  }'`
  }
];

function CopyButton({ text, label }) {
  const t = useT();
  const finalLabel = label || t("apikeys.copy");
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-delt-muted hover:text-delt-text px-2 py-1 rounded-md hover:bg-delt-surface transition-colors"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span className="text-emerald-600">{t("apikeys.copied")}</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {finalLabel}
        </>
      )}
    </button>
  );
}

export default function ApiKeysPage() {
  const t = useT();
  const [keys, setKeys]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [creating, setCreating]           = useState(false);
  const [newName, setNewName]             = useState("");
  const [revealedKey, setRevealedKey]     = useState(null);
  const [error, setError]                 = useState(null);
  const [credits, setCredits]             = useState(0);
  const [apiCredits, setApiCredits]       = useState(0);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState("to_api");
  const [transferring, setTransferring]   = useState(false);
  const [snippetLang, setSnippetLang]     = useState("python");

  const refreshQuota = async () => {
    try {
      const q = await api.quota();
      setCredits(Number(q.credits ?? 0));
      setApiCredits(Number(q.apiCredits ?? 0));
    } catch { /* */ }
  };

  const refresh = async () => {
    try {
      const { keys } = await api.listApiKeys();
      setKeys(keys || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    refreshQuota();
  };

  useEffect(() => { refresh(); }, []);

  const handleTransfer = async () => {
    const n = Number(transferAmount);
    if (!Number.isFinite(n) || n <= 0) { setError("Montant invalide"); return; }
    setTransferring(true); setError(null);
    try {
      const r = await api.transferCredits(n, transferDirection);
      setCredits(r.credits);
      setApiCredits(r.apiCredits);
      setTransferAmount("");
    } catch (e) {
      setError(e.message);
    } finally {
      setTransferring(false);
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true); setError(null);
    try {
      const result = await api.createApiKey(newName);
      setRevealedKey(result);
      setNewName("");
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm(t("apikeys.revoke_confirm2"))) return;
    try {
      await api.revokeApiKey(id);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const activeKeys = useMemo(() => keys.filter((k) => !k.revoked_at), [keys]);
  const revokedKeys = useMemo(() => keys.filter((k) => k.revoked_at), [keys]);

  const exampleKey = revealedKey?.key || "sk-delt-VOTRE_CLE_ICI";
  const snippet = LANGS.find((l) => l.id === snippetLang);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-6">

      {/* Hero */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl shadow-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-delt-text tracking-tight">{t("apikeys.title")}</h1>
          <p className="text-sm text-delt-muted">{t("apikeys.subtitle2")}</p>
        </div>
      </div>

      {/* Soldes & transfert */}
      <div className="rounded-2xl bg-white border border-delt-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-delt-muted">{t("apikeys.credits_balance")}</div>
          <a href="/billing" className="text-[11px] font-semibold text-delt-accent hover:underline">{t("apikeys.recharge")}</a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl bg-delt-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-widest text-delt-muted">{t("apikeys.plan_app")}</span>
            </div>
            <div className="text-2xl font-extrabold text-delt-text font-mono">
              {credits.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-delt-muted ml-1">Cr</span>
            </div>
            <div className="text-[10px] text-delt-muted mt-0.5">{t("apikeys.plan_desc")}</div>
          </div>

          <div className="rounded-xl p-4 border" style={{ background: "linear-gradient(135deg, #eff6ff, #ecfeff)", borderColor: "#bfdbfe" }}>
            <div className="flex items-center gap-2 mb-2">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">{t("apikeys.api_label")}</span>
            </div>
            <div className="text-2xl font-extrabold text-blue-700 font-mono">
              {apiCredits.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-blue-600 ml-1">Cr</span>
            </div>
            <div className="text-[10px] text-blue-600/80 mt-0.5">{t("apikeys.api_desc")}</div>
          </div>
        </div>

        <div className="text-[11px] text-delt-muted mb-3 leading-relaxed">
          ⚡ Pour utiliser l'API, transfère des crédits depuis ton plan. Tu peux faire l'inverse à tout moment.
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={transferDirection}
            onChange={(e) => setTransferDirection(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-delt-border bg-white outline-none focus:border-delt-accent"
          >
            <option value="to_api">{t("apikeys.to_api")}</option>
            <option value="to_plan">{t("apikeys.to_plan")}</option>
          </select>
          <input
            type="number"
            min="1" step="1"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder={t("apikeys.amount_placeholder")}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-delt-border outline-none focus:border-delt-accent"
          />
          <button
            onClick={handleTransfer}
            disabled={transferring || !transferAmount}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}
          >
            {transferring ? "..." : t("apikeys.transfer_btn")}
          </button>
        </div>
      </div>

      {/* Clé révélée */}
      {revealedKey && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5 animate-fadeIn">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-900">{t("apikeys.new_key")}</div>
                <div className="text-[11px] text-emerald-700">{t("apikeys.warning_once")}</div>
              </div>
            </div>
            <button onClick={() => setRevealedKey(null)} className="text-emerald-700 hover:text-emerald-900 text-lg leading-none">✕</button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 font-mono text-xs bg-white border border-emerald-200 rounded-xl px-3 py-2.5 break-all">
              {revealedKey.key}
            </code>
            <CopyButton text={revealedKey.key} label="Copier la clé" />
          </div>
        </div>
      )}

      {/* Création */}
      <div className="rounded-2xl bg-white border border-delt-border p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-widest text-delt-muted mb-3">{t("apikeys.create_section")}</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("apikeys.name_placeholder2")}
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-delt-border outline-none focus:border-delt-accent"
            maxLength={100}
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 flex items-center gap-1.5 justify-center"
            style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}
          >
            {creating ? "..." : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {t("apikeys.create")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* Liste */}
      <div className="rounded-2xl bg-white border border-delt-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-widest text-delt-muted">
            Clés actives ({activeKeys.length})
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-delt-muted py-4">{t("apikeys.loading")}</div>
        ) : activeKeys.length === 0 ? (
          <div className="text-sm text-delt-muted py-4 text-center bg-delt-surface rounded-xl">
            Aucune clé active. Crée-en une pour commencer.
          </div>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((k) => (
              <div key={k.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-3 rounded-xl border border-delt-border bg-white hover:border-delt-text/20 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-bold text-delt-text truncate">{k.name || "(sans nom)"}</span>
                  </div>
                  <div className="text-[11px] text-delt-muted font-mono mt-1 truncate">
                    {k.key_prefix}... · Créée {new Date(k.created_at).toLocaleDateString("fr-FR")}
                    {k.last_used_at && ` · Utilisée ${new Date(k.last_used_at).toLocaleDateString("fr-FR")}`}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 px-3 py-1.5 rounded-full border border-red-200 hover:border-red-600 transition-colors flex-shrink-0"
                >
                  {t("apikeys.revoke")}
                </button>
              </div>
            ))}
          </div>
        )}

        {revokedKeys.length > 0 && (
          <details className="mt-4 group">
            <summary className="text-xs font-semibold text-delt-muted cursor-pointer hover:text-delt-text">
              {revokedKeys.length} clé{revokedKeys.length > 1 ? "s" : ""} révoquée{revokedKeys.length > 1 ? "s" : ""}
            </summary>
            <div className="mt-2 space-y-1.5">
              {revokedKeys.map((k) => (
                <div key={k.id} className="px-3 py-2 rounded-lg bg-delt-surface text-xs opacity-70">
                  <span className="font-medium">{k.name || "(sans nom)"}</span>
                  <span className="text-delt-muted ml-2 font-mono">{k.key_prefix}...</span>
                  <span className="text-red-600 ml-2 font-semibold">{t("apikeys.revoked_badge")}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Quick start */}
      <div className="rounded-2xl bg-white border border-delt-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-xs font-bold uppercase tracking-widest text-delt-muted">{t("apikeys.quick_test")}</div>
          <div className="inline-flex p-0.5 rounded-full bg-delt-surface border border-delt-border">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSnippetLang(l.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                  snippetLang === l.id ? "bg-white shadow-sm text-delt-text" : "text-delt-muted hover:text-delt-text"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative rounded-xl bg-slate-950 overflow-hidden">
          <div className="absolute top-2 right-2 z-10">
            <CopyButton text={snippet?.code(exampleKey) ?? ""} />
          </div>
          <pre className="p-4 text-[11px] sm:text-xs leading-relaxed overflow-x-auto text-slate-200 font-mono">
            {snippet?.code(exampleKey)}
          </pre>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-delt-muted">
          <span>
            Base URL : <code className="font-mono text-delt-text bg-delt-surface px-1.5 py-0.5 rounded">{API_BASE}/v1</code>
          </span>
          <a href="/docs" className="font-semibold text-delt-accent hover:underline">
            Documentation complète →
          </a>
        </div>
      </div>
    </div>
  );
}
