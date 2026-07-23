import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { api } from "../lib/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { bootWebContainer, filesToTree, isIsolated, pipeOutput, readDirFlat, b64ToBytes, injectVisual, ensureVisualScript } from "../lib/launchRuntime.js";
import MessageRenderer from "../components/MessageRenderer.jsx";

// ─── Profils Launch : 5 « niveaux » nommés (couleur + icône SVG, sans marques) ──
// Chaque profil regroupe 1+ modèles de même niveau ; le routeur (resolveModel)
// choisit le modèle concret à envoyer. Les noms d'origine n'apparaissent plus.
const LAUNCH_PROFILES = [
  { id: "prototype",   name: "Prototype",   color: "#8b5cf6", tagline: "Éco & ultra rapide — pour itérer",
    path: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
    models: ["openai/gpt-5.6-luna", "openai/gpt-5.4-nano", "anthropic/claude-haiku-4.5"] },
  { id: "design-mini", name: "Design mini", color: "#ec4899", tagline: "UI rapide & jolie",
    path: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
    models: ["openai/gpt-5.4-mini"] },
  { id: "design-pro",  name: "Design pro",  color: "#06b6d4", tagline: "UI soignée, haut de gamme",
    path: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    models: ["anthropic/claude-sonnet-5", "google/gemini-3.6-flash"] },
  { id: "builder",     name: "Builder",     color: "#6366f1", tagline: "Équilibré — le meilleur défaut",
    path: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    models: ["moonshotai/kimi-k3", "z-ai/glm-5.2", "openai/gpt-5.4", "openai/gpt-5.3-codex"] },
  { id: "production",  name: "Production",  color: "#f59e0b", tagline: "Qualité maximale",
    path: "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
    models: ["openai/gpt-5.5", "anthropic/claude-opus-4.8", "anthropic/claude-fable-5", "openai/gpt-5.5-pro", "openai/gpt-5.4-pro"] }
];
const DEFAULT_PROFILE = "builder";

// « Routeur » : un profil → un id de modèle réel (modèle d'ancrage du niveau).
// Le fallback inter-modèles du même tier est géré côté serveur.
function resolveModel(profileId) {
  const p = LAUNCH_PROFILES.find((x) => x.id === profileId);
  return p ? p.models[0] : profileId;
}

// Modèles d'image proposés dans Launch — plafonné à « Nano Banana 2 » (pas Pro/GPT Image/GPT Image 2).
const LAUNCH_IMAGE_IDS = [
  "fal-ai/fast-sdxl",
  "google/gemini-3.1-flash-lite-image",
  "google/gemini-2.5-flash-image",
  "openai/gpt-5-image-mini",
  "google/gemini-3.1-flash-image-preview"
];
const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";

const EXAMPLES = [
  "Une todo app React avec catégories, filtres et persistance localStorage.",
  "Un dashboard analytics avec cards de stats et un graphique en barres animé.",
  "Une landing page SaaS moderne : hero, features, pricing, FAQ.",
  "Un mini jeu Memory (cartes à retourner) avec score et timer."
];

