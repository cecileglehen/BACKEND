import { getDb } from "./db.js";
import { zipFiles } from "./zip.js";

// Stockage 100 % DB (Supabase/Postgres) : le filesystem Render est éphémère.
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const KIMI_MODEL      = "moonshotai/kimi-k2.7-code";
const CODESTRAL_MODEL = "mistralai/codestral-2508";
const GEMINI_MODEL    = "google/gemini-3-flash-preview";
const ALLOWED_CODE_MODELS = new Set([KIMI_MODEL, CODESTRAL_MODEL, GEMINI_MODEL]);
const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 2_000_000;
const MAX_ACTIONS = 80;

// URL publique du backend (pour les images Flux Schnell embeddables dans les apps).
const PUBLIC_API = (process.env.PUBLIC_API_URL || "https://deltai-backend.onrender.com").replace(/\/$/, "");

// ─── Scaffold Vite + React (mode "react") ────────────────────────────────────
// Base runnable garantie : l'IA n'a qu'à remplir src/. Ces fichiers sont écrits
// AVANT les actions du modèle, qui peuvent les écraser (ex: ajouter des deps).
const REACT_SCAFFOLD = {
  "package.json": JSON.stringify({
    name: "launch-app",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "vite --host", build: "vite build", preview: "vite preview" },
    dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
    devDependencies: { "@vitejs/plugin-react": "^4.3.4", vite: "^5.4.10" }
  }, null, 2),
  "vite.config.js": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" : assets en chemins relatifs → le build fonctionne servi sous un
// sous-dossier (deltai.fr/<slug> ou /sites/<slug>).
export default defineConfig({ base: "./", plugins: [react()], server: { host: true } });
`,
  "index.html": `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Launch App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  "src/main.jsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  "src/index.css": `:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
`,
  "src/App.jsx": `export default function App() {
  return <div style={{ padding: 24 }}>Hello Launch</div>;
}
`
};

const REACT_SYSTEM_PROMPT = `Tu es Kimi, un codeur IA full-stack. Tu réponds uniquement avec un objet JSON valide, sans markdown.

Objectif: créer/modifier une vraie application web Vite + React 18 (exécutée en live dans le navigateur via WebContainer).

Le scaffold de base existe déjà : package.json, vite.config.js, index.html, src/main.jsx, src/index.css, src/App.jsx.
Tu n'as donc PAS besoin de les recréer sauf si tu veux les modifier.

Format exact:
{
  "summary": "résumé court de l'app",
  "actions": [
    { "type": "write_file", "path": "src/App.jsx", "content": "export default function App(){...}" },
    { "type": "write_file", "path": "src/components/Header.jsx", "content": "..." }
  ],
  "run": { "entry": "src/App.jsx", "instructions": "npm install && npm run dev" }
}

Règles:
- Écris une app React fonctionnelle et complète dans src/ (App.jsx + composants dans src/components/).
- Utilise des imports relatifs (./components/X.jsx, ./index.css).
- Style : CSS dans src/index.css ou style inline. N'utilise PAS Tailwind ni de lib CSS externe (pas de build dispo).
- Si tu as besoin d'une dépendance npm, RÉÉCRIS package.json en l'ajoutant aux dependencies (version exacte connue et stable).
- Pas de chemin absolu, jamais de .. dans les paths.
- Garde l'app compacte mais réelle et belle.
- Auth managée : un SDK src/launch.js est FOURNI automatiquement (ne le crée pas, ne le modifie pas).
  Pour ajouter login/inscription, importe-le : import { LaunchAuth } from "./launch.js";
  Méthodes : await LaunchAuth.signup(email, password, name), await LaunchAuth.login(email, password),
  LaunchAuth.loginWithGoogle(), await LaunchAuth.me() (→ user ou null), LaunchAuth.logout(),
  LaunchAuth.isLoggedIn(). Les sessions sont persistées automatiquement. Utilise-le dès que
  l'app a besoin de comptes utilisateurs — ne réimplémente JAMAIS l'auth toi-même.
