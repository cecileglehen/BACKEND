// Base URL backend — configurable via VITE_API_BASE (vide en dev = proxy Vite)
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const u = (path) => API_BASE + path;

// Token stocké en mémoire (jamais dans le DOM)
let _token = localStorage.getItem("delt_token") || null;

export function setToken(t) {
  _token = t;
  if (t) localStorage.setItem("delt_token", t);
  else localStorage.removeItem("delt_token");
}
export function getToken() { return _token; }

const json = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
  return data;
};

const blob = async (res) => {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
  }
  return res.blob();
};

function authHeaders() {
  const h = { "Content-Type": "application/json" };
  if (_token) h["Authorization"] = `Bearer ${_token}`;
  return h;
}

export const api = {
  // Auth
  register: (email, password, consents = {}) =>
    fetch(u("/api/auth/register"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ email, password, ...consents }) }).then(json),
  login: (email, password) =>
    fetch(u("/api/auth/login"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ email, password }) }).then(json),
  me: () => fetch(u("/api/auth/me"), { headers: authHeaders() }).then(json),

  // Projets
  listProjects:   () => fetch(u("/api/projects"), { headers: authHeaders() }).then(json),
  getProject:     (id) => fetch(u(`/api/projects/${id}`), { headers: authHeaders() }).then(json),
  createProject:  (data) => fetch(u("/api/projects"), { method: "POST", headers: authHeaders(), body: JSON.stringify(data) }).then(json),
  updateProject:  (id, data) => fetch(u(`/api/projects/${id}`), { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) }).then(json),
  deleteProject:  (id) => fetch(u(`/api/projects/${id}`), { method: "DELETE", headers: authHeaders() }).then(json),
  attachConversation: (convId, projectId) =>
    fetch(u(`/api/conversations/${convId}/project`), {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ projectId })
    }).then(json),

  // Agents IA personnalisés
  listAgents:  () => fetch(u("/api/agents"), { headers: authHeaders() }).then(json),
  getAgent:    (id) => fetch(u(`/api/agents/${id}`), { headers: authHeaders() }).then(json),
  createAgent: (data) => fetch(u("/api/agents"), { method: "POST", headers: authHeaders(), body: JSON.stringify(data) }).then(json),
  updateAgent: (id, data) => fetch(u(`/api/agents/${id}`), { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) }).then(json),
  deleteAgent: (id) => fetch(u(`/api/agents/${id}`), { method: "DELETE", headers: authHeaders() }).then(json),
  // Fichiers de connaissances (RAG)
  listAgentFiles: (id) => fetch(u(`/api/agents/${id}/files`), { headers: authHeaders() }).then(json),
  uploadAgentFile: (id, file) => {
    const form = new FormData();
    form.append("file", file);
    const headers = {};
    if (_token) headers["Authorization"] = `Bearer ${_token}`;
    return fetch(u(`/api/agents/${id}/files`), { method: "POST", headers, body: form }).then(json);
  },
  deleteAgentFile: (id, fileId) => fetch(u(`/api/agents/${id}/files/${fileId}`), { method: "DELETE", headers: authHeaders() }).then(json),

  // Mémoire utilisateur (nom + intérêts + ton)
  getMemory: () => fetch(u("/api/memory"), { headers: authHeaders() }).then(json),
  setMemory: ({ displayName, profile }) =>
    fetch(u("/api/memory"), {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ displayName, profile })
    }).then(json),

  // Packs de crédits prépayés (PAYG / top-up)
  creditPacks:   () => fetch(u("/api/credits/packs"), { headers: authHeaders() }).then(json),
  createCreditOrder: (pack) => fetch(u("/api/credits/order"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ pack }) }).then(json),
  captureCreditOrder: (orderId) => fetch(u("/api/credits/capture"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ orderId }) }).then(json),

  // Préférences modèles (mode auto)
  getModelPreferences: () => fetch(u("/api/preferences/models"), { headers: authHeaders() }).then(json),
  setModelPreferences: (preferences) =>
    fetch(u("/api/preferences/models"), {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ preferences })
    }).then(json),

  // Quota
  quota: () => fetch(u("/api/quota"), { headers: authHeaders() }).then(json),
  quotaBreakdown: () => fetch(u("/api/quota/breakdown"), { headers: authHeaders() }).then(json),

  // Usage detaillé
  usage: (period = "30d") => fetch(u(`/api/usage?period=${encodeURIComponent(period)}`), { headers: authHeaders() }).then(json),
  catalog: () => fetch(u("/api/catalog"), { headers: authHeaders() }).then(json),

  // Conversations chiffrées côté serveur
  listConversations: () => fetch(u("/api/conversations"), { headers: authHeaders() }).then(json),
  getConversation: (id) => fetch(u(`/api/conversations/${id}`), { headers: authHeaders() }).then(json),
  saveConversation: (id, messages, projectId) =>
    fetch(u(`/api/conversations/${id}`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ messages, ...(projectId !== undefined && { projectId }) })
    }).then(json),
  deleteConversation: (id) =>
    fetch(u(`/api/conversations/${id}`), { method: "DELETE", headers: authHeaders() }).then(json),

  // Routage
  route: (message) =>
    fetch(u("/api/route"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ message }) }).then(json),

  // Chat (non-streaming, fallback)
  chat: ({ messages, tier, modelId, manual, projectId }) =>
    fetch(u("/api/chat"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ messages, tier, modelId, manual, ...(projectId && { projectId }) }) }).then(json),

  // Deep Search (SSE streaming)
  deepSearch: ({ prompt, maxSources = 10, language = "fr", onInit, onStep, onSources, onReasoning, onDone, onError }) => {
    const ctrl = new AbortController();
    fetch(u("/api/deep-search"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ prompt, mode: "deep", maxSources, language }),
      signal: ctrl.signal
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError?.(new Error(data.error || res.statusText));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "init")        onInit?.(msg);
            else if (msg.type === "step")    onStep?.(msg);
            else if (msg.type === "sources") onSources?.(msg);
            else if (msg.type === "reasoning_graph") onReasoning?.(msg);
            else if (msg.type === "done")    onDone?.(msg.report);
            else if (msg.type === "error")   onError?.(new Error(msg.error));
          } catch { /* ignore */ }
        }
      }
    }).catch((e) => { if (e.name !== "AbortError") onError?.(e); });
    return () => ctrl.abort();
  },

  // Chat streaming SSE
  chatStream: ({ messages, tier, modelId, manual, projectId, agentId, enabledTools, onDelta, onThinking, onMeta, onDone, onError, onWebsearch, onArtifact, onImage, onTool }) => {
    const ctrl = new AbortController();
    fetch(u("/api/chat/stream"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ messages, tier, modelId, manual, ...(projectId && { projectId }), ...(agentId && { agentId }), ...(enabledTools && { enabledTools }) }),
      signal: ctrl.signal
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError?.(new Error(data.error || res.statusText));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "meta")     onMeta?.(msg);
            else if (msg.type === "done") onDone?.(msg);
            else if (msg.type === "error") onError?.(new Error(msg.error));
            else if (msg.type === "thinking") onThinking?.(msg.delta || "");
            else if (msg.type === "websearch") onWebsearch?.(msg);
            else if (msg.type === "artifact") onArtifact?.(msg);
            else if (msg.type === "image" || msg.type === "image_pending" || msg.type === "image_error") onImage?.(msg);
            else if (msg.type === "tool_call" || msg.type === "tool_result") onTool?.(msg);
            else if (msg.delta !== undefined) onDelta?.(msg.delta);
          } catch { /* ignore */ }
        }
      }
    }).catch((e) => { if (e.name !== "AbortError") onError?.(e); });
    return () => ctrl.abort();
  },

  // Mode débat — multi-agent séquentiel (SSE)
  debateStream: ({ question, agents, debateMode, rounds, onAgentStart, onAgentThinking, onAgentDelta, onAgentDone, onAgentError, onDebateDone, onError }) => {
    const ctrl = new AbortController();
    fetch(u("/api/chat/debate"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ question, agents, debateMode, rounds }),
      signal: ctrl.signal
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError?.(new Error(data.error || res.statusText));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "agent_start")  onAgentStart?.(msg);
            else if (msg.type === "agent_thinking") onAgentThinking?.(msg);
            else if (msg.type === "agent_delta") onAgentDelta?.(msg);
            else if (msg.type === "agent_done")  onAgentDone?.(msg);
            else if (msg.type === "agent_error") onAgentError?.(msg);
            else if (msg.type === "debate_done") onDebateDone?.(msg);
            else if (msg.type === "error") onError?.(new Error(msg.error));
          } catch { /* */ }
        }
      }
    }).catch((e) => { if (e.name !== "AbortError") onError?.(e); });
    return () => ctrl.abort();
  },

  // Fusion intelligente (SSE) — N réponses → 1 synthèse
  mergeStream: ({ question, responses, modelId, projectId, onDelta, onMeta, onDone, onError }) => {
    const ctrl = new AbortController();
    fetch(u("/api/chat/merge"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ question, responses, modelId, ...(projectId && { projectId }) }),
      signal: ctrl.signal
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError?.(new Error(data.error || res.statusText));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "meta")  onMeta?.(msg);
            else if (msg.type === "done")  onDone?.(msg);
            else if (msg.type === "error") onError?.(new Error(msg.error));
            else if (msg.delta !== undefined) onDelta?.(msg.delta);
          } catch { /* */ }
        }
      }
    }).catch((e) => { if (e.name !== "AbortError") onError?.(e); });
    return () => ctrl.abort();
  },

  // Subscribe
  subscribe: (plan) =>
    fetch(u(`/api/subscribe/${plan}`), { method: "POST", headers: authHeaders() }).then(json),
  confirmSubscription: (plan, sub) =>
    fetch(u(`/api/subscribe/confirm?plan=${plan}&sub=${sub}`), { headers: authHeaders() }).then(json),
  activateSubscription: (plan, subscriptionId) =>
    fetch(u("/api/subscribe/activate"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ plan, subscriptionId })
    }).then(json),
  paypalConfig: () => fetch(u("/api/paypal/config")).then(json),

  // Google OAuth via Supabase
  googleAuth: (accessToken, consents = {}) =>
    fetch(u("/api/auth/google"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, ...consents }) }).then(json),

  exportPrivacyData: () => fetch(u("/api/privacy/export"), { headers: authHeaders() }).then(json),
  deleteAccount: () =>
    fetch(u("/api/privacy/account"), { method: "DELETE", headers: authHeaders() }).then(json),

  // Age verification
  ageVerify: () =>
    fetch(u("/api/age-verify"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ confirmed: true }) }).then(json),

  image: (prompt, modelId, imageUrls) =>
    fetch(u("/api/image"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt, modelId, imageUrls }) }).then(json),
  video: (prompt, modelId) =>
    fetch(u("/api/video"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt, modelId }) }).then(json),

  music: (params) =>
    fetch(u("/api/music"), { method: "POST", headers: authHeaders(), body: JSON.stringify(params) }).then(json),

  codeSession: (prompt, modelId, mode) =>
    fetch(u("/api/code/session"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt, modelId, mode }) }).then(json),
  codeEditSession: (id, prompt, modelId, mode) =>
    fetch(u(`/api/code/session/${id}/edit`), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt, modelId, mode }) }).then(json),
  codeSessionFiles: (id) =>
    fetch(u(`/api/code/session/${id}/files?t=${Date.now()}`), { headers: authHeaders(), cache: "no-store" }).then(json),
  codeSessions: () =>
    fetch(u("/api/code/sessions"), { headers: authHeaders() }).then(json),
  launchProjectBySlug: (slug) =>
    fetch(u(`/api/launch/by-slug/${encodeURIComponent(slug)}`), { headers: authHeaders() }).then(json),
  launchPlan: ({ messages, projectId, modelId }) =>
    fetch(u("/api/launch/plan"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ messages, projectId, modelId }) }).then(json),
  launchUpload: (projectId, path, base64, contentType) =>
    fetch(u(`/api/launch/${projectId}/upload`), { method: "POST", headers: authHeaders(), body: JSON.stringify({ path, base64, contentType }) }).then(json),
  launchDeleteFile: (projectId, path) =>
    fetch(u(`/api/launch/${projectId}/file?path=${encodeURIComponent(path)}`), { method: "DELETE", headers: authHeaders() }).then(json),
  launchSetFavicon: (projectId, path) =>
    fetch(u(`/api/launch/${projectId}/favicon`), { method: "POST", headers: authHeaders(), body: JSON.stringify({ path }) }).then(json),
  launchVisualText: (projectId, oldText, newText) =>
    fetch(u(`/api/launch/${projectId}/visual-text`), { method: "POST", headers: authHeaders(), body: JSON.stringify({ oldText, newText }) }).then(json),
  launchGetChat: (projectId) =>
    fetch(u(`/api/launch/${projectId}/chat`), { headers: authHeaders() }).then(json),
  launchSaveChat: (projectId, chat) =>
    fetch(u(`/api/launch/${projectId}/chat`), { method: "PUT", headers: authHeaders(), body: JSON.stringify({ chat }) }).then(json),
  codeDeleteSession: (id) =>
    fetch(u(`/api/code/session/${id}`), { method: "DELETE", headers: authHeaders() }).then(json),
  codeRenameSession: (id, name) =>
    fetch(u(`/api/code/session/${id}`), { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ name }) }).then(json),
  // Streaming SSE : génération / édition avec progression + diffs par fichier
  codeStream: ({ id, prompt, modelId, mode = "react", imageModel, history, onStatus, onAction, onFile, onThinking, onDone, onError }) => {
    const path = id ? `/api/code/session/${id}/edit/stream` : "/api/code/session/stream";
    const ctrl = new AbortController();
    fetch(u(path), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt, modelId, mode, imageModel, history }), signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) { const d = await res.json().catch(() => ({})); onError?.(new Error(d.error || res.statusText)); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const msg = JSON.parse(line.slice(6));
              if (msg.type === "status") onStatus?.(msg.text);
              else if (msg.type === "thinking") onThinking?.(msg.delta);
              else if (msg.type === "action") onAction?.(msg.path);
              else if (msg.type === "file") onFile?.(msg);
              else if (msg.type === "done") onDone?.(msg.session);
              else if (msg.type === "error") onError?.(new Error(msg.error), msg);
            } catch { /* ignore */ }
          }
        }
      })
      .catch((e) => { if (e.name !== "AbortError") onError?.(e); });
    return () => ctrl.abort();
  },
  // URL d'un site déployé. Si VITE_SITES_DOMAIN est défini → sous-domaine
  // <slug>.<domaine> (ex: todo.deltai.fr). Sinon → backend /sites/<slug> (dev/proxy).
  siteUrl: (path) => {
    const domain = import.meta.env.VITE_SITES_DOMAIN;
    const m = String(path).match(/^\/sites\/([a-z0-9-]+)\/?$/i);
    if (domain && m) {
      const port = window.location.port && window.location.port !== "443" ? `:${window.location.port}` : "";
      return `https://${m[1]}.${domain}${port}/`;
    }
    return (API_BASE || window.location.origin.replace("://launch.", "://")) + path;
  },
  launchDeploy: (projectId, slug, files) =>
    fetch(u("/api/launch/deploy"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ projectId, slug, files }) }).then(json),
  launchUndeploy: (projectId) =>
    fetch(u(`/api/launch/${projectId}/deploy`), { method: "DELETE", headers: authHeaders() }).then(json),
  launchDeployStatus: (projectId) =>
    fetch(u(`/api/launch/${projectId}/deploy`), { headers: authHeaders() }).then(json),
  launchPayConnect: (returnUrl) =>
    fetch(u("/api/launch/pay/connect"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ returnUrl }) }).then(json),
  launchPayStatus: () =>
    fetch(u("/api/launch/pay/status"), { headers: authHeaders() }).then(json),
  launchNotionStatus: (projectId) =>
    fetch(u(`/api/launch/${projectId}/notion`), { headers: authHeaders() }).then(json),
  launchNotionSave: (projectId, target) =>
    fetch(u(`/api/launch/${projectId}/notion`), { method: "POST", headers: authHeaders(), body: JSON.stringify({ target }) }).then(json),
  launchNotionSchema: (projectId, target) =>
    fetch(u(`/api/launch/${projectId}/notion/schema?target=${encodeURIComponent(target)}`), { headers: authHeaders() }).then(json),
  launchNotionCreateDb: (projectId, parentId) =>
    fetch(u(`/api/launch/${projectId}/notion/create-db`), { method: "POST", headers: authHeaders(), body: JSON.stringify({ parentId }) }).then(json),
  launchNotionPages: (projectId) =>
    fetch(u(`/api/launch/${projectId}/notion/pages`), { headers: authHeaders() }).then(json),
  codeZip: (id) =>
    fetch(u(`/api/code/session/${id}.zip`), { headers: authHeaders() }).then(blob),
  codePreviewUrl: (id, filePath = "index.html") => {
    const safePath = String(filePath || "index.html").split("/").map(encodeURIComponent).join("/");
    const qs = _token ? `?token=${encodeURIComponent(_token)}` : "";
    return u(`/api/code/session/${id}/preview/${safePath}${qs}`);
  },

  // Transfert crédits plan ↔ API
  transferCredits: (amount, direction = "to_api") =>
    fetch(u("/api/credits/transfer"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ amount, direction })
    }).then(json),

  // API Keys (dashboard)
  listApiKeys: () => fetch(u("/api/keys"), { headers: authHeaders() }).then(json),

  // Intégrations Composio (Gmail, Drive, Notion…)
  listIntegrations: () => fetch(u("/api/integrations"), { headers: authHeaders() }).then(json),
  connectIntegration: (app) =>
    fetch(u(`/api/integrations/connect/${app}`), { method: "POST", headers: authHeaders() }).then(json),
  disconnectIntegration: (app) =>
    fetch(u(`/api/integrations/${app}`), { method: "DELETE", headers: authHeaders() }).then(json),
  createApiKey: (name) =>
    fetch(u("/api/keys"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ name }) }).then(json),
  revokeApiKey: (id) =>
    fetch(u(`/api/keys/${id}`), { method: "DELETE", headers: authHeaders() }).then(json),

  // Upload pièce jointe (image, PDF, texte) → renvoie l'objet parsé
  uploadFile: (file) => {
    const form = new FormData();
    form.append("file", file);
    const headers = {};
    if (_token) headers["Authorization"] = `Bearer ${_token}`;
    return fetch(u("/api/upload"), { method: "POST", headers, body: form }).then(json);
  },

  // Transcription (Groq Whisper)
  transcribe: (audioBlob) => {
    const form = new FormData();
    form.append("audio", audioBlob, "voice.webm");
    const headers = {};
    if (_token) headers["Authorization"] = `Bearer ${_token}`;
    return fetch(u("/api/transcribe"), { method: "POST", headers, body: form }).then(json);
  },

  // Health
  health: () => fetch(u("/api/health")).then(json)
};
