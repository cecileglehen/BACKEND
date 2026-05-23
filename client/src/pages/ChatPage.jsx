import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { useChatStream } from "../hooks/useChatStream.js";
import { useHistory } from "../hooks/useHistory.js";
import { useProjects } from "../hooks/useProjects.js";
import { useAnimatedMount } from "../hooks/useAnimatedMount.js";
import ChatMessage from "../components/ChatMessage.jsx";
import Composer from "../components/Composer.jsx";
import ExpertModal from "../components/ExpertModal.jsx";
import ConversationList from "../components/ConversationList.jsx";
import FallbackToast from "../components/FallbackToast.jsx";
import AgeGateModal from "../components/AgeGateModal.jsx";
import WelcomeScreen from "../components/WelcomeScreen.jsx";
import ParallelPicker from "../components/ParallelPicker.jsx";
import DebateSetup from "../components/DebateSetup.jsx";
import BrandPills from "../components/BrandPills.jsx";
import ProjectsSidebar from "../components/ProjectsSidebar.jsx";
import ProjectSettingsModal from "../components/ProjectSettingsModal.jsx";
import ManualModelSelector from "../components/ManualModelSelector.jsx";
import ArtifactViewer from "../components/ArtifactViewer.jsx";

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

const DEEP_STEPS = [
  "Génération des requêtes",
  "Recherche web",
  "Lecture des sources",
  "Embedding & global ranking",
  "Dédoublonnage par clustering",
  "Re-ranking LLM",
  "Extraction des faits",
  "Multi-hop reasoning",
  "Croisement des sources",
  "Scoring des sources",
  "Synthèse pondérée"
];

function initialDeepSteps() {
  return DEEP_STEPS.map((label, index) => ({ label, status: index === 0 ? "running" : "pending" }));
}

function isBrandFamily(model) {
  return Boolean(model?.isBrandFamily || String(model?.id || "").startsWith("brand:"));
}