- Base de données managée : le même src/launch.js exporte LaunchDB (persistance auto, pas de backend à écrire).
  import { LaunchDB } from "./launch.js";
  await LaunchDB.list("todos")            → tableau de documents { id, ...champs }
  await LaunchDB.list("todos", { mine:true }) → seulement ceux de l'utilisateur connecté
  await LaunchDB.create("todos", { text:"...", done:false }) → document créé (avec id)
  await LaunchDB.update("todos", id, { done:true }) ; await LaunchDB.remove("todos", id)
  Utilise LaunchDB pour TOUTE persistance (listes, posts, paramètres…) — n'utilise PAS localStorage
  pour les données partagées, ni une API/DB inventée.
- Paiements : le même src/launch.js exporte LaunchPay. Pour vendre quelque chose :
  import { LaunchPay } from "./launch.js";
  await LaunchPay.checkout(amountCents, "Nom du produit")   // amountCents en centimes : 999 = 9,99€
  → redirige vers Stripe Checkout puis revient sur l'app. N'invente pas d'intégration Stripe toi-même.
  (Si le créateur n'a pas connecté Stripe, l'appel renvoie une erreur "Paiements non configurés" — gère-la
  proprement avec un message.)
- Images IA (Flux Schnell) : pour toute image (héros, illustration, vignette, avatar, fond),
  utilise DIRECTEMENT cette URL dans un tag <img> — pas de fetch, pas de clé requise :
  <img src="${PUBLIC_API}/api/launch/img?prompt=PROMPT_ENCODE" alt="..." />
  où PROMPT_ENCODE est encodeURIComponent(ta description en anglais). Exemple :
  <img src="${PUBLIC_API}/api/launch/img?prompt=modern%20minimalist%20office%20hero%20banner" />
  Rapide et économique. Utilise-le librement pour rendre les apps belles et illustrées.
- Réponds uniquement JSON.`;

const SYSTEM_PROMPT = `Tu es Kimi, un codeur IA. Tu dois répondre uniquement avec un objet JSON valide, sans markdown.

Objectif: créer/modifier un petit projet de code téléchargeable.

Format exact:
{
  "summary": "résumé court du projet",
  "actions": [
    { "type": "create_folder", "path": "src" },
    { "type": "write_file", "path": "src/index.js", "content": "console.log('hello')" },
    { "type": "delete_file", "path": "old.txt" },
    { "type": "delete_folder", "path": "old-folder" }
  ],
  "run": {
    "entry": "src/index.js",
    "instructions": "commande ou explication courte pour lancer le projet"
  }
}

Règles:
- Utilise des chemins relatifs uniquement.
- Ne mets jamais de chemin absolu, jamais de .. dans les paths.
- Crée tous les fichiers nécessaires dans les actions write_file.
- Tu peux écrire dans n'importe quel langage demandé.
- Pour un projet HTML/CSS/JS, crée une page d'accueil index.html.
- Si tu crées plusieurs pages HTML comme pricing.html, relie-les depuis index.html avec des liens relatifs simples, par exemple href="pricing.html".
- Pour HTML/CSS/JS, utilise des fichiers séparés quand c'est utile et des chemins relatifs qui fonctionnent en preview.
- Garde le projet compact mais complet.
- Images IA (Flux Schnell) : embarque-les directement, sans clé :
  <img src="${PUBLIC_API}/api/launch/img?prompt=DESCRIPTION_ENCODE_EN_ANGLAIS" alt="..." />
  Idéal pour illustrations, héros, vignettes. Rapide et économique.
- Réponds uniquement JSON.`;

function parseJsonObject(raw) {
  const text = String(raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("Le modèle n'a pas renvoyé un JSON valide.");
  }
}

async function requestRing(prompt, jsonMode = true, modelId = KIMI_MODEL, systemPrompt = SYSTEM_PROMPT) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  // Accepte n'importe quel modèle OpenRouter (id "fournisseur/modele"), défaut Kimi.
  const model = (typeof modelId === "string" && modelId.includes("/")) ? modelId : KIMI_MODEL;

  const body = {
    model,
    temperature: 0.2,
    usage: { include: true }, // coût réel ($) renvoyé dans usage.cost (facturation)
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: String(prompt || "").slice(0, 12000) }
    ]
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(OR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://delt.ai",
      "X-Title": "DELT AI"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = new Error(`Codegen ${res.status}: ${text.slice(0, 220)}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

