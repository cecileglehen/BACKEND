import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { zipDirectory } from "./zip.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_ROOT = path.join(__dirname, "..", "data", "code-sessions");
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const KIMI_MODEL      = "moonshotai/kimi-k2.7-code";
const CODESTRAL_MODEL = "mistralai/codestral-2508";
const GEMINI_MODEL    = "google/gemini-3-flash-preview";
const ALLOWED_CODE_MODELS = new Set([KIMI_MODEL, CODESTRAL_MODEL, GEMINI_MODEL]);
const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 2_000_000;
const MAX_ACTIONS = 80;

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

export default defineConfig({ plugins: [react()], server: { host: true } });
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

// Écrit les fichiers de base d'un projet Vite+React (avant les actions du modèle)
async function scaffoldReact(root) {
  for (const [rel, content] of Object.entries(REACT_SCAFFOLD)) {
    const { target } = safeTarget(root, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }
}

// Lit le contenu de tous les fichiers (pour montage WebContainer)
async function readAllFiles(root) {
  const files = await listProjectFiles(root);
  const out = [];
  for (const file of files) {
    if (file.bytes > MAX_FILE_BYTES) continue;
    const content = await fs.readFile(path.join(root, file.path), "utf8").catch(() => "");
    out.push({ path: file.path, content, bytes: file.bytes });
  }
  return out;
}

export async function getCodeSessionFiles(userId, sessionId) {
  const id = String(sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Session invalide");
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  await fs.access(root);
  return readAllFiles(root);
}

// ─── Persistance des projets (métadonnées hors arbre de fichiers) ────────────
const META_DIR = "_meta";

async function writeMeta(userId, id, data) {
  const dir = path.join(SESSIONS_ROOT, String(userId), META_DIR);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  let prev = {};
  try { prev = JSON.parse(await fs.readFile(file, "utf8")); } catch { /* nouveau */ }
  const merged = { ...prev, ...data };
  await fs.writeFile(file, JSON.stringify(merged), "utf8");
  return merged;
}

async function readMeta(userId, id) {
  try {
    return JSON.parse(await fs.readFile(path.join(SESSIONS_ROOT, String(userId), META_DIR, `${id}.json`), "utf8"));
  } catch { return null; }
}

export async function listCodeSessions(userId) {
  const base = path.join(SESSIONS_ROOT, String(userId));
  let entries = [];
  try { entries = await fs.readdir(base, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || !/^[0-9a-f-]{36}$/i.test(e.name)) continue;
    const meta = await readMeta(userId, e.name);
    out.push({
      id: e.name,
      name: meta?.name || meta?.summary || "Projet sans nom",
      summary: meta?.summary || "",
      mode: meta?.mode || "react",
      createdAt: meta?.createdAt || 0,
      updatedAt: meta?.updatedAt || meta?.createdAt || 0
    });
  }
  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return out;
}

export async function deleteCodeSession(userId, sessionId) {
  const id = String(sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Session invalide");
  await fs.rm(path.join(SESSIONS_ROOT, String(userId), id), { recursive: true, force: true });
  await fs.rm(path.join(SESSIONS_ROOT, String(userId), META_DIR, `${id}.json`), { force: true });
  return { ok: true };
}

export async function renameCodeSession(userId, sessionId, name) {
  const id = String(sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Session invalide");
  return writeMeta(userId, id, { name: String(name || "").slice(0, 80) || "Projet", updatedAt: Date.now() });
}

function safeTarget(root, relativePath) {
  const clean = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) {
    throw new Error(`Chemin refusé: ${relativePath}`);
  }
  const target = path.resolve(root, clean);
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw new Error(`Chemin hors session refusé: ${relativePath}`);
  }
  return { clean, target };
}

async function applyActions(root, actions) {
  if (!Array.isArray(actions) || actions.length === 0) throw new Error("Aucune action de code reçue.");
  if (actions.length > MAX_ACTIONS) throw new Error("Trop d'actions générées.");

  const files = [];
  let totalBytes = 0;

  for (const action of actions) {
    const type = String(action?.type || "");
    const { clean, target } = safeTarget(root, action?.path);

    if (type === "create_folder") {
      await fs.mkdir(target, { recursive: true });
      continue;
    }

    if (type === "delete_file") {
      await fs.rm(target, { force: true });
      continue;
    }

    if (type === "delete_folder") {
      await fs.rm(target, { recursive: true, force: true });
      continue;
    }

    if (type === "write_file") {
      const content = String(action?.content ?? "");
      const bytes = Buffer.byteLength(content, "utf8");
      if (bytes > MAX_FILE_BYTES) throw new Error(`Fichier trop gros: ${clean}`);
      totalBytes += bytes;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error("Projet généré trop volumineux.");
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf8");
      files.push({ path: clean, bytes });
      continue;
    }

    throw new Error(`Action inconnue: ${type}`);
  }

  return files;
}

async function listProjectFiles(root, dir = root) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listProjectFiles(root, fullPath));
    } else if (entry.isFile()) {
      const stat = await fs.stat(fullPath);
      files.push({
        path: path.relative(root, fullPath).split(path.sep).join("/"),
        bytes: stat.size
      });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function readProjectContext(root) {
  const files = await listProjectFiles(root);
  const snippets = [];
  let total = 0;
  for (const file of files) {
    if (file.bytes > 80_000) continue;
    const target = path.join(root, file.path);
    const content = await fs.readFile(target, "utf8").catch(() => "");
    total += content.length;
    if (total > 180_000) break;
    snippets.push(`--- ${file.path} ---\n${content}`);
  }
  return snippets.join("\n\n");
}

export async function createCodeSession(userId, prompt, modelId = KIMI_MODEL, mode = "static") {
  const id = crypto.randomUUID();
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  await fs.mkdir(root, { recursive: true });

  const isReact = mode === "react";
  if (isReact) await scaffoldReact(root);

  const { plan, raw } = await callRing(prompt, modelId, isReact ? REACT_SYSTEM_PROMPT : SYSTEM_PROMPT);
  await applyActions(root, plan.actions);
  const files = await listProjectFiles(root);
  const usage = extractUsage(raw, plan);

  const summary = String(plan.summary || "Projet généré par Kimi");
  const now = Date.now();
  await writeMeta(userId, id, {
    name: summary.slice(0, 80),
    summary,
    prompt: String(prompt || "").slice(0, 300),
    mode,
    createdAt: now,
    updatedAt: now
  });

  return {
    id,
    model: modelId,
    mode,
    summary,
    run: plan.run ?? null,
    files,
    tokensOut: usage.tokensOut,
    usage
  };
}

export async function editCodeSession(userId, sessionId, prompt, modelId = KIMI_MODEL, mode = "static") {
  const id = String(sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Session invalide");
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  await fs.access(root);

  const isReact = mode === "react";
  const currentProject = await readProjectContext(root);
  const editPrompt = `Projet actuel:\n${currentProject}\n\nModification demandée:\n${String(prompt || "").slice(0, 12000)}\n\nRéponds avec le même JSON d'actions. Modifie uniquement ce qui est nécessaire.`;
  const { plan, raw } = await callRing(editPrompt, modelId, isReact ? REACT_SYSTEM_PROMPT : SYSTEM_PROMPT);
  await applyActions(root, plan.actions);
  const files = await listProjectFiles(root);
  const usage = extractUsage(raw, plan);

  const summary = String(plan.summary || "Projet modifié par Kimi");
  await writeMeta(userId, id, { summary, updatedAt: Date.now() });

  return {
    id,
    model: modelId,
    mode,
    summary,
    run: plan.run ?? null,
    files,
    tokensOut: usage.tokensOut,
    usage
  };
}

// Construit un objet session à partir d'un plan + applique les actions, en émettant
// les diffs par fichier. `emit` : callback SSE. `oldMap` : contenus avant édition.
async function finalizePlan({ userId, id, root, plan, modelId, mode, oldMap, emit, isEdit }) {
  await applyActions(root, plan.actions);

  for (const action of (plan.actions || [])) {
    if (action?.type !== "write_file") continue;
    const p = String(action.path || "").replace(/^\/+/, "");
    const { added, removed } = lineDiffStats(oldMap[p] || "", String(action.content ?? ""));
    emit?.({ type: "file", path: p, op: oldMap[p] != null ? "update" : "create", added, removed });
  }
  for (const action of (plan.actions || [])) {
    if (action?.type === "delete_file") {
      const p = String(action.path || "").replace(/^\/+/, "");
      const removed = String(oldMap[p] || "").split("\n").length;
      emit?.({ type: "file", path: p, op: "delete", added: 0, removed });
    }
  }

  const files = await listProjectFiles(root);
  const summary = String(plan.summary || (isEdit ? "Projet modifié" : "Projet généré"));
  if (isEdit) await writeMeta(userId, id, { summary, updatedAt: Date.now() });
  else await writeMeta(userId, id, { name: summary.slice(0, 80), summary, mode, createdAt: Date.now(), updatedAt: Date.now() });

  return { id, model: modelId, mode, summary, run: plan.run ?? null, files };
}

export async function createCodeSessionStream(userId, prompt, modelId, mode, emit) {
  const id = crypto.randomUUID();
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  await fs.mkdir(root, { recursive: true });

  const isReact = mode === "react";
  if (isReact) await scaffoldReact(root);
  const oldMap = Object.fromEntries((await readAllFiles(root)).map((f) => [f.path, f.content]));

  emit?.({ type: "status", text: "Génération du code…" });
  const { content, usage } = await streamModel({
    prompt, modelId,
    systemPrompt: isReact ? REACT_SYSTEM_PROMPT : SYSTEM_PROMPT,
    onPath: (p) => emit?.({ type: "action", path: p })
  });
  const plan = parseJsonObject(content);
  const session = await finalizePlan({ userId, id, root, plan, modelId, mode, oldMap, emit, isEdit: false });
  const u = extractUsage({ usage }, plan);
  return { ...session, tokensOut: u.tokensOut, usage: u };
}

export async function editCodeSessionStream(userId, sessionId, prompt, modelId, mode, emit) {
  const id = String(sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Session invalide");
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  await fs.access(root);

  const isReact = mode === "react";
  const oldFiles = await readAllFiles(root);
  const oldMap = Object.fromEntries(oldFiles.map((f) => [f.path, f.content]));
  const currentProject = oldFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");
  const editPrompt = `Projet actuel:\n${currentProject}\n\nModification demandée:\n${String(prompt || "").slice(0, 12000)}\n\nRéponds avec le même JSON d'actions. Modifie uniquement ce qui est nécessaire.`;

  emit?.({ type: "status", text: "Application des modifications…" });
  const { content, usage } = await streamModel({
    prompt: editPrompt, modelId,
    systemPrompt: isReact ? REACT_SYSTEM_PROMPT : SYSTEM_PROMPT,
    onPath: (p) => emit?.({ type: "action", path: p })
  });
  const plan = parseJsonObject(content);
  const session = await finalizePlan({ userId, id, root, plan, modelId, mode, oldMap, emit, isEdit: true });
  const u = extractUsage({ usage }, plan);
  return { ...session, tokensOut: u.tokensOut, usage: u };
}

export async function getCodeZip(userId, sessionId) {
  const id = String(sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Session invalide");
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  await fs.access(root);
  return zipDirectory(root);
}

export async function getCodePreviewFile(userId, sessionId, filePath) {
  const id = String(sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Session invalide");
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  const { clean, target } = safeTarget(root, filePath || "index.html");
  const stat = await fs.stat(target);
  if (!stat.isFile()) throw new Error("Fichier preview introuvable");
  return { path: clean, target };
}
