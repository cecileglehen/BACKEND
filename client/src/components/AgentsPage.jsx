import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { useT } from "../lib/i18n.jsx";
import ChatPage from "../pages/ChatPage.jsx";

const ICONS = ["🤖", "🧠", "💼", "📊", "✍️", "🎯", "🔬", "⚖️", "💡", "🎨", "📚", "🩺", "💻", "📈", "🛒", "🎓", "🗂️", "🌍", "🛠️", "🚀"];
const COLORS = ["#6366f1", "#0891b2", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];

const ALL_TOOLS = [
  { app: "gmail", label: "Gmail" },
  { app: "googledrive", label: "Google Drive" },
  { app: "googlecalendar", label: "Google Calendar" },
  { app: "slack", label: "Slack" },
  { app: "notion", label: "Notion" },
  { app: "github", label: "GitHub" },
  { app: "linear", label: "Linear" },
  { app: "trello", label: "Trello" },
  { app: "discord", label: "Discord" },
  { app: "stripe", label: "Stripe" }
];

const TEMPLATES = [
  { icon: "✍️", color: "#ec4899", nameKey: "agents.tpl_writer_name", descKey: "agents.tpl_writer_desc", instrKey: "agents.tpl_writer_instr" },
  { icon: "💻", color: "#6366f1", nameKey: "agents.tpl_dev_name", descKey: "agents.tpl_dev_desc", instrKey: "agents.tpl_dev_instr" },
  { icon: "📊", color: "#0891b2", nameKey: "agents.tpl_analyst_name", descKey: "agents.tpl_analyst_desc", instrKey: "agents.tpl_analyst_instr" },
  { icon: "🎯", color: "#f59e0b", nameKey: "agents.tpl_coach_name", descKey: "agents.tpl_coach_desc", instrKey: "agents.tpl_coach_instr" }
];

export default function AgentsPage() {
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Si ?chat=<agentId> → on affiche le chat de l'agent SANS quitter /agents
  const chatAgentId = searchParams.get("chat");
  if (chatAgentId) {
    return <ChatPage agentIdOverride={chatAgentId} onExitAgent={() => setSearchParams({})} />;
  }

  return <AgentsManager user={user} t={t} toast={toast} navigate={navigate} setSearchParams={setSearchParams} />;
}