async function callRing(prompt, modelId = KIMI_MODEL, systemPrompt = SYSTEM_PROMPT) {
  let data;
  try {
    data = await requestRing(prompt, true, modelId, systemPrompt);
  } catch (e) {
    if (![400, 422].includes(e.status)) throw e;
    data = await requestRing(prompt, false, modelId, systemPrompt);
  }

  const content = data?.choices?.[0]?.message?.content ?? "";
  return { plan: parseJsonObject(content), raw: data };
}

// Compte les lignes ajoutées / supprimées entre deux versions (LCS sur lignes).
function lineDiffStats(oldStr, newStr) {
  const a = String(oldStr || "").split("\n");
  const b = String(newStr || "").split("\n");
  const m = a.length, n = b.length;
  if (m * n > 4_000_000) return { added: Math.max(0, n - m), removed: Math.max(0, m - n) };
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs = dp[m][n];
  return { added: n - lcs, removed: m - lcs };
}

// Appel OpenRouter en streaming. Émet onPath(path) dès qu'un nouveau "path" JSON
// apparaît dans le flux, et renvoie le contenu complet + usage à la fin.
async function streamModel({ prompt, modelId, systemPrompt, onPath }) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  const model = (typeof modelId === "string" && modelId.includes("/")) ? modelId : KIMI_MODEL;

  const res = await fetch(OR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://delt.ai",
      "X-Title": "DELT AI"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      stream: true,
      usage: { include: true },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(prompt || "").slice(0, 12000) }
      ]
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = new Error(`Codegen ${res.status}: ${text.slice(0, 220)}`);
    error.status = res.status;
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", content = "", usage = null;
  const seen = new Set();
  const pathRe = /"path"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

  const scanPaths = () => {
    let m;
    while ((m = pathRe.exec(content))) {
      const p = m[1];
      if (p && !seen.has(p)) { seen.add(p); onPath?.(p); }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.usage) usage = obj.usage;
        const delta = obj.choices?.[0]?.delta?.content;
        if (delta) { content += delta; scanPaths(); }
      } catch { /* chunk partiel, ignoré */ }
    }
  }
  return { content, usage };
}

// Extrait tokens + coût réel ($) de la réponse OpenRouter, pour la facturation.
function extractUsage(raw, plan) {
  const u = raw?.usage || {};
  return {
    tokensIn: Number(u.prompt_tokens) || 0,
    tokensOut: Number(u.completion_tokens) || Math.ceil(JSON.stringify(plan || {}).length / 4),
    costUsd: Number(u.cost) || 0
  };
}

// ─── Helpers stockage DB ──────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f-]{36}$/i;

function cleanRelPath(p) {
  const c = String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!c || c.includes("\0") || c.split("/").includes("..")) throw new Error(`Chemin refusé: ${p}`);
  return c;
}

function scaffoldMap() {
  return new Map(Object.entries(REACT_SCAFFOLD));
}

