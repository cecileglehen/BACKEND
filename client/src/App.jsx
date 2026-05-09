import { useEffect, useRef, useState, useCallback } from "react";
import Logo from "./components/Logo.jsx";
import QuotaBar from "./components/QuotaBar.jsx";
import AutoToggle from "./components/AutoToggle.jsx";
import ChatMessage from "./components/ChatMessage.jsx";
import Composer from "./components/Composer.jsx";
import ExpertModal from "./components/ExpertModal.jsx";
import ArtistStudio from "./components/ArtistStudio.jsx";
import CodeStudio from "./components/CodeStudio.jsx";
import Pricing from "./components/Pricing.jsx";
import ConversationList from "./components/ConversationList.jsx";
import AuthPage from "./components/AuthPage.jsx";
import FallbackToast from "./components/FallbackToast.jsx";
import AgeGateModal from "./components/AgeGateModal.jsx";
import ManualModelSelector from "./components/ManualModelSelector.jsx";
import { useHistory } from "./hooks/useHistory.js";
import { api, setToken, getToken } from "./lib/api.js";

const TAB_TO_PATH = { chat: "/", code: "/code", artist: "/studio", pricing: "/billing" };
const PATH_TO_TAB = { "/": "chat", "/code": "code", "/studio": "artist", "/billing": "pricing" };

function pathToTab(path) {
  return PATH_TO_TAB[path] ?? "chat";
}
function tabToPath(tab) {
  return TAB_TO_PATH[tab] ?? "/";
}