function AgentsManager({ user, t, toast, navigate, setSearchParams }) {
  const [agents, setAgents] = useState([]);
  const [quota, setQuota] = useState({ limit: 0, used: 0, remaining: 0, canCreate: false });
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [editing, setEditing] = useState(null); // agent object or {} for new

  const load = () => {
    setLoading(true);
    api.listAgents()
      .then(({ agents, quota }) => { setAgents(agents || []); setQuota(quota || {}); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {});
    api.listIntegrations().then(({ integrations }) => setIntegrations(integrations || [])).catch(() => {});
  }, []);

  const startNew = (template) => {
    if (!quota.canCreate) {
      toast.error(quota.limit === 0 ? t("agents.need_paid") : t("agents.limit_reached", { used: quota.used, limit: quota.limit }));
      return;
    }
    if (template) {
      setEditing({
        icon: template.icon, color: template.color,
        name: t(template.nameKey), description: t(template.descKey),
        instructions: t(template.instrKey),
        capabilities: { webSearch: true, toolUse: true, fileGen: true, imageGen: false, memory: true },
        tools: [], knowledge: { keyFacts: [], context: "" }, starters: []
      });
    } else {
      setEditing({ icon: "🤖", color: "#6366f1", capabilities: { webSearch: true, toolUse: true, fileGen: true, imageGen: false, memory: true }, tools: [], knowledge: { keyFacts: [], context: "" }, starters: [] });
    }
  };

  const handleSaved = () => { setEditing(null); load(); };

  const remove = async (agent) => {
    if (!confirm(t("agents.confirm_delete", { name: agent.name }))) return;
    try {
      await api.deleteAgent(agent.id);
      toast.success(t("agents.deleted"));
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl shimmer" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-indigo-50/60 via-white to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* En-tête / présentation */}
        <div className="text-center mb-10 animate-fadeInUp">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-3xl shadow-lg animate-bounceIn">🤖</div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-delt-text tracking-tight">{t("agents.title")}</h1>
          <p className="mt-3 text-sm sm:text-base text-delt-muted max-w-xl mx-auto leading-relaxed">{t("agents.intro")}</p>

          {/* Capacités */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto stagger-children">
            {[
              { icon: "🧠", key: "agents.cap_persona" },
              { icon: "🔎", key: "agents.cap_search" },
              { icon: "🔌", key: "agents.cap_tools" },
              { icon: "📄", key: "agents.cap_files" }
            ].map((c) => (
              <div key={c.key} className="rounded-xl border border-delt-border bg-white p-3 text-center hover-lift">
                <div className="text-2xl">{c.icon}</div>
                <div className="text-[11px] font-semibold text-delt-text mt-1 leading-tight">{t(c.key)}</div>
              </div>
            ))}
          </div>

          {/* Quota */}
          <div className="mt-5 text-xs text-delt-muted">
            {quota.limit === 0
              ? t("agents.quota_free")
              : t("agents.quota", { used: quota.used, limit: quota.limit })}
            {quota.limit > 0 && !quota.canCreate && (
              <button onClick={() => navigate("/billing")} className="ml-2 text-indigo-600 font-semibold hover:underline">{t("agents.upgrade")}</button>
            )}
          </div>
        </div>

        {/* Liste vide → CTA */}
        {agents.length === 0 ? (
          <div className="text-center animate-fadeInUp">
            <button
              onClick={() => startNew()}
              disabled={!quota.canCreate}
              className="px-7 py-3.5 rounded-full text-base font-bold text-white shadow-xl hover:shadow-2xl hover:scale-[1.03] transition-all disabled:opacity-40 disabled:hover:scale-100 tap-shrink bg-gradient-animated"
              style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
            >
              {t("agents.create_first")}
            </button>
            {quota.limit === 0 && (
              <div className="mt-3">
                <button onClick={() => navigate("/billing")} className="text-sm text-indigo-600 font-semibold hover:underline">{t("agents.see_plans")}</button>
              </div>
            )}

            {/* Templates */}
            {quota.canCreate && (
              <>
                <div className="mt-10 mb-3 text-xs font-bold uppercase tracking-widest text-delt-muted">{t("agents.templates")}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
                  {TEMPLATES.map((tpl) => (
                    <button key={tpl.nameKey} onClick={() => startNew(tpl)} className="text-left rounded-2xl border border-delt-border bg-white p-4 hover-lift flex gap-3 items-start">
                      <span className="text-2xl flex-shrink-0">{tpl.icon}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-delt-text text-sm">{t(tpl.nameKey)}</div>
                        <div className="text-xs text-delt-muted mt-0.5 leading-snug">{t(tpl.descKey)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-delt-muted">{t("agents.your_agents")}</h2>
              <button
                onClick={() => startNew()}
                disabled={!quota.canCreate}
                className="px-4 py-2 rounded-full text-sm font-bold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-40 tap-shrink"
                style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
              >
                + {t("agents.new")}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
              {agents.map((a) => (
                <div key={a.id} className="rounded-2xl border border-delt-border bg-white p-4 hover-lift flex flex-col" style={{ borderColor: `${a.color}44` }}>
                  <div className="flex items-start gap-3">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${a.color}1a` }}>{a.icon || "🤖"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-delt-text truncate">{a.name}</div>
                      <div className="text-xs text-delt-muted line-clamp-2 mt-0.5 leading-snug">{a.description || t("agents.no_desc")}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {a.capabilities?.webSearch !== false && <Cap icon="🔎" />}
                    {a.capabilities?.toolUse !== false && a.tools?.length > 0 && <Cap icon="🔌" label={a.tools.length} />}
                    {a.capabilities?.fileGen !== false && <Cap icon="📄" />}
                    {a.capabilities?.imageGen === true && <Cap icon="🎨" />}
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-delt-border">
                    <button
                      onClick={() => setSearchParams({ chat: a.id })}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-bold text-white tap-shrink transition-opacity hover:opacity-90"
                      style={{ background: a.color }}
                    >
                      {t("agents.chat")}
                    </button>
                    <button onClick={() => setEditing(a)} className="px-3 py-2 rounded-lg text-sm font-semibold text-delt-text bg-delt-surface hover:bg-delt-panel tap-shrink">{t("agents.edit")}</button>
                    <button onClick={() => remove(a)} className="px-2.5 py-2 rounded-lg text-delt-muted hover:text-red-600 hover:bg-red-50 tap-shrink" aria-label={t("agents.delete")}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editing && (
        <AgentEditor
          agent={editing}
          catalog={catalog}
          integrations={integrations}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function Cap({ icon, label }) {
  return (
    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-delt-surface border border-delt-border text-delt-muted">
      {icon}{label ? ` ${label}` : ""}
    </span>
  );
}

// ─── Éditeur d'agent (création / édition) ────────────────────────────────────
function AgentEditor({ agent, catalog, integrations, onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const isNew = !agent.id;

  const [form, setForm] = useState({
    name: agent.name || "",
    description: agent.description || "",
    icon: agent.icon || "🤖",
    color: agent.color || "#6366f1",
    instructions: agent.instructions || "",
    defaultModel: agent.defaultModel || "",
    tools: agent.tools || [],
    capabilities: { webSearch: true, toolUse: true, fileGen: true, imageGen: false, memory: true, ...(agent.capabilities || {}) },
    knowledge: { keyFacts: agent.knowledge?.keyFacts || [], context: agent.knowledge?.context || "" },
    starters: agent.starters || []
  });
  const [saving, setSaving] = useState(false);
  const [factInput, setFactInput] = useState("");
  const [starterInput, setStarterInput] = useState("");

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setCap = (k, v) => setForm((f) => ({ ...f, capabilities: { ...f.capabilities, [k]: v } }));
  const toggleTool = (app) => setForm((f) => ({ ...f, tools: f.tools.includes(app) ? f.tools.filter((x) => x !== app) : [...f.tools, app] }));

  const flatModels = useMemo(() => {
    if (!catalog?.categories) return [];
    const out = [];
    for (const [tier, cat] of Object.entries(catalog.categories)) {
      for (const m of cat.models || []) out.push({ id: m.id, display: m.display, brand: m.brand, tier });
    }
    return out;
  }, [catalog]);

  const connectedApps = new Set(integrations.filter((i) => i.connected).map((i) => i.app));

  const save = async () => {
    if (!form.name.trim()) { toast.error(t("agents.name_required")); return; }
    setSaving(true);
    try {
      if (isNew) {
        await api.createAgent(form);
        toast.success(t("agents.created"));
      } else {
        await api.updateAgent(agent.id, form);
        toast.success(t("agents.saved"));
      }
      onSaved();
    } catch (e) {
      toast.error(e.data?.code === "agent_limit" ? e.message : (e.message || t("agents.save_error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdropFade">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-slideUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-delt-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-extrabold text-delt-text">{isNew ? t("agents.editor_new") : t("agents.editor_edit")}</h2>
          <button onClick={onClose} className="text-delt-muted hover:text-delt-text text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Identité */}
          <div className="flex gap-3 items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-1.5">{t("agents.icon")}</div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: `${form.color}1a` }}>{form.icon}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-1.5">{t("agents.name")}</div>
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder={t("agents.name_ph")}
                maxLength={80}
                className="w-full px-3 py-2 rounded-lg border border-delt-border outline-none focus:border-delt-accent text-sm"
              />
              <input
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder={t("agents.desc_ph")}
                maxLength={200}
                className="w-full mt-2 px-3 py-2 rounded-lg border border-delt-border outline-none focus:border-delt-accent text-sm"
              />
            </div>
          </div>

          {/* Icône + couleur */}
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((ic) => (
              <button key={ic} onClick={() => set({ icon: ic })} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all tap-shrink ${form.icon === ic ? "bg-delt-panel ring-2 ring-delt-accent" : "hover:bg-delt-surface"}`}>{ic}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => set({ color: c })} className={`w-7 h-7 rounded-full transition-transform tap-shrink ${form.color === c ? "ring-2 ring-offset-2 ring-delt-text scale-110" : ""}`} style={{ background: c }} />
            ))}
          </div>

          {/* Instructions */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-1.5">{t("agents.instructions")}</div>
            <p className="text-[11px] text-delt-muted mb-2">{t("agents.instructions_hint")}</p>
            <textarea
              value={form.instructions}
              onChange={(e) => set({ instructions: e.target.value })}
              placeholder={t("agents.instructions_ph")}
              rows={5}
              maxLength={8000}
              className="w-full px-3 py-2 rounded-lg border border-delt-border outline-none focus:border-delt-accent text-sm resize-y leading-relaxed"
            />
          </div>

          {/* Modèle */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-1.5">{t("agents.model")}</div>
            <select
              value={form.defaultModel}
              onChange={(e) => set({ defaultModel: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-delt-border outline-none focus:border-delt-accent text-sm bg-white"
            >
              <option value="">{t("agents.model_auto")}</option>
              {flatModels.map((m) => (
                <option key={m.id} value={m.id}>{m.brand} · {m.display} ({m.tier})</option>
              ))}
            </select>
          </div>

          {/* Capacités */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-2">{t("agents.capabilities")}</div>
            <div className="space-y-2">
              <CapToggle label={t("agents.cap_search_full")} desc={t("agents.cap_search_desc")} on={form.capabilities.webSearch} onChange={(v) => setCap("webSearch", v)} />
              <CapToggle label={t("agents.cap_files_full")} desc={t("agents.cap_files_desc")} on={form.capabilities.fileGen} onChange={(v) => setCap("fileGen", v)} />
              <CapToggle label={t("agents.cap_images_full")} desc={t("agents.cap_images_desc")} on={form.capabilities.imageGen} onChange={(v) => setCap("imageGen", v)} />
              <CapToggle label={t("agents.cap_memory_full")} desc={t("agents.cap_memory_desc")} on={form.capabilities.memory} onChange={(v) => setCap("memory", v)} />
              <CapToggle label={t("agents.cap_tools_full")} desc={t("agents.cap_tools_desc")} on={form.capabilities.toolUse} onChange={(v) => setCap("toolUse", v)} />
            </div>
          </div>

          {/* Outils (intégrations) */}
          {form.capabilities.toolUse && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-2">{t("agents.tools")}</div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_TOOLS.map((tool) => {
                  const on = form.tools.includes(tool.app);
                  const connected = connectedApps.has(tool.app);
                  return (
                    <button
                      key={tool.app}
                      onClick={() => toggleTool(tool.app)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all tap-shrink text-left ${on ? "border-delt-accent bg-indigo-50" : "border-delt-border hover:bg-delt-surface"}`}
                    >
                      <img src={`/brands/${tool.app}.svg`} alt="" className="w-4 h-4 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      <span className="flex-1 truncate font-medium text-delt-text">{tool.label}</span>
                      {!connected && <span className="text-[9px] text-amber-600" title={t("agents.not_connected")}>⚠</span>}
                      {on && <span className="text-delt-accent">✓</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-delt-muted mt-2">{t("agents.tools_hint")}</p>
            </div>
          )}

          {/* Connaissances */}
          {form.capabilities.memory && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-1.5">{t("agents.knowledge")}</div>
              <p className="text-[11px] text-delt-muted mb-2">{t("agents.knowledge_hint")}</p>
              <div className="flex gap-2 mb-2">
                <input
                  value={factInput}
                  onChange={(e) => setFactInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && factInput.trim()) { set({ knowledge: { ...form.knowledge, keyFacts: [...form.knowledge.keyFacts, factInput.trim()] } }); setFactInput(""); } }}
                  placeholder={t("agents.fact_ph")}
                  className="flex-1 px-3 py-2 rounded-lg border border-delt-border outline-none focus:border-delt-accent text-sm"
                />
                <button
                  onClick={() => { if (factInput.trim()) { set({ knowledge: { ...form.knowledge, keyFacts: [...form.knowledge.keyFacts, factInput.trim()] } }); setFactInput(""); } }}
                  className="px-3 py-2 rounded-lg bg-delt-surface hover:bg-delt-panel text-sm font-semibold tap-shrink"
                >+</button>
              </div>
              {form.knowledge.keyFacts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.knowledge.keyFacts.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-delt-surface border border-delt-border">
                      {f}
                      <button onClick={() => set({ knowledge: { ...form.knowledge, keyFacts: form.knowledge.keyFacts.filter((_, j) => j !== i) } })} className="text-delt-muted hover:text-red-600">✕</button>
                    </span>
                  ))}
                </div>
              )}
              <textarea
                value={form.knowledge.context}
                onChange={(e) => set({ knowledge: { ...form.knowledge, context: e.target.value } })}
                placeholder={t("agents.context_ph")}
                rows={3}
                maxLength={4000}
                className="w-full px-3 py-2 rounded-lg border border-delt-border outline-none focus:border-delt-accent text-sm resize-y"
              />

              {/* Fichiers de connaissances (RAG) */}
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-1.5">{t("agents.files")}</div>
                {isNew ? (
                  <p className="text-[11px] text-delt-muted italic">{t("agents.files_new_hint")}</p>
                ) : (
                  <KnowledgeFiles agentId={agent.id} />
                )}
              </div>
            </div>
          )}

          {/* Starters */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-delt-muted mb-1.5">{t("agents.starters")}</div>
            <p className="text-[11px] text-delt-muted mb-2">{t("agents.starters_hint")}</p>
            <div className="flex gap-2 mb-2">
              <input
                value={starterInput}
                onChange={(e) => setStarterInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && starterInput.trim() && form.starters.length < 6) { set({ starters: [...form.starters, starterInput.trim()] }); setStarterInput(""); } }}
                placeholder={t("agents.starter_ph")}
                className="flex-1 px-3 py-2 rounded-lg border border-delt-border outline-none focus:border-delt-accent text-sm"
              />
              <button
                onClick={() => { if (starterInput.trim() && form.starters.length < 6) { set({ starters: [...form.starters, starterInput.trim()] }); setStarterInput(""); } }}
                className="px-3 py-2 rounded-lg bg-delt-surface hover:bg-delt-panel text-sm font-semibold tap-shrink"
              >+</button>
            </div>
            {form.starters.length > 0 && (
              <div className="space-y-1.5">
                {form.starters.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-delt-surface border border-delt-border">
                    <span className="flex-1 truncate">{s}</span>
                    <button onClick={() => set({ starters: form.starters.filter((_, j) => j !== i) })} className="text-delt-muted hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-delt-border flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-semibold text-delt-muted hover:text-delt-text">{t("agents.cancel")}</button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-md hover:shadow-lg disabled:opacity-40 transition-all tap-shrink"
            style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
          >
            {saving ? t("agents.saving") : (isNew ? t("agents.create") : t("agents.save"))}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtMB(bytes) {
  const mb = (Number(bytes) || 0) / 1048576;
  return mb < 1 ? `${(mb * 1024).toFixed(0)} Ko` : `${mb.toFixed(1)} Mo`;
}

function KnowledgeFiles({ agentId }) {
  const t = useT();
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [quota, setQuota] = useState({ limitBytes: 0, usedBytes: 0, remainingBytes: 0 });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.listAgentFiles(agentId)
      .then(({ files, quota }) => { setFiles(files || []); setQuota(quota || {}); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [agentId]);

  const onPick = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of list) {
      setUploading(true);
      try {
        await api.uploadAgentFile(agentId, file);
        toast.success(t("agents.file_added", { name: file.name }));
        load();
      } catch (err) {
        toast.error(err.message);
      } finally {
        setUploading(false);
      }
    }
  };

  const remove = async (f) => {
    try {
      await api.deleteAgentFile(agentId, f.id);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const pct = quota.limitBytes > 0 ? Math.min(100, (quota.usedBytes / quota.limitBytes) * 100) : 0;

  return (
    <div>
      <p className="text-[11px] text-delt-muted mb-2">{t("agents.files_hint")}</p>

      {/* Barre de quota */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] text-delt-muted mb-1">
          <span>{fmtMB(quota.usedBytes)} / {fmtMB(quota.limitBytes)}</span>
          <span>{fmtMB(quota.remainingBytes)} {t("agents.files_left")}</span>
        </div>
        <div className="h-1.5 rounded-full bg-delt-border overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 90 ? "#ef4444" : "linear-gradient(90deg,#6366f1,#06b6d4)" }} />
        </div>
      </div>

      {loading ? (
        <div className="h-10 rounded-lg shimmer" />
      ) : (
        <>
          {files.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-delt-surface border border-delt-border">
                  <span className="flex-shrink-0">📄</span>
                  <span className="flex-1 truncate text-delt-text">{f.name}</span>
                  <span className="text-[10px] text-delt-muted flex-shrink-0">{fmtMB(f.sizeBytes)} · {f.chunkCount} chunks</span>
                  <button onClick={() => remove(f)} className="text-delt-muted hover:text-red-600 flex-shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-delt-border text-sm font-semibold cursor-pointer hover:bg-delt-surface transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.2-8.55"/></svg>
            ) : "＋"}
            {uploading ? t("agents.file_uploading") : t("agents.file_add")}
            <input type="file" multiple className="hidden" accept=".pdf,.txt,.md,.csv,.json,.html,.docx,.py,.js,.ts,.xml,.yaml,.yml" onChange={onPick} disabled={uploading} />
          </label>
        </>
      )}
    </div>
  );
}

function CapToggle({ label, desc, on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-delt-border hover:bg-delt-surface transition-colors text-left tap-shrink">
      <div className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${on ? "bg-delt-accent" : "bg-delt-border"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-delt-text">{label}</div>
        <div className="text-[11px] text-delt-muted leading-snug">{desc}</div>
      </div>
    </button>
  );
}