export default function ChatPage() {
  const { user, refreshQuota, setCredits } = useAuth();
  const toast = useToast();
  const isFree = user?.plan === "FREE";
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Catalog & sélection modèle ──────────────────────────────────────────
  const [catalog, setCatalog] = useState(null);
  const [selectedManualModel, setSelectedManualModel] = useState(null);
  const [autoMode, setAutoMode] = useState(true);
  const effectiveAutoMode = isFree ? false : autoMode;

  useEffect(() => {
    if (!user) return;
    api.catalog().then((data) => {
      setCatalog(data);
      setSelectedManualModel((current) => current ?? null);
    }).catch(() => {});
  }, [user]);

  // ── Conversations / Projets ────────────────────────────────────────────
  const { conversations, activeId, setActiveId, newConversation, saveMessages, deleteConversation, getMessages } = useHistory();
  const { projects, create: createProject, refresh: refreshProjects } = useProjects();
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const visibleConversations = activeProjectId
    ? conversations.filter((c) => c.projectId === activeProjectId)
    : conversations;

  // ── Chat streaming hook ────────────────────────────────────────────────
  const [ageGateOpen, setAgeGateOpen] = useState(false);
  const [pendingVeniceSend, setPendingVeniceSend] = useState(null);
  const [expertOpen, setExpertOpen] = useState(false);
  const [expertCtx, setExpertCtx] = useState(null);
  const [fallbackInfo] = useState({ fellBack: false, from: null, tier: null });

  const onCreditsUsed = (cost) => {
    if (cost) setCredits((c) => Math.max(0, (Number(c) || 0) - (Number(cost) || 0)));
    else refreshQuota();
  };

  const chat = useChatStream({
    projectId: activeProjectId,
    onCreditsUsed,
    onAgeGate: (resume) => {
      setPendingVeniceSend(() => resume);
      setAgeGateOpen(true);
    }
  });

  // ── Composer state ─────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [parallelModels, setParallelModels] = useState([]);
  const [parallelPickerOpen, setParallelPickerOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [debateAgents, setDebateAgents] = useState(null);
  const [debateSetupOpen, setDebateSetupOpen] = useState(false);
  const [openArtifact, setOpenArtifact] = useState(null);
  const [deepMode, setDeepMode] = useState(false);

  const sidebarAnim = useAnimatedMount(historyOpen, 450);
  const projectsAnim = useAnimatedMount(projectsOpen, 450);
  const scrollRef = useRef(null);
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // ── URL sync : ?c=<convId> ──────────────────────────────────────────────
  // 1) Au mount, si l'URL contient ?c=, ouvrir cette conv (refresh-safe)
  useEffect(() => {
    const urlConvId = searchParams.get("c");
    if (urlConvId && urlConvId !== activeId) {
      handleSelectConv(urlConvId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Quand activeId change, refléter dans l'URL
  useEffect(() => {
    const urlConvId = searchParams.get("c");
    if (activeId && urlConvId !== activeId) {
      setSearchParams({ c: activeId }, { replace: true });
    } else if (!activeId && urlConvId) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.busy]);

  useEffect(() => {
    if (activeId && chat.messages.length > 0) {
      saveMessages(activeId, chat.messages, activeProjectId ?? undefined);
    }
  }, [chat.messages, activeProjectId]); // eslint-disable-line

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSelectConv = async (id) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv?.projectId !== undefined) setActiveProjectId(conv.projectId || null);
    setActiveId(id);
    const { initial, fresh } = getMessages(id);
    chat.setMessages(initial);
    chat.setError(null);
    setInput("");
    chat.setRouterInfo(null);

    // Hot-swap quand la version serveur arrive (cross-browser sync).
    // On vérifie que l'utilisateur est toujours sur la même conv pour ne pas
    // écraser une autre conv ouverte entre-temps.
    fresh.then((serverMessages) => {
      if (!serverMessages) return;
      if (id !== activeIdRef.current) return;
      chat.setMessages(serverMessages);
    });
  };

  const handleSelectProject = (id) => {
    setActiveProjectId(id);
    setActiveId(null);
    chat.reset();
    setInput("");
    setAttachments([]);
    setProjectsOpen(false);
    setHistoryOpen(false);
  };

  const handleNew = () => {
    newConversation();
    chat.reset();
    setInput("");
  };

  const handleDelete = (id) => {
    deleteConversation(id);
    if (id === activeId) chat.setMessages([]);
  };

  const handleSelectBrand = (model) => {
    setSelectedManualModel(model);
    setAutoMode(isBrandFamily(model));
  };

  const toggleDebate = () => {
    if (debateAgents) {
      setDebateAgents(null);
      setDebateSetupOpen(false);
      return;
    }
    setDebateSetupOpen(true);
  };

  const isImageModel = !!(selectedManualModel && catalog?.creative?.IMAGE?.models?.some((m) => m.id === selectedManualModel.id));
  const isVideoModel = !!(selectedManualModel && catalog?.creative?.VIDEO?.models?.some((m) => m.id === selectedManualModel.id));

  const buildDebateTurns = (config) => {
    const agents = Array.isArray(config) ? config : (config?.agents || []);
    if (config?.mode !== "iterative") {
      return agents.map((a) => ({ ...a, content: "", streaming: false }));
    }
    const count = Math.max(4, Math.min(12, Number(config?.rounds) || 10));
    const plan = Array.from({ length: count }, (_, index) => {
      const base = agents[index % agents.length];
      let role = "critique";
      if (index === 0) role = "propose";
      else if (index === count - 1) role = "synthesize";
      else if (index % 3 === 2) role = "optimize";
      return { ...base, role };
    });
    return plan.map((a) => ({ ...a, content: "", streaming: false }));
  };

  // Lance un débat multi-agent
  const runDebate = (question, _history, config) => {
    const agents = Array.isArray(config) ? config : (config?.agents || []);
    const debateId = `debate-${Date.now()}-${Math.random()}`;
    const initial = buildDebateTurns(config);
    chat.setMessages((prev) => [...prev, {
      role: "assistant",
      _debateId: debateId,
      debate: { agents: initial, done: false }
    }]);

    api.debateStream({
      question,
      agents: agents.map((a) => ({ role: a.role, modelId: a.modelId, tier: a.tier || a.model?.tier })),
      debateMode: config?.mode,
      rounds: config?.rounds,
      onAgentStart: (info) => {
        chat.setMessages((prev) => prev.map((m) => {
          if (m._debateId !== debateId || !m.debate) return m;
          const ag = [...m.debate.agents];
          ag[info.index] = { ...(ag[info.index] || { content: "" }), model: info.model, role: info.role, streaming: true };
          return { ...m, debate: { ...m.debate, agents: ag } };
        }));
      },
      onAgentDelta: ({ index, delta }) => {
        chat.setMessages((prev) => prev.map((m) => {
          if (m._debateId !== debateId || !m.debate) return m;
          const ag = [...m.debate.agents];
          ag[index] = { ...(ag[index] || { content: "" }), content: ((ag[index]?.content) || "") + delta, thinking: false };
          return { ...m, debate: { ...m.debate, agents: ag } };
        }));
      },
      onAgentThinking: ({ index, delta }) => {
        chat.setMessages((prev) => prev.map((m) => {
          if (m._debateId !== debateId || !m.debate) return m;
          const ag = [...m.debate.agents];
          ag[index] = { ...(ag[index] || { content: "" }), reasoning: ((ag[index]?.reasoning) || "") + delta, thinking: true };
          return { ...m, debate: { ...m.debate, agents: ag } };
        }));
      },
      onAgentDone: ({ index, creditCost }) => {
        chat.setMessages((prev) => prev.map((m) => {
          if (m._debateId !== debateId || !m.debate) return m;
          const ag = [...m.debate.agents];
          ag[index] = { ...(ag[index] || { content: "" }), streaming: false, thinking: false };
          return { ...m, debate: { ...m.debate, agents: ag } };
        }));
        if (Number.isFinite(Number(creditCost))) refreshQuota?.();
      },
      onAgentError: ({ index, error }) => {
        chat.setMessages((prev) => prev.map((m) => {
          if (m._debateId !== debateId || !m.debate) return m;
          const ag = [...m.debate.agents];
          ag[index] = {
            ...(ag[index] || { content: "" }),
            content: `⚠ ${error || "Erreur agent"}`,
            error: true,
            streaming: false
          };
          return { ...m, debate: { ...m.debate, agents: ag } };
        }));
      },
      onDebateDone: () => {
        chat.setMessages((prev) => prev.map((m) =>
          m._debateId === debateId && m.debate ? { ...m, debate: { ...m.debate, done: true } } : m
        ));
        // Reset débat pour ne pas relancer au prochain envoi
        setDebateAgents(null);
      },
      onError: (e) => {
        chat.setMessages((prev) => prev.map((m) => {
          if (m._debateId !== debateId || !m.debate) return m;
          return { ...m, debate: { ...m.debate, done: true, error: e.message } };
        }));
        setDebateAgents(null);
      }
    });
  };

  const runDeepSearch = async (question) => {
    const deepId = `deep-${Date.now()}-${Math.random()}`;
    chat.setBusy(true);
    chat.setError(null);
    chat.setMessages((prev) => [...prev, {
      role: "assistant",
      _deepId: deepId,
      content: "",
      streaming: true,
      deepSearch: {
        title: "DELT Deep Search Beta",
        steps: initialDeepSteps(),
        sources: []
      }
    }]);

    const updateDeep = (patch) => {
      chat.setMessages((prev) => prev.map((m) => {
        if (m._deepId !== deepId || !m.deepSearch) return m;
        return { ...m, deepSearch: { ...m.deepSearch, ...patch(m.deepSearch) } };
      }));
    };

    await new Promise((resolve) => {
      api.deepSearch({
        prompt: question,
        maxSources: 10,
        language: "fr",
        onInit: ({ stages }) => {
          updateDeep(() => ({
            steps: stages.map((label) => ({ label, status: "pending" }))
          }));
        },
        onStep: ({ label, status, ...extra }) => {
          updateDeep((cur) => ({
            steps: (cur.steps || []).map((s) => s.label === label ? { ...s, status, ...extra } : s)
          }));
        },
        onSources: ({ sources }) => {
          updateDeep(() => ({ sources: sources || [] }));
        },
        onDone: (result) => {
          chat.setMessages((prev) => prev.map((m) => {
            if (m._deepId !== deepId || !m.deepSearch) return m;
            return {
              ...m,
              content: result.answer || "",
              streaming: false,
              tokensOut: result.tokensOut,
              model: { display: "DELT Deep Search", brand: "Perplexity" },
              deepSearch: {
                ...m.deepSearch,
                steps: Array.isArray(result.steps) ? result.steps : DEEP_STEPS.map((label) => ({ label, status: "done" })),
                sources: result.sources || m.deepSearch.sources || [],
                creditCost: result.creditCost
              }
            };
          }));
          refreshQuota?.();
          resolve();
        },
        onError: (e) => {
          chat.setError(e.message);
          toast.error(e.message);
          chat.setMessages((prev) => prev.map((m) => {
            if (m._deepId !== deepId || !m.deepSearch) return m;
            return { ...m, content: "⚠ " + e.message, error: true, streaming: false };
          }));
          resolve();
        }
      });
    });

    chat.setBusy(false);
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || chat.busy) return;
    setInput("");
    const currentAttachments = attachments;
    setAttachments([]);

    let convId = activeId;
    if (!convId) convId = newConversation();

    const userMessage = { role: "user", content: text };
    if (currentAttachments.length > 0) userMessage.attachments = currentAttachments;

    const nextMessages = [...chat.messages, userMessage];
    chat.setMessages(nextMessages);
    saveMessages(convId, nextMessages, activeProjectId ?? undefined);
    const history = chat.stripForLLM(nextMessages);

    if (deepMode) {
      await runDeepSearch(text);
      return;
    }
    if ((Array.isArray(debateAgents) ? debateAgents.length : debateAgents?.agents?.length) >= 2) {
      runDebate(text, history, debateAgents);
      return;
    }
    if (parallelModels.length >= 2) {
      chat.sendParallel(history, parallelModels);
      return;
    }
    if (isImageModel) { await chat.generateImage(text, selectedManualModel); return; }
    if (isVideoModel) { await chat.generateVideo(text, selectedManualModel); return; }

    if (effectiveAutoMode) {
      chat.setRouterInfo({ status: "routing" });
      try {
        const r = await api.route(text);
        chat.setRouterInfo({ status: "done", ...r });
        if (r.tier === "EXPERT" && !r.fellBack) {
          setExpertCtx({ tier: r.tier, history });
          setExpertOpen(true);
          return;
        }
        chat.sendWithTier(r.tier, history, isBrandFamily(selectedManualModel) ? selectedManualModel : null);
      } catch (e) {
        chat.setError(e.message);
        toast.error(e.message);
        chat.setRouterInfo(null);
      }
    } else {
      chat.sendWithTier(selectedManualModel?.tier ?? "NANO", history, selectedManualModel);
    }
  };

  const allChatModels = catalog
    ? Array.from(Object.entries(catalog.categories ?? {}).reduce((map, [, cat]) => {
        for (const m of cat.models || []) {
          if (m.adult || map.has(m.brand)) continue;
          map.set(m.brand, {
            id: `brand:${encodeURIComponent(m.brand)}`,
            brand: m.brand,
            display: { OpenAI: "GPT", Anthropic: "Claude", Google: "Gemini", Meta: "Llama", xAI: "Grok", InclusionAI: "Inclusion" }[m.brand] || m.brand,
            tier: "NORMAL",
            isBrandFamily: true
          });
        }
        return map;
      }, new Map()).values())
    : [];

  const handleExpertChoice = async (choice) => {
    setExpertOpen(false);
    const history = expertCtx?.history ?? chat.stripForLLM(chat.messages);
    const tier = choice === "expert" ? "EXPERT" : "NORMAL";
    chat.sendWithTier(tier, history, isBrandFamily(selectedManualModel) ? selectedManualModel : null);
    setExpertCtx(null);
  };

  // ── Header tools (boutons projets/historique/new) ──────────────────────
  const HeaderTools = ({ inline = false }) => (
    <div className={inline
      ? "px-3 py-2 flex items-center gap-1.5 overflow-x-auto"
      : "absolute top-2 left-2 sm:top-3 sm:left-3 z-10 flex items-center gap-1.5"}>
      <button
        onClick={() => setProjectsOpen(true)}
        className={`h-9 px-3 rounded-full flex items-center gap-1.5 text-delt-muted text-sm font-semibold flex-shrink-0 transition-colors ${
          inline ? "border border-delt-border hover:bg-delt-surface" : "bg-white/95 border border-delt-border hover:bg-delt-surface"
        }`}
      >
        <span className="text-base">{activeProject?.icon || "📁"}</span>
        <span className="max-w-[8rem] truncate">{activeProject?.name || "Projets"}</span>
      </button>
      {inline && activeProject && (
        <button
          onClick={() => setEditingProject(activeProject)}
          className="h-9 px-3 rounded-full text-sm font-semibold flex items-center gap-1.5 flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ background: `${activeProject.color}15`, color: activeProject.color }}
          title="Modifier le projet"
        >
          <span>{activeProject.icon || "📁"}</span>
          <span className="max-w-[9rem] truncate">{activeProject.name}</span>
        </button>
      )}
      <button
        onClick={() => setHistoryOpen(true)}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-delt-muted flex-shrink-0 transition-colors ${
          inline ? "hover:bg-delt-surface" : "bg-white/95 border border-delt-border hover:bg-delt-surface"
        }`}
        aria-label="Historique"
      >
        <HamburgerIcon />
      </button>
      {inline && (
        <button
          onClick={handleNew}
          className="w-9 h-9 rounded-full hover:bg-delt-surface flex items-center justify-center text-delt-muted flex-shrink-0 transition-colors"
          aria-label="Nouvelle conversation"
        >
          <PencilIcon />
        </button>
      )}
    </div>
  );

  if (!user) return null;

  return (
    <div className="flex-1 min-h-0 flex relative">
      {/* Sidebar historique */}
      {sidebarAnim.mounted && (
        <>
          <div
            onClick={() => setHistoryOpen(false)}
            className={`absolute inset-0 bg-black/10 z-20 ${sidebarAnim.closing ? "animate-backdropFadeOut" : "animate-backdropFade"}`}
          />
          <div className={`absolute left-0 top-0 bottom-0 w-[min(18rem,86vw)] bg-white border-r border-delt-border z-30 flex flex-col shadow-lg ${sidebarAnim.closing ? "animate-slideOutLeft" : "animate-slideInLeft"}`}>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-delt-muted">Historique</span>
              <button onClick={() => setHistoryOpen(false)} className="text-delt-muted hover:text-delt-text text-lg leading-none">✕</button>
            </div>
            <div className="flex-1 min-h-0">
              <ConversationList
                conversations={visibleConversations}
                activeId={activeId}
                onSelect={(id) => { handleSelectConv(id); setHistoryOpen(false); }}
                onNew={() => { handleNew(); setHistoryOpen(false); }}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </>
      )}

      {/* Sidebar projets */}
      {projectsAnim.mounted && (
        <>
          <div
            onClick={() => setProjectsOpen(false)}
            className={`absolute inset-0 bg-black/10 z-20 ${projectsAnim.closing ? "animate-backdropFadeOut" : "animate-backdropFade"}`}
          />
          <div className={`absolute left-0 top-0 bottom-0 w-[min(20rem,88vw)] bg-white border-r border-delt-border z-30 flex flex-col shadow-lg ${projectsAnim.closing ? "animate-slideOutLeft" : "animate-slideInLeft"}`}>
            <ProjectsSidebar
              projects={projects}
              activeProjectId={activeProjectId}
              onSelect={handleSelectProject}
              onCreate={async (data) => {
                const project = await createProject(data);
                handleSelectProject(project.id);
              }}
              onEdit={(project) => setEditingProject(project)}
              onClose={() => setProjectsOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main */}
      <main className={`flex-1 min-w-0 flex flex-col ${openArtifact ? "hidden lg:flex lg:max-w-[50%]" : ""}`}>
        {chat.messages.length === 0 ? (
          <>
            <HeaderTools />
            {activeProject && (
              <div className="absolute top-12 left-2 right-2 sm:top-14 sm:left-3 sm:right-3 z-10 pointer-events-none">
                <div
                  className="max-w-3xl mx-auto rounded-2xl border bg-white/95 px-3 py-2 shadow-sm flex items-center justify-between gap-3 pointer-events-auto"
                  style={{ borderColor: `${activeProject.color}55` }}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-delt-muted">Chat projet</div>
                    <div className="text-sm font-extrabold truncate" style={{ color: activeProject.color }}>
                      {activeProject.icon || "📁"} {activeProject.name}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingProject(activeProject)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-opacity hover:opacity-80"
                    style={{ background: `${activeProject.color}15`, color: activeProject.color }}
                  >
                    Réglages
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <WelcomeScreen />
            </div>
            <div className="flex-shrink-0 px-2 sm:px-4 pt-2 bg-white safe-pb">
              <div className="max-w-3xl mx-auto">
                <ErrorBanner error={chat.error} onClose={() => chat.setError(null)} />
                <Composer
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  onStop={chat.stop}
                  disabled={chat.busy}
                  autoMode={effectiveAutoMode}
                  manualLabel={selectedManualModel?.display}
                  manualModel={selectedManualModel}
                  showAuto={true}
                  onOpenModels={() => setModelsOpen(true)}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  parallelModels={parallelModels}
                  onOpenParallel={() => setParallelPickerOpen(true)}
                  debateActive={Boolean(debateAgents)}
                  onOpenDebate={toggleDebate}
                  deepActive={deepMode}
                  onToggleDeep={() => setDeepMode((v) => !v)}
                />
                <div className="mt-2 hidden sm:block">
                  <BrandPills
                    catalog={catalog}
                    selectedId={selectedManualModel?.id}
                    onSelect={handleSelectBrand}
                    plan={user.plan}
                    showCreative={false}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <HeaderTools inline />
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-2 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-5">
                {chat.messages.map((m, i) => (
                  <ChatMessage
                    key={i}
                    msg={m}
                    models={allChatModels}
                    onRemake={m.role === "assistant" ? (model) => chat.remake(i, model) : undefined}
                    onChooseVariant={(variantIndex) => chat.chooseVariant(i, variantIndex)}
                    onMerge={m.role === "assistant" && m.variants ? () => chat.mergeVariants(i) : undefined}
                    onOpenArtifact={setOpenArtifact}
                  />
                ))}
                {chat.busy && (
                  <div className="flex items-center gap-2 text-sm text-delt-muted pl-10">
                    <span className="flex gap-1">
                      {[0, 0.2, 0.4].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-delt-accent animate-pulse" style={{ animationDelay: `${d}s` }} />
                      ))}
                    </span>
                    {chat.routerInfo?.status === "routing" ? "Triage en cours…" : "Génération…"}
                  </div>
                )}
              </div>
            </div>
            <div className="px-2 sm:px-4 pt-2 bg-white safe-pb">
              <div className="max-w-3xl mx-auto">
                <ErrorBanner error={chat.error} onClose={() => chat.setError(null)} />
                <Composer
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  onStop={chat.stop}
                  disabled={chat.busy}
                  autoMode={effectiveAutoMode}
                  manualLabel={selectedManualModel?.display}
                  manualModel={selectedManualModel}
                  showAuto={true}
                  onOpenModels={() => setModelsOpen(true)}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  parallelModels={parallelModels}
                  onOpenParallel={() => setParallelPickerOpen(true)}
                  debateActive={Boolean(debateAgents)}
                  onOpenDebate={toggleDebate}
                  deepActive={deepMode}
                  onToggleDeep={() => setDeepMode((v) => !v)}
                />
                <div className="mt-2 hidden sm:block">
                  <BrandPills
                    catalog={catalog}
                    selectedId={selectedManualModel?.id}
                    onSelect={handleSelectBrand}
                    plan={user.plan}
                    showCreative={false}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Artifact viewer (split view : chat + panel) */}
      {openArtifact && (
        <ArtifactViewer artifact={openArtifact} onClose={() => setOpenArtifact(null)} />
      )}

      {/* Modale débat */}
      {debateSetupOpen && (
        <DebateSetup
          catalog={catalog}
          onClose={() => setDebateSetupOpen(false)}
          onStart={(agents) => {
            setDebateAgents(agents);
            setDebateSetupOpen(false);
          }}
        />
      )}

      {/* Modale parallel */}
      {parallelPickerOpen && (
        <ParallelPicker
          catalog={catalog}
          selected={parallelModels}
          onChange={setParallelModels}
          onClose={() => setParallelPickerOpen(false)}
        />
      )}

      {/* Modale choix modèle (bouton Auto) */}
      {modelsOpen && (
        <div
          onClick={() => setModelsOpen(false)}
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdropFade"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp"
          >
            <div className="px-5 py-4 border-b border-delt-border flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-delt-text tracking-tight">Choix du modèle</h2>
                <p className="text-xs text-delt-muted">Auto · ou force une marque</p>
              </div>
              <button onClick={() => setModelsOpen(false)} className="text-delt-muted hover:text-delt-text text-2xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ManualModelSelector
                catalog={catalog}
                selectedId={selectedManualModel?.id}
                plan={user?.plan}
                onSelect={(m) => {
                  if (!m) {
                    setSelectedManualModel(null);
                    setAutoMode(true);
                  } else {
                    setSelectedManualModel(m);
                    setAutoMode(false);
                  }
                  setModelsOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {editingProject && (
        <ProjectSettingsModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onUpdated={async () => { await refreshProjects(); setEditingProject(null); }}
          onDeleted={async () => {
            if (activeProjectId === editingProject.id) setActiveProjectId(null);
            await refreshProjects();
            setEditingProject(null);
          }}
        />
      )}

      <ExpertModal
        open={expertOpen}
        level={expertCtx?.tier === "EXPERT" ? 9 : 7}
        onChoice={handleExpertChoice}
        onClose={() => { setExpertOpen(false); }}
      />

      <AgeGateModal
        open={ageGateOpen}
        onConfirm={() => {
          setAgeGateOpen(false);
          if (pendingVeniceSend) { pendingVeniceSend(); setPendingVeniceSend(null); }
        }}
        onClose={() => { setAgeGateOpen(false); setPendingVeniceSend(null); }}
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

function ErrorBanner({ error, onClose }) {
  if (!error) return null;
  return (
    <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex justify-between items-start gap-2 animate-slideUp">
      <span className="flex-1">{error}</span>
      <button onClick={onClose} className="text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0">✕</button>
    </div>
  );
}