export default function App() {
  const [user, setUser] = useState(null);          // null = non connecté
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTabState] = useState(() => pathToTab(window.location.pathname));

  const setTab = useCallback((newTab) => {
    setTabState(newTab);
    const newPath = tabToPath(newTab);
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, "", newPath);
    }
  }, []);

  useEffect(() => {
    const onPop = () => setTabState(pathToTab(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [quota, setQuota] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [autoMode, setAutoMode] = useState(true);
  const [selectedManualModel, setSelectedManualModel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [routerInfo, setRouterInfo] = useState(null);
  const [expertOpen, setExpertOpen] = useState(false);
  const [expertCtx, setExpertCtx] = useState(null);
  const [error, setError] = useState(null);
  const [fallbackInfo, setFallbackInfo] = useState({ fellBack: false, from: null, tier: null });
  const [ageGateOpen, setAgeGateOpen] = useState(false);
  const [pendingVeniceSend, setPendingVeniceSend] = useState(null);
  const scrollRef = useRef(null);

  const { conversations, activeId, setActiveId, newConversation, saveMessages, deleteConversation, getMessages } =
    useHistory();

  // Tente de restaurer la session depuis le token local
  useEffect(() => {
    if (getToken()) {
      api.me()
        .then((u) => setUser(u))
        .catch(() => setToken(null))
        .finally(() => setAuthReady(true));
    } else {
      setAuthReady(true);
    }
  }, []);

  // Charge le quota quand l'utilisateur est connu
  const refreshQuota = useCallback(async () => {
    if (!user) return;
    try {
      const q = await api.quota();
      setQuota(q);
    } catch { /* silencieux */ }
  }, [user]);

  useEffect(() => { refreshQuota(); }, [refreshQuota]);

  useEffect(() => {
    if (!user) return;
    api.catalog()
      .then((data) => {
        setCatalog(data);
        const all = Object.entries(data.categories ?? {}).flatMap(([tier, category]) =>
          category.models.map((model) => ({ ...model, tier, cost: category.cost }))
        );
        setSelectedManualModel((current) =>
          current ?? all.find((model) => model.id === "openai/gpt-5.4") ?? all.find((model) => model.brand === "OpenAI") ?? all[0] ?? null
        );
      })
      .catch(() => {});
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Sync historique local
  useEffect(() => {
    if (activeId && messages.length > 0) saveMessages(activeId, messages);
  }, [messages]); // eslint-disable-line

  const stripForLLM = (list) => list.map(({ role, content }) => ({ role, content }));

  const handleAuth = (u) => setUser(u);
  const handleLogout = () => { setToken(null); setUser(null); setMessages([]); };

  const handleSelectConv = (id) => {
    setActiveId(id);
    setMessages(getMessages(id));
    setError(null);
    setInput("");
    setRouterInfo(null);
  };

  const handleNew = () => {
    newConversation();
    setMessages([]);
    setError(null);
    setInput("");
    setRouterInfo(null);
  };

  const handleDelete = (id) => {
    deleteConversation(id);
    if (id === activeId) setMessages([]);
  };

  // Envoi avec tier ou modèle précis
  const sendWithTier = async (tier, history, model = null) => {
    setBusy(true);
    setError(null);
    try {
      const resp = await api.chat({ messages: history, tier, modelId: model?.id, manual: !autoMode });
      if (resp.fellBack) {
        setFallbackInfo({ fellBack: true, from: resp.from, tier: resp.tier });
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: resp.content,
          tier: resp.tier,
          model: resp.model,
          tokensOut: resp.tokensOut
        }
      ]);
      await refreshQuota();
    } catch (e) {
      if (e.status === 403 && e.data?.error === "age_gate") {
        setPendingVeniceSend(() => () => sendWithTier(tier, history, model));
        setAgeGateOpen(true);
        setBusy(false);
        return;
      } else if (e.status === 429) {
        setError(e.message);
      } else {
        setError(e.message);
        setMessages((prev) => [...prev, { role: "assistant", content: "⚠ " + e.message, error: true }]);
      }
    } finally {
      setBusy(false);
      setRouterInfo(null);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setFallbackInfo({ fellBack: false, from: null, tier: null });

    let convId = activeId;
    if (!convId) convId = newConversation();

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    const history = stripForLLM(nextMessages);

    if (autoMode) {
      setBusy(true);
      setRouterInfo({ status: "routing" });
      try {
        const r = await api.route(text);
        setRouterInfo({ status: "done", ...r });
        if (r.tier === "EXPERT" && !r.fellBack) {
          setExpertCtx({ tier: r.tier, history });
          setExpertOpen(true);
          setBusy(false);
          return;
        }
        await sendWithTier(r.tier, history);
      } catch (e) {
        setError(e.message);
        setBusy(false);
        setRouterInfo(null);
      }
    } else {
      await sendWithTier(selectedManualModel?.tier ?? "NANO", history, selectedManualModel);
    }
  };

  const handleExpertChoice = async (choice) => {
    setExpertOpen(false);
    const history = expertCtx?.history ?? stripForLLM(messages);
    const tier = choice === "expert" ? "EXPERT" : "NORMAL";
    await sendWithTier(tier, history);
    setExpertCtx(null);
  };

  // En attente de vérif auth
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0,0.15,0.3].map((d) => (
            <span key={d} className="w-2 h-2 rounded-full bg-delt-accent animate-pulse" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // Non connecté → page auth
  if (!user) return <AuthPage onAuth={handleAuth} />;

  const TIER_LABELS = { EXPERT: "badge-expert", PRICE: "badge-price", NORMAL: "badge-normal", MINI: "badge-mini", NANO: "badge-eco", FREE: "", UNCENSORED: "badge-venice", VENICE: "badge-venice" };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Navbar */}
      <header className="flex-shrink-0 border-b border-delt-border bg-white sticky top-0 z-30">
        <div className="h-14 px-4 flex items-center justify-between gap-4">
          <Logo />

          <nav className="flex items-center gap-0.5">
            {[{ id: "chat", label: "Chat" }, { id: "code", label: "Code" }, { id: "artist", label: "Studio" }, { id: "pricing", label: "Tarifs" }].map(
              ({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    tab === id ? "bg-delt-panel text-delt-text" : "text-delt-muted hover:text-delt-text"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </nav>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: user.plan === "ULTRA" ? "#f59e0b" : user.plan === "PRO" ? "#0891b2" : user.plan === "PLUS" ? "#6366f1" : "#10b981" }}>
              {user.plan}
            </span>
            <span className="text-xs text-delt-muted hidden sm:block">{user.email}</span>
            <button onClick={handleLogout} className="btn-secondary text-xs py-1.5 px-3">Déconnexion</button>
          </div>
        </div>
      </header>

      {/* Body */}
      {tab === "pricing" ? (
        <div className="flex-1 overflow-y-auto">
          <Pricing user={user} onSubscribe={async (plan) => {
            try {
              const { approveUrl } = await api.subscribe(plan);
              window.location.href = approveUrl;
            } catch (e) { alert(e.message); }
          }} />
        </div>
      ) : tab === "artist" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <ArtistStudio />
        </div>
      ) : tab === "code" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <CodeStudio />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">

          {/* Historique */}
          <div className="w-56 flex-shrink-0 border-r border-delt-border flex flex-col bg-white">
            <div className="px-3 pt-3 pb-1 flex-shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-delt-muted">Historique</span>
            </div>
            <div className="flex-1 min-h-0">
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                onSelect={handleSelectConv}
                onNew={handleNew}
                onDelete={handleDelete}
              />
            </div>
          </div>

          {/* Chat */}
          <main className="flex-1 min-w-0 flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              {messages.length === 0 && <Welcome plan={user.plan} />}
              {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-delt-muted pl-10">
                  <span className="flex gap-1">
                    {[0, 0.2, 0.4].map((d) => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-delt-accent animate-pulse" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </span>
                  {routerInfo?.status === "routing" ? "Triage en cours…" : "Génération…"}
                </div>
              )}
            </div>

            <div className="divider" />

            <div className="p-4 bg-white">
              {error && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 cursor-pointer">✕</button>
                </div>
              )}
              <Composer
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={busy}
                hint={
                  autoMode
                    ? routerInfo?.status === "done"
                      ? `${routerInfo.tier} · ${routerInfo.model?.display ?? ""}`
                      : "Mode auto · Groq choisit le tier optimal"
                    : `Manuel · ${selectedManualModel?.brand ?? ""} ${selectedManualModel?.display ?? ""}`.trim()
                }
              />
            </div>
          </main>

          {/* Contrôles */}
          <aside className="w-64 flex-shrink-0 border-l border-delt-border flex flex-col gap-4 p-4 overflow-y-auto bg-white">
            <QuotaBar plan={user.plan} quota={quota?.quota} />

            <div className="card p-4">
              <AutoToggle on={autoMode} onChange={setAutoMode} />
            </div>

            {/* Sélecteur de modèle manuel */}
            {!autoMode && (
              <ManualModelSelector
                catalog={catalog}
                selectedId={selectedManualModel?.id}
                onSelect={setSelectedManualModel}
              />
            )}

            {/* Info routage auto */}
            {autoMode && routerInfo?.status === "done" && (
              <div className="card p-3.5">
                <div className="text-xs text-delt-muted mb-1 font-medium">Triage Groq</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-delt-text">Niveau {routerInfo.level}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TIER_LABELS[routerInfo.tier] ?? ""}`}>
                    {routerInfo.tier}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-delt-muted mt-1">{routerInfo.model?.display}</div>
              </div>
            )}

            <div className="card p-4 text-xs text-delt-muted">
              <div className="font-semibold text-delt-text mb-2 text-sm">Cascade fallback</div>
              <div className="space-y-1 font-mono">
                <div>EXPERT → PRICE → NORMAL → MINI → NANO</div>
              </div>
              <div className="mt-2">Si la capacité 5h est épuisée sur une catégorie, DELT bascule automatiquement vers une catégorie moins consommatrice.</div>
            </div>
          </aside>
        </div>
      )}

      <ExpertModal
        open={expertOpen}
        level={expertCtx?.tier === "EXPERT" ? 9 : 7}
        onChoice={handleExpertChoice}
        onClose={() => { setExpertOpen(false); setBusy(false); }}
      />

      <AgeGateModal
        open={ageGateOpen}
        onConfirm={() => {
          setAgeGateOpen(false);
          if (pendingVeniceSend) { pendingVeniceSend(); setPendingVeniceSend(null); }
        }}
        onClose={() => { setAgeGateOpen(false); setPendingVeniceSend(null); setBusy(false); }}
      />

      <FallbackToast
        key={fallbackInfo.tier + fallbackInfo.from}
        fellBack={fallbackInfo.fellBack}
        from={fallbackInfo.from}
        tier={fallbackInfo.tier}
      />
    </div>
  );
}

function Welcome({ plan }) {
  const planColor = plan === "ULTRA" ? "#f59e0b" : plan === "PRO" ? "#0891b2" : plan === "PLUS" ? "#6366f1" : "#10b981";
  return (
    <div className="h-full flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-delt-text flex items-center justify-center mb-5">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path d="M12 4L20 20H4Z" fill="white" />
          <circle cx="12" cy="15" r="2" fill="#6366f1" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-delt-text mb-2">Comment puis-je t'aider ?</h2>
      <p className="text-sm text-delt-muted mb-6 max-w-sm">
        Plan actif :{" "}
        <span className="font-bold" style={{ color: planColor }}>{plan}</span>. DELT choisit automatiquement le meilleur modèle selon la complexité de ta question et ta capacité disponible.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          { tier: "NANO",   ex: "Résume ce texte",    style: "badge-eco" },
          { tier: "MINI",   ex: "Écris un script",    style: "badge-mini" },
          { tier: "NORMAL", ex: "Conçois une API",    style: "badge-normal" },
          { tier: "PRICE",  ex: "Raisonnement avancé", style: "badge-price" },
          { tier: "EXPERT", ex: "Analyse complexe",   style: "badge-expert" }
        ].map(({ tier, ex, style }) => (
          <div key={tier} className="card px-3 py-2 text-left">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${style} block mb-1`}>{tier}</span>
            <span className="text-delt-muted">{ex}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