// SDK d'auth managée injecté dans chaque app (projectId baké). L'app importe
// { LaunchAuth } from "./launch.js" — auth login/signup/google sans config.
function launchSdkSource(projectId) {
  return `// SDK Launch — auth managée (auto-généré, ne pas modifier).
const API = "${PUBLIC_API}";
const PROJECT = "${projectId}";
const KEY = "launch_token_" + PROJECT;
const getToken = () => localStorage.getItem(KEY);
const setToken = (t) => t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY);

// Récupère le token au retour OAuth (?launch_token=...)
(function () {
  try {
    const u = new URL(window.location.href);
    const t = u.searchParams.get("launch_token");
    if (t) { setToken(t); u.searchParams.delete("launch_token"); window.history.replaceState({}, "", u.toString()); }
  } catch (e) {}
})();

async function req(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  if (getToken()) headers.Authorization = "Bearer " + getToken();
  const r = await fetch(API + "/api/launch/" + PROJECT + path, Object.assign({}, opts, { headers }));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || r.statusText);
  return d;
}

export const LaunchAuth = {
  async signup(email, password, name) { const d = await req("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) }); setToken(d.token); return d.user; },
  async login(email, password) { const d = await req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); setToken(d.token); return d.user; },
  loginWithGoogle() { window.location.href = API + "/api/launch/auth/google?projectId=" + PROJECT + "&redirect=" + encodeURIComponent(window.location.href); },
  async me() { if (!getToken()) return null; try { const d = await req("/auth/me"); return d.user; } catch (e) { setToken(null); return null; } },
  logout() { setToken(null); },
  isLoggedIn() { return !!getToken(); }
};

// Base de données managée (documents). Persiste automatiquement, scopé à l'app.
export const LaunchDB = {
  async list(collection, opts) {
    opts = opts || {};
    const q = [];
    if (opts.mine) q.push("mine=1");
    if (opts.limit) q.push("limit=" + opts.limit);
    const d = await req("/db/" + collection + (q.length ? "?" + q.join("&") : ""));
    return d.items;
  },
  create(collection, data) { return req("/db/" + collection, { method: "POST", body: JSON.stringify(data) }); },
  get(collection, id) { return req("/db/" + collection + "/" + id); },
  update(collection, id, data) { return req("/db/" + collection + "/" + id, { method: "PATCH", body: JSON.stringify(data) }); },
  remove(collection, id) { return req("/db/" + collection + "/" + id, { method: "DELETE" }); }
};

// Paiements (Stripe). amount en centimes. Redirige vers Stripe Checkout.
export const LaunchPay = {
  async checkout(amount, label, opts) {
    opts = opts || {};
    const d = await req("/pay/checkout", { method: "POST", body: JSON.stringify({
      amount, label,
      currency: opts.currency || "eur",
      quantity: opts.quantity || 1,
      successUrl: opts.successUrl || window.location.href,
      cancelUrl: opts.cancelUrl || window.location.href
    }) });
    if (d.url) window.location.href = d.url;
    return d;
  }
};
`;
}

function injectLaunchSdk(map, projectId) {
  map.set("src/launch.js", launchSdkSource(projectId));
}

// Map(path → content) → applique les actions du modèle (mutation en place).
function applyActionsToMap(map, actions) {
  if (!Array.isArray(actions) || actions.length === 0) throw new Error("Aucune action de code reçue.");
  if (actions.length > MAX_ACTIONS) throw new Error("Trop d'actions générées.");
  for (const action of actions) {
    const type = String(action?.type || "");
    if (type === "create_folder") continue;
    const clean = cleanRelPath(action?.path);
    if (type === "delete_file") { map.delete(clean); continue; }
    if (type === "delete_folder") {
      for (const k of [...map.keys()]) if (k === clean || k.startsWith(clean + "/")) map.delete(k);
      continue;
    }
    if (type === "write_file") {
      const content = String(action?.content ?? "");
      if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) throw new Error(`Fichier trop gros: ${clean}`);
      map.set(clean, content);
      continue;
    }
    throw new Error(`Action inconnue: ${type}`);
  }
  let total = 0;
  for (const c of map.values()) {
    total += Buffer.byteLength(c, "utf8");
    if (total > MAX_TOTAL_BYTES) throw new Error("Projet généré trop volumineux.");
  }
}

