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
  register: (email, password) =>
    fetch(u("/api/auth/register"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ email, password }) }).then(json),
  login: (email, password) =>
    fetch(u("/api/auth/login"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ email, password }) }).then(json),
  me: () => fetch(u("/api/auth/me"), { headers: authHeaders() }).then(json),

  // Quota
  quota: () => fetch(u("/api/quota"), { headers: authHeaders() }).then(json),
  catalog: () => fetch(u("/api/catalog"), { headers: authHeaders() }).then(json),

  // Routage
  route: (message) =>
    fetch(u("/api/route"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ message }) }).then(json),

  // Chat
  chat: ({ messages, tier, modelId, manual }) =>
    fetch(u("/api/chat"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ messages, tier, modelId, manual }) }).then(json),

  // Subscribe
  subscribe: (plan) =>
    fetch(u(`/api/subscribe/${plan}`), { method: "POST", headers: authHeaders() }).then(json),
  confirmSubscription: (plan, sub) =>
    fetch(u(`/api/subscribe/confirm?plan=${plan}&sub=${sub}`), { headers: authHeaders() }).then(json),

  // Google OAuth via Supabase
  googleAuth: (accessToken) =>
    fetch(u("/api/auth/google"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) }).then(json),

  // Age verification
  ageVerify: () =>
    fetch(u("/api/age-verify"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ confirmed: true }) }).then(json),

  image: (prompt) =>
    fetch(u("/api/image"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt }) }).then(json),
  video: (prompt) =>
    fetch(u("/api/video"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt }) }).then(json),

  codeSession: (prompt) =>
    fetch(u("/api/code/session"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt }) }).then(json),
  codeEditSession: (id, prompt) =>
    fetch(u(`/api/code/session/${id}/edit`), { method: "POST", headers: authHeaders(), body: JSON.stringify({ prompt }) }).then(json),
  codeZip: (id) =>
    fetch(u(`/api/code/session/${id}.zip`), { headers: authHeaders() }).then(blob),
  codePreviewUrl: (id, filePath = "index.html") => {
    const safePath = String(filePath || "index.html").split("/").map(encodeURIComponent).join("/");
    const qs = _token ? `?token=${encodeURIComponent(_token)}` : "";
    return u(`/api/code/session/${id}/preview/${safePath}${qs}`);
  },

  // Health
  health: () => fetch(u("/api/health")).then(json)
};