const LANG = {
  js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  json: "json", html: "html", css: "css", md: "markdown"
};
function langOf(path) {
  const ext = (path.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  return LANG[ext] || "plaintext";
}

export default function LaunchIDE() {
  const [phase, setPhase] = useState("empty");          // empty | working
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_PROFILE);  // id de profil Launch (résolu par resolveModel)
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL); // modèle de génération d'images
  const [imageModels, setImageModels] = useState([]);   // catalogue d'images plafonné (≤ Nano Banana 2)
  const [attachments, setAttachments] = useState([]);   // pièces jointes du prompt (@refs)
  const [mention, setMention] = useState({ open: false, target: "prompt" }); // popup @
  const [session, setSession] = useState(null);
  const [files, setFiles] = useState([]);               // [{ path, content }]
  const [selected, setSelected] = useState(null);
  const [chat, setChat] = useState([]);                 // [{ role, text }]
  const [editPrompt, setEditPrompt] = useState("");
  const [composerMode, setComposerMode] = useState("code"); // "code" | "plan"
  const [mobileShow, setMobileShow] = useState("chat");      // mobile : "chat" | "main"
  const [showPreview, setShowPreview] = useState(false);     // false = chat plein écran (façon Lovable)
  const [chatWidth, setChatWidth] = useState(360);           // largeur du panneau chat (redimensionnable)
  const [isWide, setIsWide] = useState(false);               // écran ≥ lg (diviseur draggable)
  const gridRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [wcStatus, setWcStatus] = useState("idle");     // idle|booting|installing|running|ready|error
  const [previewUrl, setPreviewUrl] = useState("");
  const [terminal, setTerminal] = useState([]);
  const [tab, setTab] = useState("preview");            // preview | code
  const [showTerminal, setShowTerminal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState("");
  const [payReady, setPayReady] = useState(null);       // { connected, chargesEnabled }
  const [notion, setNotion] = useState({ connected: false, target: "" }); // intégration Notion créateur
  const [notionOpen, setNotionOpen] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);  // force le rechargement de la preview
  const [dragOver, setDragOver] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  // Timeline agent : todolist à cases + journal ancré de CHAQUE action
  // (lecture de skill, lecture de fichier, écriture…) — persiste après le run.
  const [agentTodos, setAgentTodos] = useState([]);   // [{ id, label, status }]
  const [agentLog, setAgentLog] = useState([]);       // [{ kind, text }]
  const agentTodosRef = useRef([]);
  const agentLogRef = useRef([]);
  const pushLog = (kind, text) => {
    if (agentLogRef.current.some((l) => l.text === text)) return; // dédoublonne
    agentLogRef.current = [...agentLogRef.current, { kind, text }];
    setAgentLog(agentLogRef.current);
  };
  const resetTimeline = () => {
    agentTodosRef.current = []; agentLogRef.current = [];
    setAgentTodos([]); setAgentLog([]);
  };
  const timelineSnapshot = () => ({
    todos: agentTodosRef.current.map((t) => ({ ...t, status: "done" })),
    log: agentLogRef.current
  });  // "Écriture de src/App.jsx…"
  const [streamThinking, setStreamThinking] = useState(""); // « réflexion » live du modèle
  const [streamFiles, setStreamFiles] = useState([]);    // fichiers touchés pendant le stream
  const [diffs, setDiffs] = useState({});                // path → { added, removed, op }

  const { credits, setCredits, refreshQuota, user, logout } = useAuth();
  const firstName = (user?.name || user?.email || "").split(/[@\s]/)[0];
  const niceName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";

  const wcRef = useRef(null);
  const devProcRef = useRef(null);
  const writeTimers = useRef({});
  const termRef = useRef(null);
  const autoFixRef = useRef({ attempts: 0, sig: "", timer: null, running: false });
  const errorBufRef = useRef("");
  const triggerAutoFixRef = useRef(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const iframeRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachInputRef = useRef(null);   // input des pièces jointes du composer
  const thinkingBufRef = useRef("");   // accumulation du thinking pour le persister
  const [visualMode, setVisualMode] = useState(false);
  const [visualSel, setVisualSel] = useState(null);   // { tag, text, originalText, styles, newStyle }

  const selectedFile = useMemo(
    () => files.find((f) => f.path === selected) || null,
    [files, selected]
  );

  const selectedProfile = useMemo(
    () => LAUNCH_PROFILES.find((p) => p.id === modelId) || LAUNCH_PROFILES.find((p) => p.id === DEFAULT_PROFILE),
    [modelId]
  );

  // État de déploiement quand un projet est chargé (URL + bouton Retirer)
  useEffect(() => {
    if (!session?.id) return;
    api.launchDeployStatus(session.id).then((d) => {
      if (d?.deployed) setDeployedUrl(api.siteUrl(d.url));
    }).catch(() => {});
    api.launchNotionStatus(session.id).then(setNotion).catch(() => {});
  }, [session?.id]);

  // Sauvegarde auto de la conversation (débounce) dès qu'elle change
  useEffect(() => {
    if (!session?.id || chat.length === 0) return;
    const t = setTimeout(() => api.launchSaveChat(session.id, chat).catch(() => {}), 700);
    return () => clearTimeout(t);
  }, [chat, session?.id]);

  // État Stripe : au niveau utilisateur (1 compte pour tous les projets), rafraîchi au focus
  useEffect(() => {
    const loadPay = () => api.launchPayStatus().then(setPayReady).catch(() => {});
    loadPay();
    window.addEventListener("focus", loadPay);
    return () => window.removeEventListener("focus", loadPay);
  }, []);

  // Charge seulement le catalogue d'images (les modèles texte = profils statiques)
  useEffect(() => {
    let aborted = false;
    api.catalog().then((cat) => {
      if (aborted) return;
      const imgs = (cat?.creative?.IMAGE?.models || []).filter((m) => LAUNCH_IMAGE_IDS.includes(m.id));
      if (imgs.length) setImageModels(imgs);
    }).catch(() => {});
    return () => { aborted = true; };
  }, []);

  const log = useCallback((line) => {
    setTerminal((t) => [...t.slice(-400), line]);
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [terminal]);

  // Détecte les écrans larges (≥ lg) pour activer le diviseur draggable
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Glisser le diviseur chat/preview pour redimensionner
  const startDragDivider = (e) => {
    e.preventDefault();
    const onMove = (ev) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      setChatWidth(Math.min(rect.width - 360, Math.max(280, ev.clientX - rect.left)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ─── Lance le projet dans WebContainer (mount → install → dev) ──────────────
  const runProject = useCallback(async (flatFiles) => {
    try {
      setPreviewUrl("");
      setWcStatus("booting");
      const wc = await bootWebContainer();
      wcRef.current = wc;

      // Tue le serveur dev précédent s'il existe
      if (devProcRef.current) {
        try { devProcRef.current.kill(); } catch { /* noop */ }
        devProcRef.current = null;
      }

      // Injecte le script Visual Edits dans la preview (pas dans le build persisté)
      const mountFiles = flatFiles.map((f) => (f.path === "index.html" ? { ...f, content: injectVisual(f.content) } : f));
      await wc.mount(filesToTree(mountFiles));

      // server-ready : on récupère l'URL de preview
      wc.on("server-ready", (_port, url) => {
        setPreviewUrl(url);
        setWcStatus("ready");
        autoFixRef.current.attempts = 0; autoFixRef.current.sig = ""; // app saine → reset
      });
      wc.on("error", (e) => { log(`✖ ${e?.message || e}`); });

      setWcStatus("installing");
      log("$ npm install");
      const install = await wc.spawn("npm", ["install"]);
      pipeOutput(install.output, log);
      const code = await install.exit;
      if (code !== 0) { setWcStatus("error"); log(`✖ npm install a échoué (${code})`); return; }

      setWcStatus("running");
      log("$ npm run dev");
      const dev = await wc.spawn("npm", ["run", "dev"]);
      devProcRef.current = dev;
      pipeOutput(dev.output, (chunk) => {
        log(chunk);
        errorBufRef.current = (errorBufRef.current + chunk).slice(-4000);
        if (/(Internal server error|✘ \[ERROR\]|Failed to compile|Could not resolve|Cannot find module|is not defined|ReferenceError|SyntaxError|Unexpected (token|identifier))/i.test(chunk)) {
          clearTimeout(autoFixRef.current.timer);
          autoFixRef.current.timer = setTimeout(() => triggerAutoFixRef.current?.(errorBufRef.current), 1500);
        }
      });
    } catch (e) {
      setWcStatus("error");
      log(`✖ ${e.message}`);
      setError(e.message);
    }
  }, [log]);

  // Historique condensé (mémoire) envoyé au mode Code : rôle + texte, sans placeholders.
  const buildHistory = (msgs) => (msgs || [])
    .filter((m) => m && m.text && !m.thinking)
    .slice(-10)
    .map((m) => ({ role: m.role, text: String(m.text).slice(0, 800) }));

  // Événements communs du stream (progression + diffs)
  const streamHandlers = () => ({
    onStatus: (t) => { setStreamStatus(t); pushLog("status", t); },
    onSkill: (s) => pushLog("skill", `Je lis le skill ${s.file || s.name}`),
    onTodoList: (items) => {
      agentTodosRef.current = items.map((it) => ({ ...it, status: "pending" }));
      setAgentTodos(agentTodosRef.current);
    },
    onTodoState: ({ id, status }) => {
      agentTodosRef.current = agentTodosRef.current.map((t) => t.id === id ? { ...t, status } : t);
      setAgentTodos(agentTodosRef.current);
    },
    onThinking: (delta) => { thinkingBufRef.current += delta; setStreamThinking(thinkingBufRef.current); },
    onAction: (path) => {
      setStreamStatus(`Écriture de ${path}…`);
      pushLog("write", `Écriture de ${path}`);
      setStreamFiles((s) => (s.includes(path) ? s : [...s, path]));
    },
    onFile: (f) => setDiffs((d) => ({ ...d, [f.path]: { added: f.added, removed: f.removed, op: f.op } })),
    onError: (e, info) => {
      if (info?.creditsLeft != null) setCredits(info.creditsLeft);
      setError(e.message);
      setChat((c) => [...c.filter((m) => !m.thinking), { role: "assistant", text: `Erreur : ${e.message}` }]);
      setStreamStatus(""); setBusy(false);
    }
  });

  // ─── Génération initiale (streaming SSE) ────────────────────────────────────
  const generate = (text) => {
    const p = (text ?? prompt).trim();
    if (!p || busy) return;
    setBusy(true); setError(null);
    setPhase("working");
    setChat([{ role: "user", text: p }, { role: "assistant", text: "Parfait, je vais te construire ça ! 🚀 Je mets en place la structure du projet et les composants…", thinking: true }]);
    setTerminal([]); setPreviewUrl(""); setTab("preview"); setShowPreview(false);
    setDiffs({}); resetTimeline(); setStreamFiles([]); setStreamStatus("Démarrage…");
    thinkingBufRef.current = ""; setStreamThinking("");
    api.codeStream({
      prompt: p + attachmentNote(), modelId: resolveModel(modelId), mode: "react", imageModel, history: buildHistory(chat), ...streamHandlers(),
      onDone: async (sess) => {
        setSession(sess);
        if (sess.slug) setProjectUrl(sess.slug);
        if (sess.creditsLeft != null) setCredits(sess.creditsLeft);
        setChat((c) => [...c.filter((m) => !m.thinking), { role: "assistant", text: sess.summary, cost: sess.creditCost, reasoning: thinkingBufRef.current || undefined, questions: sess.questions || undefined, timeline: timelineSnapshot() }]);
        setStreamThinking("");
        setStreamStatus("");
        try {
          const atts = await uploadAttachmentsToProject(sess.id);   // stocke les images jointes
          const { files: full } = await api.codeSessionFiles(sess.id);
          const merged = [...full, ...atts.filter((a) => !full.some((f) => f.path === a.path))];
          setFiles(merged);
          setSelected(merged.find((f) => f.path === "src/App.jsx")?.path || merged[0]?.path || null);
          setAttachments([]);
          runProject(merged);
        } catch (e) { setError(e.message); }
        setBusy(false);
      }
    });
  };

  // ─── Mode Plan : l'IA brainstorme et pose des questions (aucun code) ────────
  const runPlan = async (text) => {
    const p = (text ?? editPrompt).trim();
    if (!p || busy) return;
    setBusy(true); setError(null);
    const newChat = [...chat, { role: "user", text: p }];
    setChat(newChat); setEditPrompt("");
    try {
      const r = await api.launchPlan({ messages: newChat, projectId: session?.id, modelId: resolveModel(modelId) });
      if (r.creditsLeft != null) setCredits(r.creditsLeft);
      setChat((c) => [...c, { role: "assistant", text: r.message, questions: r.questions, toolEvents: r.toolEvents, cost: r.creditCost, plan: true }]);
    } catch (e) {
      setError(e.message);
      setChat((c) => [...c, { role: "assistant", text: `Erreur : ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  // Clic sur une option de question → réponse. En mode Plan : continue le brainstorm.
  // Question issue d'une génération de code : applique directement la modif (édition).
  const answerQuestion = (q, option, isPlan) => {
    if (busy) return;
    if (isPlan) return runPlan(`${q} → ${option}`);
    applyEdit(`${q} → ${option}`);
  };

  // ─── Édition itérative par chat (streaming SSE) ─────────────────────────────
  // forced = texte imposé (réponse à une question) → force le mode code.
  const applyEdit = (forced) => {
    if (composerMode === "plan" && typeof forced !== "string") return runPlan();
    const p = (typeof forced === "string" ? forced : editPrompt).trim();
    if (!p || !session?.id || busy) return;
    setBusy(true); setError(null);
    setChat((c) => [...c, { role: "user", text: p }, { role: "assistant", text: "D'accord, je m'en occupe ! J'applique les modifications…", thinking: true }]);
    setEditPrompt("");
    setDiffs({}); resetTimeline(); setStreamFiles([]); setStreamStatus("Démarrage…");
    thinkingBufRef.current = ""; setStreamThinking("");
    const uploadP = attachments.length ? uploadAttachmentsToProject(session.id) : Promise.resolve([]);
    api.codeStream({
      id: session.id, prompt: p + attachmentNote(), modelId: resolveModel(modelId), mode: "react", imageModel, history: buildHistory(chat), ...streamHandlers(),
      onDone: async (sess) => {
        setSession(sess);
        if (sess.creditsLeft != null) setCredits(sess.creditsLeft);
        setChat((c) => [...c.filter((m) => !m.thinking), { role: "assistant", text: sess.summary, cost: sess.creditCost, reasoning: thinkingBufRef.current || undefined, questions: sess.questions || undefined, timeline: timelineSnapshot() }]);
        setStreamThinking("");
        setStreamStatus("");
        try {
          const atts = await uploadP;   // images jointes stockées dans le projet
          setAttachments([]);
          const { files: srv } = await api.codeSessionFiles(sess.id);
          const full = [...srv, ...atts.filter((a) => !srv.some((f) => f.path === a.path))];
          setFiles(full);
          // Réécrit les fichiers modifiés dans le WC (Vite HMR prend le relais)
          const wc = wcRef.current;
          if (wc) {
            let ok = 0, ko = 0;
            for (const f of full) {
              try {
                const dir = f.path.split("/").slice(0, -1).join("/");
                if (dir) await wc.fs.mkdir(dir, { recursive: true });
                await wc.fs.writeFile(f.path, f.encoding === "base64" ? b64ToBytes(f.content) : f.content);
                ok++;
              } catch (werr) { ko++; log(`✖ écriture ${f.path}: ${werr.message}`); }
            }
            log(`✎ ${ok} fichier(s) appliqué(s) au projet${ko ? `, ${ko} échec(s)` : ""}`);
            await ensureVisualScript(wc);
            // Recharge la preview pour refléter les changements (au cas où le HMR ne suit pas)
            setTab("preview");
            setTimeout(() => setPreviewNonce((n) => n + 1), 1200);
          } else {
            runProject(full);
          }
        } catch (e) { setError(e.message); }
        setBusy(false);
      }
    });
  };

  // ─── Édition manuelle (Monaco) → écrit dans le WC, débounce ─────────────────
  const onEditorChange = (value) => {
    if (selected == null || value == null) return;
    setFiles((fs) => fs.map((f) => (f.path === selected ? { ...f, content: value } : f)));
    clearTimeout(writeTimers.current[selected]);
    writeTimers.current[selected] = setTimeout(() => {
      wcRef.current?.fs.writeFile(selected, value).catch(() => {});
    }, 400);
  };

  // ─── Déploiement 1-clic : build → lecture dist → POST ───────────────────────
  const deploy = async () => {
    const wc = wcRef.current;
    if (!wc || deploying) return;

    let slug = null;
    if (deployedUrl) {
      // Déjà déployé → MÊME url (le nom est définitif), on met juste à jour le contenu.
      const shown = deployedUrl.replace(/^https?:\/\//, "");
      if (!window.confirm(`Mettre à jour le site en ligne ?\n\n${shown}\n\n(Le contenu sera remplacé, l'URL reste la même.)`)) return;
    } else {
      // 1er déploiement → choix du nom, DÉFINITIF.
      const suggested = (session?.slug || session?.summary || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
      slug = window.prompt(
        "Choisis le nom de ton site :\n\ndeltai.fr/sites/<nom>\n\nCe nom est DÉFINITIF — il ne pourra plus être modifié (sauf en retirant puis redéployant le site).",
        suggested
      );
      if (!slug) return;
    }

    setDeploying(true); setError(null); setShowTerminal(true);
    try {
      log("$ npm run build");
      const build = await wc.spawn("npm", ["run", "build"]);
      pipeOutput(build.output, log);
      const code = await build.exit;
      if (code !== 0) throw new Error("Le build a échoué (voir terminal).");
      const distFiles = await readDirFlat(wc, "dist");
      if (!distFiles.length) throw new Error("Aucun fichier dans dist/.");
      const { url } = await api.launchDeploy(session.id, slug, distFiles);
      // Les sites déployés sont servis par le backend
      const full = api.siteUrl(url);
      setDeployedUrl(full);
      log(`✓ Déployé : ${full}`);
      setChat((c) => [...c, { role: "assistant", text: `Déployé sur ${full}` }]);
    } catch (e) {
      setError(e.message);
      log(`✖ ${e.message}`);
    } finally {
      setDeploying(false);
    }
  };

  // ─── Connexion Stripe du créateur (onboarding Express) ──────────────────────
  const connectStripe = async () => {
    setError(null);
    try {
      const { url } = await api.launchPayConnect(window.location.href);
      if (url) window.open(url, "_blank", "noopener");
    } catch (e) { setError(e.message); }
  };

  // Shutdown du site déployé
  const undeploy = async () => {
    if (!session?.id || !deployedUrl) return;
    if (!window.confirm("Retirer le site en ligne ? L'URL ne sera plus accessible.")) return;
    try { await api.launchUndeploy(session.id); setDeployedUrl(""); }
    catch (e) { setError(e.message); }
  };

  // ─── Drag & drop : upload d'images dans le projet (public/) ─────────────────
  // ─── Pièces jointes du prompt (référencées par @nom) ────────────────────────
  const attachName = (filename, taken) => {
    const base = String(filename || "").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "fichier";
    let name = base, i = 2;
    while (taken.has(name)) name = base + (i++);
    return name;
  };
  const addAttachments = async (fileList) => {
    const taken = new Set(attachments.map((a) => a.name));
    for (const f of Array.from(fileList || [])) {
      const name = attachName(f.name, taken); taken.add(name);
      const isImage = (f.type || "").startsWith("image/");
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
      });
      setAttachments((a) => [...a, { id: Math.random().toString(36).slice(2), name, isImage, type: f.type || "", dataUrl, fileName: f.name }]);
    }
  };
  const removeAttachment = (id) => setAttachments((a) => a.filter((x) => x.id !== id));
  // Ouvre le popup @ pour le champ ciblé
  const onComposerKeyDown = (e, target) => {
    if (e.key === "@") setMention({ open: true, target });
    else if (e.key === "Escape") setMention((m) => ({ ...m, open: false }));
  };
  // Insère @nom (remplace le @ qu'on vient de taper s'il y en a un)
  const insertMention = (att) => {
    const setter = mention.target === "prompt" ? setPrompt : setEditPrompt;
    setter((v) => {
      const idx = v.lastIndexOf("@");
      return idx === -1 ? `${v}@${att.name} ` : `${v.slice(0, idx)}@${att.name} ${v.slice(idx + 1)}`;
    });
    setMention((m) => ({ ...m, open: false }));
  };
  const attExt = (a) => (String(a.fileName || "").match(/\.([a-z0-9]+)$/i)?.[1] || (a.type.split("/")[1] || "png")).toLowerCase();
  // Note ajoutée au prompt : indique à l'IA les images jointes + leur chemin /nom.ext
  const attachmentNote = () => {
    const imgs = attachments.filter((a) => a.isImage);
    if (!imgs.length) return "";
    const lines = imgs.map((a) => `@${a.name} → /${a.name}.${attExt(a)}`);
    return `\n\n[Images jointes par l'utilisateur (déjà dans public/) : ${lines.join(", ")}. Place-les via <img src="/nom.ext">, ou TRANSFORME/fusionne-les selon la demande via le endpoint images avec &edit=noms (cf. consigne images).]`;
  };
  // Stocke les images jointes comme fichiers du projet (public/nom.ext)
  const uploadAttachmentsToProject = async (projectId) => {
    const out = [];
    for (const a of attachments.filter((x) => x.isImage)) {
      const path = `public/${a.name}.${attExt(a)}`;
      const base64 = String(a.dataUrl).split(",")[1] || "";
      try {
        await api.launchUpload(projectId, path, base64, a.type || "image/png");
        out.push({ path, content: base64, encoding: "base64", bytes: 0, contentType: a.type || "image/png" });
      } catch { /* noop */ }
    }
    return out;
  };

  // Bloc UI : chips des pièces jointes + popup @ (réutilisé dans les 2 composers)
  const renderAttach = (target) => (
    <>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {attachments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-lg bg-white border border-delt-border text-[11px]">
              {a.isImage ? <img src={a.dataUrl} alt="" className="w-4 h-4 rounded object-cover" /> : <span className="text-delt-muted"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>}
              <span className="font-mono text-delt-text">@{a.name}</span>
              <button onClick={() => removeAttachment(a.id)} className="text-delt-muted hover:text-red-500"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </span>
          ))}
        </div>
      )}
      {mention.open && mention.target === target && (
        <div className="absolute z-40 bottom-full mb-2 left-2 w-64 rounded-xl glass-strong shadow-xl border border-delt-border/60 p-1.5">
          <div className="px-2 py-1 text-[10px] font-bold uppercase text-delt-muted">Lier une pièce jointe</div>
          {attachments.length === 0
            ? <div className="px-2 py-1.5 text-[11px] text-delt-muted">Aucune pièce jointe — clique le trombone pour en ajouter.</div>
            : attachments.map((a) => (
                <button key={a.id} onClick={() => insertMention(a)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-delt-surface text-left">
                  {a.isImage ? <img src={a.dataUrl} alt="" className="w-5 h-5 rounded object-cover" /> : <span className="text-delt-muted"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>}
                  <span className="text-[12px] font-mono text-delt-text">@{a.name}</span>
                  <span className="text-[10px] text-delt-muted truncate ml-auto">{a.fileName}</span>
                </button>
              ))}
        </div>
      )}
    </>
  );
  const attachButton = (
    <button onClick={() => attachInputRef.current?.click()} type="button" title="Joindre une image / un fichier (@référence)"
      className="w-7 h-7 rounded-full flex items-center justify-center text-delt-muted hover:text-delt-text hover:bg-delt-surface flex-shrink-0">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
    </button>
  );

  const uploadFiles = async (fileList) => {
    if (!session?.id) return;
    for (const f of Array.from(fileList || [])) {
      if (!f.type.startsWith("image/")) { setError("Seules les images sont acceptées pour l'instant."); continue; }
      try {
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
        });
        const base64 = String(dataUrl).split(",")[1];
        const name = f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
        const path = `public/${name}`;
        await api.launchUpload(session.id, path, base64, f.type);
        setFiles((fs) => [...fs.filter((x) => x.path !== path), { path, content: base64, encoding: "base64", bytes: f.size, contentType: f.type }]
          .sort((a, b) => a.path.localeCompare(b.path)));
        const wc = wcRef.current;
        if (wc) { await wc.fs.mkdir("public", { recursive: true }).catch(() => {}); await wc.fs.writeFile(path, b64ToBytes(base64)).catch(() => {}); }
        setChat((c) => [...c, { role: "assistant", text: `Image ajoutée : /${name} — demande-moi de l'utiliser (logo, hero…).` }]);
      } catch (e) { setError(e.message); }
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const deleteFile = async (filePath) => {
    if (!session?.id) return;
    try {
      await api.launchDeleteFile(session.id, filePath);
      setFiles((fs) => fs.filter((f) => f.path !== filePath));
      if (selected === filePath) setSelected(null);
      wcRef.current?.fs.rm(filePath, { force: true }).catch(() => {});
    } catch (e) { setError(e.message); }
  };

  const setAsFavicon = async (filePath) => {
    if (!session?.id) return;
    try {
      await api.launchSetFavicon(session.id, filePath);
      const { files: full } = await api.codeSessionFiles(session.id);
      setFiles(full);
      const idx = full.find((f) => f.path === "index.html");
      if (idx && wcRef.current) await wcRef.current.fs.writeFile("index.html", idx.content).catch(() => {});
      setPreviewNonce((n) => n + 1);
      setChat((c) => [...c, { role: "assistant", text: "Logo de l'app défini." }]);
    } catch (e) { setError(e.message); }
  };

  const fixWithAI = () => {
    const lastErr = terminal.filter((l) => /error|fail|✖|Error/i.test(l)).slice(-6).join("\n");
    setEditPrompt(`L'app a une erreur, corrige-la. Logs:\n${lastErr || "(voir preview)"}`);
  };

  // ─── Auto-fix autonome : l'IA corrige les erreurs détectées (max 2 essais) ───
  const triggerAutoFix = async (errorText) => {
    const af = autoFixRef.current;
    if (af.running || busy || !session?.id || wcStatus === "installing" || wcStatus === "booting") return;
    const sig = String(errorText).slice(-200);
    if (af.sig !== sig) { af.sig = sig; af.attempts = 0; }
    if (af.attempts >= 2) return; // anti-boucle
    af.attempts++; af.running = true; setAutoFixing(true);
    const errLines = String(errorText).split("\n").map((s) => s.trim()).filter(Boolean).slice(-15).join("\n");
    setChat((c) => [...c, { role: "assistant", text: "Erreur détectée — correction automatique…" }]);
    api.codeStream({
      id: session.id, prompt: `L'app a une erreur (compilation/runtime). Corrige-la précisément, sans rien casser d'autre.\n\nErreur:\n${errLines}`,
      modelId: resolveModel(modelId), mode: "react",
      onStatus: () => {}, onAction: () => {}, onFile: () => {},
      onDone: async (sess) => {
        try {
          if (sess.creditsLeft != null) setCredits(sess.creditsLeft);
          const { files: full } = await api.codeSessionFiles(sess.id);
          setFiles(full);
          const wc = wcRef.current;
          if (wc) {
            for (const f of full) {
              if (f.encoding === "base64") continue;
              const dir = f.path.split("/").slice(0, -1).join("/");
              if (dir) await wc.fs.mkdir(dir, { recursive: true }).catch(() => {});
              await wc.fs.writeFile(f.path, f.content).catch(() => {});
            }
            await ensureVisualScript(wc);
          }
          setChat((c) => [...c, { role: "assistant", text: `Correction appliquée.` }]);
          setTimeout(() => setPreviewNonce((n) => n + 1), 1200);
        } catch (e) { setError(e.message); }
        af.running = false; setAutoFixing(false);
      },
      onError: () => { af.running = false; setAutoFixing(false); }
    });
  };
  triggerAutoFixRef.current = triggerAutoFix;

  // ─── Visual Edits : clic-to-edit dans la preview ────────────────────────────
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.source !== "launch-visual" || d.type !== "SELECTED") return;
      setVisualSel({ tag: d.tag, text: d.text, originalText: d.text, styles: d.styles || {}, newStyle: {} });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const toggleVisual = () => {
    const next = !visualMode;
    setVisualMode(next); setVisualSel(null); setTab("preview");
    iframeRef.current?.contentWindow?.postMessage({ source: "launch-ide", type: "MODE", active: next }, "*");
  };
  const visualApplyLive = (patch) => iframeRef.current?.contentWindow?.postMessage({ source: "launch-ide", type: "APPLY", ...patch }, "*");

  // Édition programmatique (réutilisée pour la persistance des styles)
  const runEdit = (prompt) => new Promise((resolve) => {
    if (!session?.id) return resolve();
    api.codeStream({
      id: session.id, prompt, modelId: resolveModel(modelId), mode: "react",
      onStatus: () => {}, onAction: () => {}, onFile: () => {},
      onDone: async (sess) => {
        try {
          if (sess.creditsLeft != null) setCredits(sess.creditsLeft);
          const { files: full } = await api.codeSessionFiles(sess.id);
          setFiles(full);
          const wc = wcRef.current;
          if (wc) {
            for (const f of full) {
              if (f.encoding === "base64") continue;
              const dir = f.path.split("/").slice(0, -1).join("/");
              if (dir) await wc.fs.mkdir(dir, { recursive: true }).catch(() => {});
              await wc.fs.writeFile(f.path, f.content).catch(() => {});
            }
            await ensureVisualScript(wc);
          }
          setTimeout(() => setPreviewNonce((n) => n + 1), 1200);
        } catch (e) { setError(e.message); }
        resolve();
      },
      onError: () => resolve()
    });
  });

  const persistVisual = async () => {
    if (!visualSel || !session?.id || busy) return;
    setBusy(true); setError(null);
    try {
      if (visualSel.text !== visualSel.originalText && visualSel.originalText) {
        const r = await api.launchVisualText(session.id, visualSel.originalText, visualSel.text);
        if (!r.found) await runEdit(`Change le texte exact "${visualSel.originalText}" en "${visualSel.text}".`);
        else {
          // Le serveur a modifié les fichiers : sans resynchro WebContainer +
          // reload, la preview restait sur l'ancienne version (bug).
          const { files: srv } = await api.codeSessionFiles(session.id);
          setFiles(srv);
          const wc = wcRef.current;
          if (wc) {
            for (const f of srv) {
              if (f.encoding === "base64") continue;
              const dir = f.path.split("/").slice(0, -1).join("/");
              if (dir) await wc.fs.mkdir(dir, { recursive: true }).catch(() => {});
              await wc.fs.writeFile(f.path, f.content).catch(() => {});
            }
          }
          setTimeout(() => setPreviewNonce((v) => v + 1), 600);
        }
      }
      const ns = visualSel.newStyle || {};
      if (Object.keys(ns).length) {
        const desc = Object.entries(ns).map(([k, v]) => `${k}: ${v}`).join(", ");
        await runEdit(`Pour l'élément <${visualSel.tag}> qui contient le texte "${(visualSel.text || "").slice(0, 60)}", applique ce style : ${desc}.`);
      }
      setChat((c) => [...c, { role: "assistant", text: "Modification visuelle appliquée." }]);
      setVisualSel(null);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  // ─── Projets sauvegardés ────────────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const { sessions } = await api.codeSessions();
      setProjects(sessions || []);
    } catch { /* silencieux */ }
    finally { setLoadingProjects(false); }
  }, []);

  useEffect(() => { if (phase === "empty") loadProjects(); }, [phase, loadProjects]);

  // Met à jour l'URL du navigateur : launch.../p/<slug>
  const setProjectUrl = (slug) => {
    try { window.history.replaceState({}, "", slug ? `/p/${slug}` : "/"); } catch { /* noop */ }
  };

  const openProject = async (proj) => {
    if (busy) return;
    setBusy(true); setError(null);
    setPhase("working");
    setSession({ id: proj.id, slug: proj.slug, summary: proj.name || proj.summary, mode: proj.mode || "react" });
    if (proj.slug) setProjectUrl(proj.slug);
    setTerminal([]); setPreviewUrl(""); setTab("preview"); setDeployedUrl(""); setShowPreview(true);
    try {
      // Recharge la conversation sauvegardée (Code + Plan)
      const { chat: saved } = await api.launchGetChat(proj.id).catch(() => ({ chat: [] }));
      setChat(saved?.length ? saved : [{ role: "assistant", text: proj.summary || proj.name }]);
      const { files: full } = await api.codeSessionFiles(proj.id);
      setFiles(full);
      setSelected(full.find((f) => f.path === "src/App.jsx")?.path || full[0]?.path || null);
      runProject(full);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Au chargement : si l'URL est /p/<slug>, ouvre directement ce projet
  useEffect(() => {
    const m = window.location.pathname.match(/^\/p\/([a-z0-9-]+)$/i);
    if (!m) return;
    api.launchProjectBySlug(m[1])
      .then((proj) => { if (proj?.id) openProject(proj); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteProject = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer ce projet ?")) return;
    try { await api.codeDeleteSession(id); setProjects((p) => p.filter((x) => x.id !== id)); }
    catch (err) { setError(err.message); }
  };

  const reset = () => {
    setPhase("empty"); setSession(null); setFiles([]); setSelected(null);
    setChat([]); setPrompt(""); setEditPrompt(""); setError(null);
    setPreviewUrl(""); setTerminal([]); setWcStatus("idle");
    setDiffs({}); resetTimeline(); setStreamFiles([]); setStreamStatus(""); setShowPreview(false);
    setProjectUrl(null);
  };

  const statusLabel = {
    idle: "—", booting: "Démarrage…", installing: "npm install…",
    running: "Lancement du serveur…", ready: "En ligne", error: "Erreur"
  }[wcStatus];

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "empty") {
    return (
      <div className="h-full overflow-y-auto">
        {/* Top bar : logo + compte */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 backdrop-blur-xl bg-white/60 border-b border-delt-border/50">
          <div className="flex items-center gap-2.5 font-bold text-delt-text tracking-tight">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-900 text-white">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </span>
            Launch
          </div>
          <div className="flex items-center gap-2.5">
            <CreditsBadge credits={credits} compact />
            <AccountMenu user={user} logout={logout} />
          </div>
        </div>
        {/* Hero dégradé façon Lovable */}
        <div className="relative px-4 pt-16 pb-12 sm:pt-24 sm:pb-16 overflow-hidden">
          <div className="absolute inset-0 -z-10"
            style={{ background: "radial-gradient(120% 80% at 50% -10%, rgba(99,102,241,.28), rgba(6,182,212,.14) 40%, rgba(236,72,153,.10) 70%, transparent)" }} />
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-pill text-xs font-semibold text-delt-text mb-6">
              <span className="w-4 h-4 rounded flex items-center justify-center text-white text-[9px]" style={{ background: "#0f172a" }}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>
              Launch — construis ton app en parlant
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-delt-text">
              Qu'est-ce qu'on construit{niceName ? `, ${niceName}` : ""} ?
            </h1>

            {!isIsolated() && (
              <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700 text-left">
                Preview indisponible : contexte non isolé (utilise Chrome + HTTPS).
              </div>
            )}

            {/* Gros composer */}
            <div className="relative mt-7 rounded-3xl bg-white/80 backdrop-blur border border-delt-border/80 shadow-xl shadow-indigo-500/5 p-3 text-left focus-within:border-indigo-300 transition-colors">
              <input ref={attachInputRef} type="file" multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) addAttachments(e.target.files); e.target.value = ""; }} />
              {renderAttach("prompt")}
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { onComposerKeyDown(e, "prompt"); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
                rows={3} placeholder="Demande à Launch de créer une app… (joins des images, @réfère-les)"
                className="w-full text-[15px] outline-none resize-none placeholder:text-delt-muted bg-transparent px-2 pt-1.5" />
              <div className="flex items-center justify-between gap-2 mt-1.5 px-1">
                <div className="flex items-center gap-2">
                  {attachButton}
                  <ProfileMenu value={modelId} selected={selectedProfile} onChange={setModelId} />
                  <ImageModelMenu models={imageModels} value={imageModel} onChange={setImageModel} />
                  <CreditsBadge credits={credits} compact />
                </div>
                <button onClick={() => generate()} disabled={busy || !prompt.trim()}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white shadow-md hover:shadow-lg transition-all disabled:opacity-30"
                  style={{ background: prompt.trim() ? "linear-gradient(135deg, #2563eb, #06b6d4)" : "#94a3b8" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Exemples (pills) */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => generate(ex)}
                  className="px-3 py-1.5 rounded-full bg-white/70 border border-delt-border/70 text-xs text-delt-text hover:border-indigo-300 hover:bg-white transition-colors max-w-[260px] truncate">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mes projets */}
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-delt-text">Mes projets</h2>
            {projects.length > 0 && <span className="text-[11px] text-delt-muted">{projects.length} projet{projects.length > 1 ? "s" : ""}</span>}
          </div>
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((p) => (
                <div key={p.id} onClick={() => openProject(p)}
                  className="group relative rounded-2xl bg-white border border-delt-border/70 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                  <div className="h-24 flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(99,102,241,.12), rgba(6,182,212,.10))" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                      </svg>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold text-delt-text truncate">{p.name}</div>
                    <div className="text-[11px] text-delt-muted mt-0.5">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </div>
                  <button onClick={(e) => deleteProject(e, p.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center text-delt-muted hover:text-red-500 shadow">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-delt-muted py-10 rounded-2xl border border-dashed border-delt-border">
              {loadingProjects ? "Chargement…" : "Aucun projet pour l'instant — décris ton idée ci-dessus 👆"}
            </div>
          )}
          {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKING STATE — chat | editor/preview
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col relative"
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}>
      {dragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-indigo-500/10 backdrop-blur-sm border-4 border-dashed border-indigo-400 rounded-xl pointer-events-none">
          <div className="text-indigo-700 font-bold text-lg">Dépose ton image ici</div>
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-delt-border/70 bg-white/40">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={reset} className="text-xs font-semibold text-delt-muted hover:text-delt-text">← Nouveau</button>
          <h2 className="text-sm font-bold text-delt-text truncate">{session?.summary || "App"}</h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {previewUrl && (
            <button onClick={() => setShowPreview((s) => !s)}
              title={showPreview ? "Réduire — chat plein écran" : "Ouvrir l'aperçu"}
              className="hidden lg:inline-flex w-8 h-8 items-center justify-center rounded-full text-delt-muted hover:text-delt-text hover:bg-delt-surface">
              {showPreview ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          )}
          <ProfileMenu value={modelId} selected={selectedProfile} onChange={setModelId} />
          <span className="hidden md:contents"><CreditsBadge credits={credits} compact /></span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-delt-muted">
            <span className={`w-2 h-2 rounded-full ${wcStatus === "ready" ? "bg-emerald-500" : wcStatus === "error" ? "bg-red-500" : "bg-amber-400 animate-pulse"}`} />
            {statusLabel}
          </span>
          <button onClick={() => setShowTerminal((s) => !s)}
            className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-xs font-semibold text-delt-muted hover:text-delt-text hover:bg-delt-surface">
            Terminal
          </button>
          {deployedUrl && (
            <>
              <a href={deployedUrl} target="_blank" rel="noreferrer"
                className="text-[11px] font-semibold text-emerald-600 hover:underline truncate max-w-[160px]">
                {deployedUrl.replace(/^https?:\/\//, "")}
              </a>
              <button onClick={undeploy} title="Retirer le site en ligne"
                className="text-[11px] font-semibold text-red-500 hover:text-red-600">
                Retirer
              </button>
            </>
          )}
          <button onClick={() => setNotionOpen(true)}
            title="Notion : journaliser les commandes payées"
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              notion.target ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-delt-border text-delt-text hover:bg-delt-surface"}`}>
            <span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-2px]"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span> Notion {notion.target ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-2px]"><polyline points="20 6 9 17 4 12"/></svg> : ""}
          </button>
          <button onClick={connectStripe}
            title={payReady?.chargesEnabled ? "Stripe actif — prêt à encaisser" : payReady?.connected ? "Onboarding Stripe à terminer" : "Connecter Stripe (paiements de l'app)"}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              payReady?.chargesEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : payReady?.connected ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-delt-border text-delt-text hover:bg-delt-surface"}`}>
            <span style={{ color: payReady?.chargesEnabled ? "#22c55e" : "#635bff" }}>●</span>
            Stripe {payReady?.chargesEnabled ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-2px]"><polyline points="20 6 9 17 4 12"/></svg> : payReady?.connected ? "Finir" : ""}
          </button>
          <button onClick={deploy} disabled={deploying || wcStatus !== "ready"}
            title={wcStatus !== "ready" ? "Attends que l'app tourne" : "Déployer"}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}>
            {deploying ? "Déploiement…" : deployedUrl ? "Mettre à jour" : "Déployer"}
          </button>
          <AccountMenu user={user} logout={logout} />
        </div>
      </div>

      <div ref={gridRef} className="flex-1 min-h-0 grid grid-cols-1"
        style={showPreview && isWide ? { gridTemplateColumns: `${chatWidth}px 7px minmax(0,1fr)` } : undefined}>
        {/* Left: chat (+ files quand preview ouverte) */}
        <div className={`${(!showPreview || mobileShow === "chat") ? "flex" : "hidden"} lg:flex flex-col min-h-0 ${showPreview ? "border-r border-delt-border/70 bg-white/30" : ""}`}>
          <div className="flex-1 min-h-0 overflow-y-auto">
           <div className={`p-3 space-y-2 ${!showPreview ? "max-w-3xl mx-auto w-full" : ""}`}>
            {chat.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "space-y-1.5"}>
                {m.timeline && <AgentTimeline todos={m.timeline.todos} log={m.timeline.log} />}
                {m.reasoning && <ThinkingBlock text={m.reasoning} />}
                <div className={`text-sm rounded-xl px-3 py-2 ${m.role === "user" ? "bg-indigo-50 text-delt-text max-w-[85%] whitespace-pre-wrap" : m.plan ? "bg-violet-50 text-delt-text border border-violet-100" : m.thinking ? "text-delt-muted italic whitespace-pre-wrap" : "bg-delt-surface text-delt-text"}`}>
                  {(m.role === "user" || m.thinking)
                    ? m.text
                    : <MessageRenderer content={m.text} />}
                  {m.cost != null && m.cost > 0 && (
                    <span className="block mt-1 text-[10px] text-delt-muted/80">−{m.cost} Cr</span>
                  )}
                </div>
                {/* Outils exécutés par l'agent (Notion…) */}
                {Array.isArray(m.toolEvents) && m.toolEvents.length > 0 && (
                  <div className="space-y-1">
                    {m.toolEvents.map((t, ti) => (
                      <div key={ti} className="flex items-center gap-1.5 text-[11px]">
                        <span className={t.ok ? "text-emerald-600" : "text-red-500"}>{t.ok ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-2px]"><polyline points="20 6 9 17 4 12"/></svg> : "✖"}</span>
                        <span className="font-mono text-delt-muted truncate">{String(t.name || "").replace(/_/g, " ").toLowerCase()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Questions parsées (style Claude) */}
                {Array.isArray(m.questions) && m.questions.map((q, qi) => (
                  <div key={qi} className="mt-2 rounded-xl border border-violet-200 bg-white p-2.5">
                    <div className="text-[13px] font-semibold text-delt-text mb-2">{q.question}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(q.options || []).map((opt, oi) => (
                        <button key={oi} onClick={() => answerQuestion(q.question, opt, m.plan)} disabled={busy}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-delt-border hover:border-violet-400 hover:bg-violet-50 text-delt-text transition-colors disabled:opacity-50">
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {busy && (agentTodos.length > 0 || agentLog.length > 0) && (
              <AgentTimeline todos={agentTodos} log={agentLog} live />
            )}
            {busy && streamThinking && <ThinkingBlock text={streamThinking} live />}
            {(busy || streamFiles.length > 0) && (streamStatus || streamFiles.length > 0) && (
              <div className="space-y-1.5">
                {busy && streamStatus && (
                  <div className="flex items-center gap-2 text-xs text-delt-muted px-1 py-0.5">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                    </svg>
                    {streamStatus}
                  </div>
                )}
                {streamFiles.map((p) => <StepCard key={p} path={p} diff={diffs[p]} />)}
              </div>
            )}
            {/* Bouton « Voir l'aperçu » (façon Lovable) — apparait quand l'app est prête */}
            {previewUrl && !showPreview && (
              <button onClick={() => { setShowPreview(true); setMobileShow("main"); }}
                className="w-full flex items-center gap-3 rounded-xl border border-delt-border bg-white px-3 py-2.5 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors text-left shadow-sm">
                <span className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-delt-text">Voir l'aperçu</div>
                  <div className="text-[11px] text-delt-muted">Ton app est prête — ouvre la preview live</div>
                </div>
                <span className="ml-auto text-delt-muted text-lg">→</span>
              </button>
            )}
           </div>
          </div>

          {/* File tree (visible seulement quand la preview est ouverte) */}
          {showPreview && (
          <div className="border-t border-delt-border/70 max-h-52 overflow-y-auto">
            {files.map((f) => (
              <button key={f.path} onClick={() => { setSelected(f.path); setTab("code"); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 font-mono text-[12px] ${
                  selected === f.path ? "bg-indigo-50 text-delt-accent font-semibold" : "text-delt-text hover:bg-delt-surface"}`}>
                <span className="flex-1 truncate text-left">{f.path}</span>
                {diffs[f.path] && <DiffBadge added={diffs[f.path].added} removed={diffs[f.path].removed} />}
              </button>
            ))}
          </div>
          )}

          {/* Edit input + toggle Plan/Code */}
          <div className={`border-t border-delt-border/70 p-2 space-y-2 ${!showPreview ? "" : ""}`}>
           <div className={`relative ${!showPreview ? "max-w-3xl mx-auto w-full" : ""}`}>
            <input ref={attachInputRef} type="file" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) addAttachments(e.target.files); e.target.value = ""; }} />
            {renderAttach("edit")}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex p-0.5 rounded-full glass-pill text-[11px]">
                {[["code", "Code"], ["plan", "Plan"]].map(([m, label]) => (
                  <button key={m} onClick={() => setComposerMode(m)}
                    className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                      composerMode === m ? "bg-delt-text text-white" : "text-delt-muted hover:text-delt-text"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {attachButton}
                <ImageModelMenu models={imageModels} value={imageModel} onChange={setImageModel} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                onKeyDown={(e) => { onComposerKeyDown(e, "edit"); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) applyEdit(); }}
                rows={1}
                placeholder={composerMode === "plan" ? "Discute de ton idée, brainstorme…" : "Modifier l'app…"}
                className="flex-1 min-w-0 text-sm outline-none resize-none bg-transparent placeholder:text-delt-muted py-1.5 max-h-24" />
              <button onClick={applyEdit} disabled={busy || !editPrompt.trim()}
                className="px-3 py-2 rounded-full text-xs font-bold text-white disabled:opacity-40 flex-shrink-0"
                style={{ background: editPrompt.trim() ? (composerMode === "plan" ? "#7c3aed" : "#0f172a") : "#94a3b8" }}>
                ↑
              </button>
            </div>
           </div>
          </div>
        </div>

        {/* Diviseur draggable chat / preview (desktop) */}
        {showPreview && isWide && (
          <div onMouseDown={startDragDivider} title="Glisser pour redimensionner"
            className="hidden lg:flex items-center justify-center cursor-col-resize group hover:bg-indigo-100/60 transition-colors">
            <div className="w-px h-8 rounded bg-delt-border group-hover:bg-indigo-400 transition-colors" />
          </div>
        )}

        {/* Right: editor / preview (visible seulement quand showPreview) */}
        {showPreview && (
        <div className={`${mobileShow === "main" ? "flex" : "hidden"} lg:flex flex-col min-h-0`}>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-delt-border/70 bg-white/40">
            <div className="inline-flex p-0.5 rounded-full glass-pill">
              {["preview", "code"].map((tb) => (
                <button key={tb} onClick={() => setTab(tb)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    tab === tb ? "bg-delt-text text-white" : "text-delt-muted hover:text-delt-text"}`}>
                  {tb === "preview" ? "Preview" : "Code"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {tab === "preview" && previewUrl && (
                <button onClick={toggleVisual} title="Édition visuelle : clique un élément pour le modifier"
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    visualMode ? "bg-violet-600 text-white" : "border border-delt-border text-delt-text hover:bg-delt-surface"}`}>
                  Édition visuelle
                </button>
              )}
              {tab === "preview" && previewUrl && (
                <button onClick={() => setPreviewNonce((n) => n + 1)} title="Recharger la preview"
                  className="text-delt-muted hover:text-delt-text">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
              )}
              {wcStatus === "error" && (
                <button onClick={fixWithAI} className="px-3 py-1 rounded-full text-[11px] font-bold text-white bg-red-500 hover:bg-red-600">
                  Réparer avec l'IA
                </button>
              )}
              {tab === "code" && selectedFile && (
                <span className="font-mono text-[11px] text-delt-muted truncate max-w-[200px]">{selectedFile.path}</span>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-white relative">
            {tab === "preview" ? (
              previewUrl ? (
                <>
                <button onClick={() => setPreviewNonce((v) => v + 1)}
                  title="Recharger la preview"
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/90 border border-delt-border text-delt-muted hover:text-delt-text shadow-sm flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"/><path d="M23 20v-6h-6"/><path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14"/></svg>
                </button>
                <iframe ref={iframeRef} key={`${previewUrl}#${previewNonce}`} src={previewUrl} title="Preview"
                  className="w-full h-full border-0 bg-white" allow="cross-origin-isolated" />
                </>
              ) : (
                <BootStepper wcStatus={wcStatus} />
              )
            ) : selectedFile?.encoding === "base64" ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-slate-50">
                <img src={`data:${selectedFile.contentType || "image/png"};base64,${selectedFile.content}`}
                  alt={selectedFile.path} className="max-h-[70%] max-w-full object-contain rounded-lg shadow" />
                <div className="text-xs text-delt-muted font-mono">{selectedFile.path} · {Math.ceil((selectedFile.bytes || 0) / 1024)} Ko</div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setAsFavicon(selectedFile.path)}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Définir comme logo</button>
                  <button onClick={() => deleteFile(selectedFile.path)}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600">Supprimer</button>
                </div>
              </div>
            ) : (
              <Editor
                height="100%"
                language={selectedFile ? langOf(selectedFile.path) : "plaintext"}
                path={selectedFile?.path}
                value={selectedFile?.content ?? ""}
                onChange={onEditorChange}
                theme="vs-dark"
                options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 12 } }}
              />
            )}

            {/* Panneau Visual Edits */}
            {visualMode && visualSel && (
              <VisualPanel sel={visualSel} setSel={setVisualSel} applyLive={visualApplyLive}
                onApply={persistVisual} onClose={() => setVisualSel(null)} busy={busy} />
            )}
            {visualMode && !visualSel && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold shadow-lg pointer-events-none">
                Clique un élément à modifier
              </div>
            )}

            {/* Barre d'outils flottante (façon Lovable) */}
            {tab === "preview" && previewUrl && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 p-1.5 rounded-2xl bg-slate-900/90 backdrop-blur shadow-xl border border-white/10">
                <button onClick={toggleVisual} title="Édition visuelle"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors ${visualMode ? "bg-violet-600 text-white" : "text-slate-300 hover:text-white hover:bg-white/10"}`}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg></button>
                <button onClick={() => setPreviewNonce((n) => n + 1)} title="Recharger"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                </button>
                <a href={previewUrl} target="_blank" rel="noreferrer" title="Ouvrir dans un onglet"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              </div>
            )}
          </div>

          {showTerminal && (
            <div ref={termRef} className="h-44 overflow-y-auto bg-[#0b1020] text-[#a5b4fc] font-mono text-[11px] leading-relaxed px-3 py-2 border-t border-delt-border/70 whitespace-pre-wrap">
              {terminal.length ? terminal.join("") : "Terminal…"}
            </div>
          )}
        </div>
        )}
      </div>
      {error && <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200">{error}</div>}

      {notionOpen && (
        <NotionModal projectId={session?.id} notion={notion} onClose={() => setNotionOpen(false)} onSaved={setNotion} />
      )}

      {/* Bascule mobile Chat / App (seulement quand la preview est ouverte) */}
      {showPreview && (
      <div className="lg:hidden flex items-center gap-1 p-1.5 border-t border-delt-border/70 bg-white/70 backdrop-blur">
        {[["chat", "Chat"], ["main", "App"]].map(([m, label]) => (
          <button key={m} onClick={() => setMobileShow(m)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mobileShow === m ? "bg-delt-text text-white" : "text-delt-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}

// ─── Panneau Visual Edits (clic-to-edit) ─────────────────────────────────────
function rgbToHex(rgb) {
  const m = String(rgb || "").match(/\d+/g);
  if (!m || m.length < 3) return "#000000";
  return "#" + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join("");
}
function VisualPanel({ sel, setSel, applyLive, onApply, onClose, busy }) {
  const setText = (text) => { setSel({ ...sel, text }); applyLive({ text }); };
  const setStyle = (k, v) => { setSel({ ...sel, newStyle: { ...sel.newStyle, [k]: v } }); applyLive({ style: { [k]: v } }); };
  const sizePx = parseInt(sel.newStyle.fontSize || sel.styles.fontSize || "16", 10) || 16;
  return (
    <div className="absolute top-3 right-3 z-30 w-64 rounded-2xl glass-strong shadow-xl border border-violet-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-violet-700">✦ Édition · &lt;{sel.tag}&gt;</span>
        <button onClick={onClose} className="text-delt-muted hover:text-delt-text text-sm"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-delt-muted uppercase">Texte</label>
        <textarea value={sel.text} onChange={(e) => setText(e.target.value)} rows={2}
          className="w-full mt-1 text-sm rounded-lg border border-delt-border px-2 py-1.5 outline-none focus:border-violet-400 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] flex items-center justify-between gap-1 text-delt-text">
          Texte
          <input type="color" defaultValue={rgbToHex(sel.styles.color)} onChange={(e) => setStyle("color", e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
        </label>
        <label className="text-[11px] flex items-center justify-between gap-1 text-delt-text">
          Fond
          <input type="color" defaultValue={rgbToHex(sel.styles.background)} onChange={(e) => setStyle("background", e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
        </label>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-delt-muted uppercase flex justify-between"><span>Taille</span><span>{sizePx}px</span></label>
        <input type="range" min="10" max="72" value={sizePx} onChange={(e) => setStyle("fontSize", e.target.value + "px")} className="w-full accent-violet-600" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onApply} disabled={busy}
          className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
          {busy ? "…" : "Appliquer"}
        </button>
        <button onClick={onClose} className="px-3 py-2 rounded-xl text-xs font-semibold text-delt-muted hover:bg-delt-surface">Annuler</button>
      </div>
      <p className="text-[10px] text-delt-muted">Texte = gratuit · style = 1 édition IA</p>
    </div>
  );
}

// ─── Timeline agent : todolist à cases + journal de chaque action ─────────────
function AgentTimeline({ todos = [], log = [], live = false }) {
  if (!todos.length && !log.length) return null;
  const iconFor = (kind) => kind === "skill"
    ? <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    : kind === "write"
    ? <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    : <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
  return (
    <div className="rounded-xl border border-delt-border bg-white overflow-hidden text-[12px]">
      {todos.length > 0 && (
        <div className="px-3 py-2 space-y-1 border-b border-delt-border/60 bg-delt-surface/40">
          {todos.map((t) => (
            <div key={t.id} className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0">
                {t.status === "done" ? (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>
                ) : t.status === "running" ? (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" className="animate-spin" style={{ animationDuration: "1.2s" }}><path d="M21 12a9 9 0 1 1-6.2-8.55"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>
                )}
              </span>
              <span className={`leading-snug ${t.status === "done" ? "text-delt-muted line-through decoration-delt-border" : t.status === "running" ? "text-delt-text font-semibold" : "text-delt-muted"}`}>{t.label}</span>
            </div>
          ))}
        </div>
      )}
      {log.length > 0 && (
        <div className="px-3 py-1.5 max-h-44 overflow-y-auto space-y-0.5">
          {log.map((l, i) => (
            <div key={i} className={`flex items-start gap-1.5 ${l.kind === "skill" ? "text-indigo-600" : "text-delt-muted"}`}>
              <span className="mt-[3px] flex-shrink-0">{iconFor(l.kind)}</span>
              <span className="truncate">{l.text}</span>
            </div>
          ))}
          {live && <div ref={(el) => el?.scrollIntoView({ block: "nearest" })} />}
        </div>
      )}
    </div>
  );
}

// ─── Stepper de démarrage WebContainer (booting → install → run) ──────────────
function BootStepper({ wcStatus }) {
  const order = { idle: 0, booting: 1, installing: 2, running: 3, ready: 4, error: 1 };
  const cur = order[wcStatus] ?? 0;
  const steps = [
    [1, "Démarrage de l'environnement"],
    [2, "Installation des paquets (npm)"],
    [3, "Lancement du serveur"]
  ];
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 p-6">
      <div className="w-full max-w-xs space-y-3">
        {steps.map(([idx, label]) => {
          const done = cur > idx;
          const active = cur === idx && wcStatus !== "error";
          return (
            <div key={idx} className="flex items-center gap-3 text-sm">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                done ? "bg-emerald-500 text-white" : active ? "bg-indigo-500 text-white" : "bg-delt-surface text-delt-muted"}`}>
                {done ? "✓" : active ? (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                  </svg>
                ) : idx}
              </span>
              <span className={done || active ? "text-delt-text font-medium" : "text-delt-muted"}>{label}</span>
            </div>
          );
        })}
      </div>
      {wcStatus === "installing" && <p className="text-[11px] text-delt-muted text-center max-w-xs">Première fois ? L'install prend ~20-40 s.</p>}
    </div>
  );
}

// ─── Bloc « Réflexion » (thinking du modèle, repliable comme le chat) ─────────
function ThinkingBlock({ text, live }) {
  const [open, setOpen] = useState(Boolean(live));
  const bodyRef = useRef(null);
  useEffect(() => { if (live && open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [text, live, open]);
  if (!text) return null;
  return (
    <div className="rounded-xl border border-delt-border/70 bg-delt-surface/40 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-violet-500 ${live ? "animate-pulse" : ""}`}><path d="M9.5 2a4.5 4.5 0 0 0-4.4 5.5A4 4 0 0 0 6 15a4 4 0 0 0 6 1 4 4 0 0 0 6-1 4 4 0 0 0 .9-7.5A4.5 4.5 0 0 0 14.5 2 4.5 4.5 0 0 0 9.5 2z" /></svg>
        <span className="text-[11px] font-semibold text-delt-text flex-1">{live ? "Réflexion en cours…" : "Réflexion"}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`text-delt-muted transition-transform ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div ref={bodyRef} className="px-3 pb-2 max-h-44 overflow-y-auto text-[11px] leading-relaxed text-delt-muted whitespace-pre-wrap border-t border-delt-border/50 pt-1.5">
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Carte d'étape agent (façon Lovable : « Édité X », « Créé X ») ────────────
function StepCard({ path, diff }) {
  const meta = {
    create: { label: "Créé", color: "#10b981", icon: "+" },
    update: { label: "Édité", color: "#6366f1", icon: "✎" },
    delete: { label: "Supprimé", color: "#ef4444", icon: "🗑" }
  }[diff?.op] || { label: "Écriture", color: "#94a3b8", icon: "•" };
  const file = path.split("/").pop();
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-delt-border/70 bg-white px-3 py-2">
      <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold" style={{ background: meta.color }}>{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-delt-text"><span className="text-delt-muted">{meta.label}</span> <span className="font-semibold">{file}</span></div>
        <div className="text-[10px] text-delt-muted font-mono truncate">{path}</div>
      </div>
      {diff && <DiffBadge added={diff.added} removed={diff.removed} />}
    </div>
  );
}

// ─── Badge de diff : +lignes (vert) / −lignes (rouge) ─────────────────────────
function DiffBadge({ added, removed }) {
  if (!added && !removed) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold flex-shrink-0">
      {added > 0 && <span className="text-emerald-500">+{added}</span>}
      {removed > 0 && <span className="text-red-500">−{removed}</span>}
    </span>
  );
}

// ─── Menu compte (avatar → email, retour DELT AI, déconnexion) ────────────────
function AccountMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button onClick={() => setOpen((o) => !o)} title={user?.email || "Compte"}
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold bg-slate-900 hover:bg-slate-700 transition-colors">
        {user?.picture
          ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
          : initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-60 rounded-2xl bg-white border border-delt-border/80 shadow-xl shadow-slate-900/10 py-1.5 text-sm">
          <div className="px-4 py-2.5 border-b border-delt-border/60">
            <div className="font-semibold text-delt-text truncate">{user?.name || "Mon compte"}</div>
            <div className="text-[12px] text-delt-muted truncate">{user?.email}</div>
          </div>
          <a href="https://deltai.fr" className="flex items-center gap-2.5 px-4 py-2.5 text-delt-text hover:bg-delt-surface transition-colors">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Retour à DELT AI
          </a>
          <a href="https://deltai.fr/billing" className="flex items-center gap-2.5 px-4 py-2.5 text-delt-text hover:bg-delt-surface transition-colors">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Abonnement & crédits
          </a>
          <button onClick={logout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors border-t border-delt-border/60 mt-1">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Solde de crédits (même source que le reste du site : useAuth) ────────────
function CreditsBadge({ credits, compact }) {
  const val = credits == null ? "…" : Number(credits).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-delt-text ${compact ? "text-[11px] px-2.5 py-1" : "text-sm px-3 py-1.5"} glass-pill`}>
      <svg viewBox="0 0 24 24" width={compact ? 12 : 14} height={compact ? 12 : 14} fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5a2.5 2 0 0 1 5 0c0 1.5-2.5 1.5-2.5 2.5M9 14.5a2.5 2 0 0 0 5 0" />
      </svg>
      {val} <span className="text-delt-muted font-normal">Cr</span>
    </span>
  );
}

// ─── Modal intégration Notion (connexion + page cible où journaliser) ─────────
// Quel champ de commande se mappe sur une colonne (miroir du serveur).
const NOTION_FIELD_OF = (name) => {
  const n = String(name).toLowerCase();
  if (/statut|status|état|etat/.test(n)) return "Statut → Payé";
  if (/montant|amount|prix|price|total/.test(n)) return "Montant";
  if (/client|mail|customer|acheteur/.test(n)) return "Client";
  if (/produit|product|article|offre|item/.test(n)) return "Produit";
  if (/code\s*postal|zip/.test(n)) return "Code postal";
  if (/t[ée]l[ée]phone|phone/.test(n)) return "Téléphone";
  if (/adresse|address|livraison/.test(n)) return "Adresse";
  if (/ville|city/.test(n)) return "Ville";
  if (/pays|country/.test(n)) return "Pays";
  if (/\bnom\b|\bname\b/.test(n)) return "Nom";
  if (/date/.test(n)) return "Date";
  return null;
};

function NotionModal({ projectId, notion, onClose, onSaved }) {
  const [connected, setConnected] = useState(notion?.connected || false);
  const [target, setTarget] = useState(notion?.target || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [columns, setColumns] = useState(undefined); // undefined=pas testé, null=page, array=base
  const [detecting, setDetecting] = useState(false);

  const detect = async () => {
    if (!projectId || !target.trim()) return;
    setDetecting(true); setMsg(""); setColumns(undefined);
    try {
      const d = await api.launchNotionSchema(projectId, target.trim());
      setColumns(d.columns ?? null);
    } catch (e) { setMsg(e.message); }
    setDetecting(false);
  };

  const [parentId, setParentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [pages, setPages] = useState(null);     // null=pas chargé, array=pages
  const [loadingPages, setLoadingPages] = useState(false);

  const loadPages = async () => {
    if (!projectId) return;
    setLoadingPages(true); setMsg("");
    try {
      const d = await api.launchNotionPages(projectId);
      setPages(d.pages || []);
      if (d.pages?.[0]) setParentId(d.pages[0].id);
    } catch (e) { setMsg(e.message); }
    setLoadingPages(false);
  };
  const createDb = async () => {
    if (!projectId || !parentId.trim()) return;
    setCreating(true); setMsg("");
    try {
      const d = await api.launchNotionCreateDb(projectId, parentId.trim());
      if (d?.target) {
        setTarget(d.target);
        onSaved?.({ connected, target: d.target });
        setColumns([
          { name: "Produit", type: "title" }, { name: "Statut", type: "select" },
          { name: "Montant", type: "number" }, { name: "Client", type: "email" },
          { name: "Nom", type: "rich_text" }, { name: "Téléphone", type: "phone_number" },
          { name: "Adresse", type: "rich_text" }, { name: "Ville", type: "rich_text" },
          { name: "Code postal", type: "rich_text" }, { name: "Pays", type: "rich_text" },
          { name: "Date", type: "date" }
        ]);
        setMsg("Base « Commandes » créée et configurée !");
      } else { setMsg(d?.error || "Échec de la création."); }
    } catch (e) { setMsg(e.message); }
    setCreating(false);
  };

  const [autoBusy, setAutoBusy] = useState(false);
  const [autoUrl, setAutoUrl] = useState("");
  const autoCreate = async () => {
    if (!projectId) return;
    setAutoBusy(true); setMsg(""); setAutoUrl("");
    try {
      const d = await api.launchNotionAuto(projectId);
      if (d?.ok && d.target) {
        setTarget(d.target);
        onSaved?.({ connected, target: d.target });
        setColumns([
          { name: "Produit", type: "title" }, { name: "Statut", type: "select" },
          { name: "Montant", type: "number" }, { name: "Client", type: "email" },
          { name: "Nom", type: "rich_text" }, { name: "Téléphone", type: "phone_number" },
          { name: "Adresse", type: "rich_text" }, { name: "Ville", type: "rich_text" },
          { name: "Code postal", type: "rich_text" }, { name: "Pays", type: "rich_text" },
          { name: "Date", type: "date" }
        ]);
        setAutoUrl(d.url || "");
        setMsg(`Base « Commandes » créée${d.parentTitle ? ` dans « ${d.parentTitle} »` : ""} et configurée !`);
      } else setMsg(d?.error || "Création automatique impossible.");
    } catch (e) { setMsg(e.message); }
    setAutoBusy(false);
  };

  const connect = async () => {
    setBusy(true); setMsg("");
    try {
      const d = await api.connectIntegration("notion");
      if (d?.redirectUrl) window.open(d.redirectUrl, "_blank", "noopener");
      setPages(null); // forcera un rechargement des pages après réautorisation
      setMsg("Dans l'onglet Notion : coche/ajoute les pages à partager avec l'intégration, valide jusqu'au bout. Puis reviens et clique « Charger mes pages ».");
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const save = async () => {
    if (!projectId) return;
    setBusy(true); setMsg("");
    try {
      await api.launchNotionSave(projectId, target.trim());
      onSaved?.({ connected, target: target.trim() });
      setMsg("Enregistré.");
      setTimeout(onClose, 600);
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-delt-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-delt-text"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-2px]"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
          <h3 className="text-base font-bold text-delt-text flex-1">Notion — journal des commandes</h3>
          <button onClick={onClose} className="text-delt-muted hover:text-delt-text"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <p className="text-[13px] text-delt-muted">
          À chaque commande <b>payée</b> dans ton app, une entrée « Statut : Payé » est créée automatiquement dans ta page Notion.
        </p>

        <div className="flex items-center justify-between rounded-xl border border-delt-border/70 px-3 py-2">
          <span className="text-sm font-medium text-delt-text">Compte Notion</span>
          {connected
            ? <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-600">Connecté ✓</span>
                <button onClick={connect} disabled={busy}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                  🔑 Réaccorder l'accès
                </button>
              </div>
            : <div className="flex items-center gap-2">
                {notion?.status && notion.status !== "ACTIVE" && (
                  <span className="text-[10px] font-semibold text-amber-600">{notion.status === "EXPIRED" ? "Expiré" : notion.status}</span>
                )}
                <button onClick={connect} disabled={busy} className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-delt-text disabled:opacity-50">
                  {notion?.status ? "Reconnecter" : "Connecter"}
                </button>
              </div>}
        </div>

        {/* Full auto : zéro manip Notion — la base est créée et branchée en 1 clic */}
        {connected && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <button onClick={autoCreate} disabled={autoBusy}
              className="w-full px-4 py-2.5 rounded-full text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50">
              {autoBusy ? "Création de la base…" : "Tout créer pour moi (recommandé)"}
            </button>
            <p className="text-[11px] text-delt-muted text-center">
              Je crée la base « Commandes » dans ton Notion, je la connecte au projet, et je te donne le lien. Rien à faire.
            </p>
            {autoUrl && (
              <a href={autoUrl} target="_blank" rel="noreferrer"
                className="block text-center text-[12px] font-semibold text-indigo-600 hover:underline truncate">
                Ouvrir ma base dans Notion →
              </a>
            )}
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-delt-muted uppercase">ID de la page (ou base) Notion cible</label>
          <input value={target} onChange={(e) => setTarget(e.target.value)}
            placeholder="ex: 1a2b3c4d5e6f7g8h9i0j…"
            className="mt-1 w-full text-sm rounded-lg border border-delt-border px-3 py-2 outline-none focus:border-indigo-400" />
          <p className="text-[10px] text-delt-muted mt-1">Colle l'URL Notion ou l'ID. Si c'est une <b>base</b>, je remplis les vraies colonnes ; si c'est une page, j'ajoute une entrée détaillée.</p>
        </div>

        {/* Détection du schéma : montre que l'IA lit ton tableau */}
        <div>
          <button onClick={detect} disabled={detecting || !connected || !target.trim()}
            className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40">
            {detecting ? "Lecture du tableau…" : "🔍 Détecter mes colonnes"}
          </button>
          {Array.isArray(columns) && (
            <div className="mt-2 rounded-xl border border-delt-border/70 p-2 space-y-1">
              <div className="text-[10px] font-bold uppercase text-delt-muted">Colonnes détectées · mapping auto</div>
              {columns.map((c) => {
                const mapped = NOTION_FIELD_OF(c.name);
                return (
                  <div key={c.name} className="flex items-center justify-between text-[12px]">
                    <span className="text-delt-text"><b>{c.name}</b> <span className="text-delt-muted">({c.type})</span></span>
                    {mapped
                      ? <span className="text-emerald-600 font-medium">← {mapped}</span>
                      : <span className="text-delt-muted/60">—</span>}
                  </div>
                );
              })}
            </div>
          )}
          {columns === null && (
            <div className="mt-2 text-[11px] text-delt-muted">Ce n'est pas une base (ou pas partagée avec l'intégration) → j'écrirai une <b>page</b> avec tous les détails de la commande.</div>
          )}
        </div>

        {/* Création auto de la base — choisis une page parmi tes pages Notion */}
        <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3 space-y-2">
          <div className="text-[12px] font-semibold text-delt-text">Pas de tableau ? Je le crée pour toi</div>
          <p className="text-[11px] text-delt-muted">Choisis une <b>page</b> Notion → je crée une base « Commandes » (Produit · Statut · Montant · Client · Date) dedans, déjà configurée.</p>
          {pages === null ? (
            <button onClick={loadPages} disabled={loadingPages || !connected}
              className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40">
              {loadingPages ? "Chargement…" : "Charger mes pages Notion"}
            </button>
          ) : pages.length === 0 ? (
            <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">Aucune page accessible. Clique <b>🔑 Réaccorder l'accès</b> ci-dessus et <b>coche les pages</b> à partager, puis recharge.</div>
          ) : (
            <div className="flex gap-2">
              <select value={parentId} onChange={(e) => setParentId(e.target.value)}
                className="flex-1 min-w-0 text-sm rounded-lg border border-delt-border px-2 py-1.5 outline-none focus:border-indigo-400 bg-white">
                {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <button onClick={createDb} disabled={creating || !parentId}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>
                {creating ? "Création…" : "Créer la base"}
              </button>
            </div>
          )}
        </div>

        {msg && <div className="text-[12px] text-delt-muted">{msg}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-full text-xs font-semibold text-delt-muted hover:text-delt-text">Fermer</button>
          <button onClick={save} disabled={busy || !target.trim()}
            className="px-4 py-1.5 rounded-full text-xs font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sélecteur de profils Launch (couleurs + icônes SVG, sans marques) ────────
function ProfileIcon({ profile, size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={profile.color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={profile.path} />
    </svg>
  );
}

function ProfileMenu({ value, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const sel = selected || LAUNCH_PROFILES[0];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full glass-pill font-semibold text-delt-text hover:shadow-sm transition-all text-[11px] px-2.5 py-1">
        <span className="w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${sel.color}1f` }}>
          <ProfileIcon profile={sel} size={11} />
        </span>
        <span className="truncate max-w-[120px]">{sel.name}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-delt-muted">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl glass-strong shadow-xl border border-delt-border/60 p-1.5">
          {LAUNCH_PROFILES.map((p) => (
            <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors ${value === p.id ? "bg-delt-surface" : "hover:bg-delt-surface/60"}`}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${p.color}1f` }}>
                <ProfileIcon profile={p} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold truncate" style={{ color: value === p.id ? p.color : undefined }}>{p.name}</span>
                  {p.models.length > 1 && <span className="text-[8px] font-bold uppercase tracking-wide px-1 py-px rounded text-white flex-shrink-0" style={{ background: p.color }}>Auto</span>}
                </span>
                <span className="block text-[10px] text-delt-muted truncate">{p.tagline}</span>
              </span>
              {value === p.id && (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={p.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sélecteur du modèle d'images (plafonné à Nano Banana 2) ─────────────────
function ImageModelMenu({ models, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const sel = models.find((m) => m.id === value) || models[0];
  if (!models.length) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} title="Modèle de génération d'images"
        className="inline-flex items-center gap-1.5 rounded-full glass-pill font-semibold text-delt-text hover:shadow-sm transition-all text-[11px] px-2.5 py-1">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
        <span className="truncate max-w-[110px]">{sel?.display || "Image"}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-delt-muted"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 bottom-full z-30 mb-2 w-64 rounded-2xl glass-strong shadow-xl border border-delt-border/60 p-2">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-delt-muted">Images générées</div>
          {models.map((m) => (
            <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${value === m.id ? "bg-indigo-50" : "hover:bg-delt-surface"}`}>
              <span className="min-w-0">
                <span className={`block text-sm truncate ${value === m.id ? "text-delt-accent font-semibold" : "text-delt-text"}`}>{m.display}</span>
                {m.tagline && <span className="block text-[10px] text-delt-muted truncate">{m.tagline}</span>}
              </span>
              <span className="text-[9px] font-bold text-delt-muted flex-shrink-0">{m.cost} Cr</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