function filesList(map) {
  return [...map.entries()]
    .map(([p, content]) => ({ path: p, bytes: Buffer.byteLength(content, "utf8") }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function projectContext(map) {
  const snippets = [];
  let total = 0;
  for (const [p, content] of map) {
    if (Buffer.byteLength(content, "utf8") > 80_000) continue;
    total += content.length;
    if (total > 180_000) break;
    snippets.push(`--- ${p} ---\n${content}`);
  }
  return snippets.join("\n\n");
}

async function getProject(userId, id) {
  if (!UUID_RE.test(String(id))) throw new Error("Session invalide");
  const db = getDb();
  const { rows } = await db.query(`SELECT id, mode FROM launch_projects WHERE id=$1 AND user_id=$2`, [id, userId]);
  if (!rows[0]) throw new Error("Projet introuvable");
  return rows[0];
}

async function loadFilesMap(projectId) {
  const db = getDb();
  const { rows } = await db.query(`SELECT path, content FROM launch_files WHERE project_id=$1`, [projectId]);
  return new Map(rows.map((r) => [r.path, r.content]));
}

async function saveFilesMap(projectId, map) {
  const db = getDb();
  await db.query(`DELETE FROM launch_files WHERE project_id=$1`, [projectId]);
  const entries = [...map.entries()];
  if (entries.length === 0) return;
  const tuples = entries.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`);
  const vals = [];
  for (const [p, content] of entries) vals.push(p, content, Buffer.byteLength(content, "utf8"));
  await db.query(`INSERT INTO launch_files (project_id, path, content, bytes) VALUES ${tuples.join(",")}`, [projectId, ...vals]);
}

// Émet les diffs (lignes +/-) par fichier touché.
function emitDiffs(plan, oldMap, emit) {
  for (const action of (plan.actions || [])) {
    if (action?.type === "write_file") {
      const p = cleanRelPath(action.path);
      const { added, removed } = lineDiffStats(oldMap.get(p) || "", String(action.content ?? ""));
      emit?.({ type: "file", path: p, op: oldMap.has(p) ? "update" : "create", added, removed });
    } else if (action?.type === "delete_file") {
      const p = cleanRelPath(action.path);
      emit?.({ type: "file", path: p, op: "delete", added: 0, removed: String(oldMap.get(p) || "").split("\n").length });
    }
  }
}

export async function getCodeSessionFiles(userId, sessionId) {
  await getProject(userId, sessionId);
  const map = await loadFilesMap(sessionId);
  return [...map.entries()]
    .map(([p, content]) => ({ path: p, content, bytes: Buffer.byteLength(content, "utf8") }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// ─── Persistance des projets (table launch_projects + launch_files) ──────────
export async function listCodeSessions(userId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT id, name, summary, mode, created_at, updated_at
     FROM launch_projects WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name || r.summary || "Projet sans nom",
    summary: r.summary || "",
    mode: r.mode || "react",
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime()
  }));
}

export async function deleteCodeSession(userId, sessionId) {
  if (!UUID_RE.test(String(sessionId))) throw new Error("Session invalide");
  const db = getDb();
  await db.query(`DELETE FROM launch_projects WHERE id=$1 AND user_id=$2`, [sessionId, userId]);
  return { ok: true };
}

export async function renameCodeSession(userId, sessionId, name) {
  if (!UUID_RE.test(String(sessionId))) throw new Error("Session invalide");
  const db = getDb();
  await db.query(
    `UPDATE launch_projects SET name=$3, updated_at=NOW() WHERE id=$1 AND user_id=$2`,
    [sessionId, userId, String(name || "").slice(0, 80) || "Projet"]
  );
  return { ok: true };
}

// Crée la ligne projet + persiste les fichiers. Renvoie l'id.
async function insertProject(userId, { summary, prompt, mode, run }) {
  const db = getDb();
  const { rows } = await db.query(
    `INSERT INTO launch_projects (user_id, name, summary, prompt, mode, run)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [userId, summary.slice(0, 80), summary, String(prompt || "").slice(0, 300), mode, run ? JSON.stringify(run) : null]
  );
  return rows[0].id;
}

async function touchProject(userId, id, { summary, run }) {
  const db = getDb();
  await db.query(
    `UPDATE launch_projects SET summary=$3, run=COALESCE($4, run), updated_at=NOW() WHERE id=$1 AND user_id=$2`,
    [id, userId, summary, run ? JSON.stringify(run) : null]
  );
}

export async function createCodeSession(userId, prompt, modelId = KIMI_MODEL, mode = "static") {
  const isReact = mode === "react";
  const map = isReact ? scaffoldMap() : new Map();
  const { plan, raw } = await callRing(prompt, modelId, isReact ? REACT_SYSTEM_PROMPT : SYSTEM_PROMPT);
  applyActionsToMap(map, plan.actions);
  const usage = extractUsage(raw, plan);
  const summary = String(plan.summary || "Projet généré par Kimi");
  const id = await insertProject(userId, { summary, prompt, mode, run: plan.run });
  injectLaunchSdk(map, id);
  await saveFilesMap(id, map);
  return { id, model: modelId, mode, summary, run: plan.run ?? null, files: filesList(map), tokensOut: usage.tokensOut, usage };
}

export async function editCodeSession(userId, sessionId, prompt, modelId = KIMI_MODEL, mode = "static") {
  const proj = await getProject(userId, sessionId);
  const isReact = mode === "react" || proj.mode === "react";
  const map = await loadFilesMap(sessionId);
  const editPrompt = `Projet actuel:\n${projectContext(map)}\n\nModification demandée:\n${String(prompt || "").slice(0, 12000)}\n\nRéponds avec le même JSON d'actions. Modifie uniquement ce qui est nécessaire.`;
  const { plan, raw } = await callRing(editPrompt, modelId, isReact ? REACT_SYSTEM_PROMPT : SYSTEM_PROMPT);
  applyActionsToMap(map, plan.actions);
  const usage = extractUsage(raw, plan);
  const summary = String(plan.summary || "Projet modifié par Kimi");
  await touchProject(userId, sessionId, { summary, run: plan.run });
  injectLaunchSdk(map, sessionId);
  await saveFilesMap(sessionId, map);
  return { id: sessionId, model: modelId, mode: proj.mode, summary, run: plan.run ?? null, files: filesList(map), tokensOut: usage.tokensOut, usage };
}

export async function createCodeSessionStream(userId, prompt, modelId, mode, emit) {
  const isReact = mode === "react";
  const map = isReact ? scaffoldMap() : new Map();
  const oldMap = new Map(map);
  emit?.({ type: "status", text: "Génération du code…" });
  const { content, usage } = await streamModel({
    prompt, modelId,
    systemPrompt: isReact ? REACT_SYSTEM_PROMPT : SYSTEM_PROMPT,
    onPath: (p) => emit?.({ type: "action", path: p })
  });
  const plan = parseJsonObject(content);
  applyActionsToMap(map, plan.actions);
  emitDiffs(plan, oldMap, emit);
  const summary = String(plan.summary || "Projet généré");
  const id = await insertProject(userId, { summary, prompt, mode, run: plan.run });
  injectLaunchSdk(map, id);
  await saveFilesMap(id, map);
  const u = extractUsage({ usage }, plan);
  return { id, model: modelId, mode, summary, run: plan.run ?? null, files: filesList(map), tokensOut: u.tokensOut, usage: u };
}

export async function editCodeSessionStream(userId, sessionId, prompt, modelId, mode, emit) {
  const proj = await getProject(userId, sessionId);
  const isReact = mode === "react" || proj.mode === "react";
  const map = await loadFilesMap(sessionId);
  const oldMap = new Map(map);
  const editPrompt = `Projet actuel:\n${projectContext(map)}\n\nModification demandée:\n${String(prompt || "").slice(0, 12000)}\n\nRéponds avec le même JSON d'actions. Modifie uniquement ce qui est nécessaire.`;
  emit?.({ type: "status", text: "Application des modifications…" });
  const { content, usage } = await streamModel({
    prompt: editPrompt, modelId,
    systemPrompt: isReact ? REACT_SYSTEM_PROMPT : SYSTEM_PROMPT,
    onPath: (p) => emit?.({ type: "action", path: p })
  });
  const plan = parseJsonObject(content);
  applyActionsToMap(map, plan.actions);
  emitDiffs(plan, oldMap, emit);
  const summary = String(plan.summary || "Projet modifié");
  await touchProject(userId, sessionId, { summary, run: plan.run });
  injectLaunchSdk(map, sessionId);
  await saveFilesMap(sessionId, map);
  const u = extractUsage({ usage }, plan);
  return { id: sessionId, model: modelId, mode: proj.mode, summary, run: plan.run ?? null, files: filesList(map), tokensOut: u.tokensOut, usage: u };
}

export async function getCodeZip(userId, sessionId) {
  await getProject(userId, sessionId);
  const map = await loadFilesMap(sessionId);
  return zipFiles([...map.entries()].map(([p, content]) => ({ path: p, content })));
}

export async function getCodePreviewFile(userId, sessionId, filePath) {
  await getProject(userId, sessionId);
  const clean = cleanRelPath(filePath || "index.html");
  const map = await loadFilesMap(sessionId);
  if (!map.has(clean)) throw new Error("Fichier preview introuvable");
  return { path: clean, content: map.get(clean) };
}
