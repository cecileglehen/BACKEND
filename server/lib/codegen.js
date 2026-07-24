import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db.js";
import { skillBlockFor } from "./skillEngine.js";
import { zipFiles } from "./zip.js";

// Skills = instructions de codage externalisées (server/skills/*.md), éditables
// sans toucher au code. Chargées et fournies à l'IA comme prompt système.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "..", "skills");
const skillCache = new Map();
function loadSkill(name) {
  if (skillCache.has(name)) return skillCache.get(name);
  let txt = "";
  try { txt = fs.readFileSync(path.join(SKILLS_DIR, `${name}.md`), "utf8"); } catch { txt = ""; }
  txt = txt.split("${PUBLIC_API}").join(PUBLIC_API);
  skillCache.set(name, txt);
  return txt;
}

// Stockage 100 % DB (Supabase/Postgres) : le filesystem Render est éphémère.
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const KIMI_MODEL      = "moonshotai/kimi-k2.7-code";
const CODESTRAL_MODEL = "mistralai/codestral-2508";
const GEMINI_MODEL    = "google/gemini-3-flash-preview";
const ALLOWED_CODE_MODELS = new Set([KIMI_MODEL, CODESTRAL_MODEL, GEMINI_MODEL]);
const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 2_000_000;
const MAX_ACTIONS = 80;

// URL publique du backend (pour les images IA embeddables dans les apps).
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
    dependencies: { react: "^18.3.1", "react-dom": "^18.3.1", "react-router-dom": "^6.28.0" },
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
- Images IA (Gemini Flash Lite) : embarque-les directement, sans clé :
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
async function streamModel({ prompt, modelId, systemPrompt, onPath, onThinking }) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  const model = (typeof modelId === "string" && modelId.includes("/")) ? modelId : KIMI_MODEL;

  // Garde-fou anti-blocage : si le flux n'envoie plus rien pendant 60 s, on abandonne
  // (sinon une réflexion qui boucle laisserait l'UI figée indéfiniment).
  const ctrl = new AbortController();
  let idleTimer = null;
  const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => ctrl.abort(), 60000); };

  const res = await fetch(OR_URL, {
    method: "POST",
    signal: ctrl.signal,
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
      // Reasoning borné : un peu de « thinking » SANS laisser le modèle partir dans
      // une réflexion infinie qui l'empêche de produire le JSON (effort minimal).
      include_reasoning: true,
      reasoning: { effort: "low" },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        // 150k chars ≈ 37k tokens : laisse passer les fichiers du projet et les
        // read_file. (L'ancien cap 12k coupait les contenus lus APRÈS la limite
        // → le modèle relisait le même fichier en boucle sans jamais le voir.)
        { role: "user", content: String(prompt || "").slice(0, 150000) }
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

  resetIdle();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();
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
          const d = obj.choices?.[0]?.delta || {};
          const reasoning = d.reasoning ?? d.reasoning_content ?? "";
          if (reasoning) onThinking?.(reasoning);
          if (d.content) { content += d.content; scanPaths(); }
        } catch { /* chunk partiel, ignoré */ }
      }
    }
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error("Le modèle a mis trop de temps à répondre (inactivité). Réessaie.");
    throw e;
  } finally {
    clearTimeout(idleTimer);
  }
  return { content, usage };
}

// Fichiers du projet inlinés dans un prompt (budget borné). Évite au modèle de
// devoir read_file un par un : il voit directement l'état réel du code — c'est
// la condition pour qu'il édite juste (classes CSS existantes, imports, etc.).
const BINARY_EXT_RE = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp3|mp4|pdf|zip)$/i;
function projectFilesBlock(map, { maxFile = 12000, maxTotal = 90000 } = {}) {
  if (!map?.size) return "";
  let total = 0;
  const parts = [];
  for (const [p, c] of map) {
    if (typeof c !== "string" || BINARY_EXT_RE.test(p)) { parts.push(`--- ${p} --- (binaire)`); continue; }
    const body = c.length > maxFile ? `${c.slice(0, maxFile)}\n… (tronqué — ${c.length} caractères, read_file pour la suite)` : c;
    if (total + body.length > maxTotal) { parts.push(`--- ${p} --- (${c.length} caractères — non inclus, fais read_file si besoin)`); continue; }
    total += body.length;
    parts.push(`--- ${p} ---\n${body}`);
  }
  return `\n\n═══ FICHIERS ACTUELS DU PROJET (état réel — fie-toi à ça, pas à ta mémoire) ═══\n${parts.join("\n\n")}`;
}

// Classes utilisées dans le JSX/HTML touché mais sans AUCUNE règle CSS dans le
// projet → éléments ajoutés « nus », sans la DA du site. Sert de garde-fou :
// si on en trouve, une passe corrective force le modèle à les styler.
function orphanClassNames(map, touched) {
  const css = [...map.entries()].filter(([p]) => p.endsWith(".css")).map(([, c]) => String(c)).join("\n");
  const classes = new Set();
  for (const p of touched || []) {
    if (!/\.(jsx?|tsx?|html)$/.test(p)) continue;
    const src = String(map.get(p) || "");
    for (const m of src.matchAll(/class(?:Name)?=["']([^"']+)["']/g)) {
      for (const c of m[1].split(/\s+/)) {
        // Ignore les tokens dynamiques (template/ternaire) — indécidables statiquement.
        if (c && /^[A-Za-z_][\w-]*$/.test(c)) classes.add(c);
      }
    }
  }
  return [...classes].filter((c) => !new RegExp(`\\.${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(css));
}

// Contexte Notion du projet : cible configurée + schéma réel de la base.
// Injecté dans les prompts pour que l'IA ne demande JAMAIS l'ID à l'utilisateur
// (il est déjà configuré via le bouton Notion de l'IDE) et code sur les VRAIES
// colonnes. Silencieux si pas de cible ou si Notion ne répond pas.
async function notionContextBlock(userId, projectId, { autoCreate = false, appName = "", emit } = {}) {
  try {
    const { getProjectNotion, fetchNotionSchema, autoProvisionNotion, notionUrl } = await import("./launchIntegrations.js");
    const proj = await getProjectNotion(projectId);
    let target = proj?.notion_target;
    let createdUrl = null;
    if (!target && autoCreate) {
      // Full auto : l'IA crée la base elle-même (l'utilisateur n'a que l'OAuth
      // à faire) et donnera le lien dans sa réponse.
      emit?.({ type: "status", text: "Je crée ta base Notion « Commandes »…" });
      const r = await autoProvisionNotion(userId, projectId, appName);
      if (r.ok) {
        target = r.target;
        createdUrl = r.url;
        emit?.({ type: "status", text: `Base Notion créée dans « ${r.parentTitle} »` });
      } else if (r.notConnected) {
        return `\n\n═══ INTÉGRATION NOTION ═══\nNotion n'est PAS ENCORE connecté. Ne demande aucun ID : dis simplement à l'utilisateur de cliquer sur le bouton Notion en haut de l'IDE pour lier son compte — ensuite la base sera créée automatiquement pour lui.`;
      } else {
        return `\n\n═══ INTÉGRATION NOTION ═══\nCréation automatique de la base impossible : ${r.error}\nTransmets ce message à l'utilisateur tel quel, ne demande pas d'ID.`;
      }
    }
    if (!target) return "";
    const schema = await fetchNotionSchema(userId, target);
    const cols = schema?.length
      ? `Base de données — colonnes réelles : ${schema.map((c) => `${c.name} (${c.type})`).join(", ")}. Utilise EXACTEMENT ces noms de colonnes.`
      : "Cible = une page (pas une base) : LaunchIntegrations.notion.log(titre, markdown) y ajoute des sous-pages.";
    const createdNote = createdUrl
      ? `\nJe VIENS de créer cette base automatiquement — DONNE SON LIEN à l'utilisateur dans ton summary : ${createdUrl}`
      : `\nLien de la cible (si l'utilisateur le demande) : ${notionUrl(target)}`;
    return `\n\n═══ INTÉGRATION NOTION DU PROJET (déjà configurée) ═══\nUne cible Notion est DÉJÀ connectée à ce projet côté serveur — ne demande JAMAIS son ID à l'utilisateur.\n${cols}${createdNote}\nDans le code de l'app, LaunchIntegrations.notion.* utilise cette cible par défaut : passe null comme databaseId (ex: LaunchIntegrations.notion.insertRow(null, {...}), .listRows(null)) et le serveur route vers la base configurée.`;
  } catch { return ""; }
}

// Stream → parse JSON → applique les actions sur une COPIE de baseMap, avec retry.
// Si le JSON est invalide OU si un edit_file ne matche pas, on renvoie l'erreur au
// modèle pour qu'il se corrige. L'usage est cumulé ; en échec final l'erreur le porte
// (pour facturer les tokens consommés). Application transactionnelle (copie → commit).
async function generatePlan({ prompt, modelId, systemPrompt, baseMap, onPath, onThinking, allowEmptyActions, emit }) {
  const total = { tokensIn: 0, tokensOut: 0, costUsd: 0 };
  const add = (u) => {
    if (!u) return;
    total.tokensIn += Number(u.prompt_tokens) || 0;
    total.tokensOut += Number(u.completion_tokens) || 0;
    total.costUsd += Number(u.cost) || 0;
  };
  let lastErr = "";
  let readBlock = "";        // contenus fournis suite aux read_file du modèle
  let readRounds = 0;        // max 2 tours de lecture (anti-boucle)
  const providedReads = new Set(); // chemins déjà fournis → jamais relus
  for (let attempt = 0; attempt < 4; attempt++) {
    const p = (attempt === 0 || !lastErr ? prompt : `${prompt}\n\n⚠️ Erreur sur ta réponse précédente: ${lastErr}\nRenvoie UNIQUEMENT le JSON valide demandé. Pour edit_file, "search" doit être un extrait EXACT (copié caractère pour caractère) du fichier actuel.`)
      + readBlock;
    const { content, usage } = await streamModel({ prompt: p, modelId, systemPrompt, onPath, onThinking });
    add(usage);
    try {
      const plan = parseJsonObject(content);
      const map = new Map(baseMap);               // copie : on ne commit qu'en cas de succès
      let actions = Array.isArray(plan.actions) ? plan.actions : [];

      // ── L'IA décide ELLE-MÊME de lire : action read_file en plein flux ──
      // Dédup : un fichier déjà fourni n'est JAMAIS relu (anti-boucle « Je lis
      // src/index.css » à l'infini quand le modèle redemande la même chose).
      const reads = actions.filter((a) => a?.type === "read_file" && a.path);
      const newReads = reads
        .map((r) => cleanRelPath(String(r.path)))
        .filter((p, i, arr) => arr.indexOf(p) === i && !providedReads.has(p));
      if (newReads.length > 0 && readRounds < 2) {
        readRounds++;
        const parts = [];
        for (const clean of newReads.slice(0, 5)) {
          providedReads.add(clean);
          const cur = baseMap.get(clean);
          emit?.({ type: "status", text: `Je lis ${clean}` });
          parts.push(`--- ${clean} ---\n${cur ?? "(fichier inexistant — fichiers du projet : " + [...baseMap.keys()].join(", ") + ")"}`);
        }
        readBlock += `\n\n═══ FICHIERS LUS (suite à tes read_file) ═══\n${parts.join("\n\n")}\n═══ Continue : renvoie maintenant le JSON complet avec tes write_file/edit_file. ═══`;
        lastErr = "";
        continue; // re-tour avec le contenu lu
      }
      if (reads.length > 0 && newReads.length === 0) {
        // Que des re-lectures de fichiers déjà fournis → on ne reboucle pas.
        lastErr = `Les fichiers ${reads.map((r) => cleanRelPath(String(r.path))).join(", ")} sont DÉJÀ fournis plus haut dans « FICHIERS LUS » ou « FICHIERS ACTUELS DU PROJET ». Ne les redemande pas : renvoie maintenant tes actions write_file/edit_file.`;
        continue;
      }
      actions = actions.filter((a) => a?.type !== "read_file"); // reads épuisés/ignorés

      // Question/discussion : le modèle peut répondre sans code (actions vides).
      if (actions.length === 0 && allowEmptyActions) {
        return { plan, map, touched: [], usage: total };
      }
      // Garde-fou anti-esquive : demande actionnable + aucune action = refusé.
      // (Le modèle répondait « Salut ! Dis-moi ce que tu veux » à de vraies
      // demandes malgré le prompt — on le renvoie travailler.)
      if (actions.length === 0) {
        lastErr = "Tu n'as renvoyé AUCUNE action alors que le message de l'utilisateur est une demande de modification. Ce n'est PAS une salutation. EXÉCUTE la demande maintenant avec des actions write_file/edit_file (ou read_file si tu dois d'abord lire un fichier).";
        continue;
      }
      const touched = applyActionsToMap(map, actions);
      return { plan, map, touched, usage: total };
    } catch (e) { lastErr = e.message; }
  }
  const err = new Error(`L'IA n'a pas produit une modification valide (${lastErr}). Réessaie ou reformule.`);
  err.usage = total;
  throw err;
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
      shipping: !!opts.shipping, // true = Stripe collecte l'adresse de LIVRAISON
      successUrl: opts.successUrl || window.location.href,
      cancelUrl: opts.cancelUrl || window.location.href
    }) });
    if (d.url) window.location.href = d.url;
    return d;
  }
};

// Intégrations du créateur (Notion…). Best-effort : enveloppe tes appels en try/catch.
const _notionRun = async (action, args) => {
  try { return await req("/integrations/notion", { method: "POST", body: JSON.stringify({ action, args: args || {} }) }); }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
};
export const LaunchIntegrations = {
  notion: {
    // Crée une page (titre + corps markdown) dans le Notion du créateur.
    log: (title, content) => _notionRun("createPage", { title, markdown: content }),
    // Crée une base. columns = [{ name, type }] (types: title, rich_text, number, select, date, email, checkbox…). 1 colonne 'title' obligatoire.
    createDatabase: (parentPageId, title, columns) => _notionRun("createDatabase", { parent_id: parentPageId, title, properties: columns }),
    // Ajoute une colonne à une base existante (type: rich_text, number, select, date, email, checkbox…).
    addColumn: (databaseId, name, type) => _notionRun("updateSchema", { database_id: databaseId, properties: [{ name, new_type: type || "rich_text" }] }),
    // Ajoute une ligne. properties = [{ name, type, value }] — noms/types EXACTS du schéma (sensible casse).
    insertRow: (databaseId, properties) => _notionRun("insertRow", { database_id: databaseId, properties }),
    // Liste les lignes d'une base. opts = { page_size, sorts } (optionnel).
    listRows: (databaseId, opts) => _notionRun("query", Object.assign({ database_id: databaseId }, opts || {})),
    // Met à jour une ligne. properties = [{ name, type, value }].
    updateRow: (rowId, properties) => _notionRun("updateRow", { row_id: rowId, properties })
  }
};
`;
}

function injectLaunchSdk(map, projectId) {
  map.set("src/launch.js", launchSdkSource(projectId));
}

// Charge les pièces jointes @référencées (public/nom.ext) en data URIs, pour les
// passer comme images d'entrée à Seedream (édition image-à-image).
async function loadAttachmentDataUris(projectId, names) {
  const uris = [];
  for (const name of names) {
    const { rows } = await getDb().query(
      `SELECT content, content_type FROM launch_files
        WHERE project_id=$1 AND path LIKE $2 AND encoding='base64' LIMIT 1`,
      [projectId, `public/${name}.%`]
    );
    if (rows[0]) uris.push(`data:${rows[0].content_type || "image/png"};base64,${rows[0].content}`);
  }
  return uris;
}

// Matérialise les images IA : remplace les URLs /api/launch/img?... par de vrais
// fichiers (public/ai-N.ext). Sans &edit → text-to-image ; avec &edit=noms → Seedream.
async function materializeAiImages(projectId, map, imageModelId) {
  const re = /(?:https?:\/\/[^\s"'`)]+)?\/api\/launch\/img\?([^\s"'`)]+)/g;
  const urls = new Map(); // fullUrl -> queryString
  for (const content of map.values()) {
    let m;
    while ((m = re.exec(content))) urls.set(m[0], m[1]);
  }
  if (!urls.size) return;

  const { generateImage, resolveLaunchImageModel, SEEDREAM_EDIT_ID } = await import("./imagegen.js");
  const imgModel = resolveLaunchImageModel(imageModelId);
  const MAX_AI_IMAGE_BYTES = 8_000_000; // images IA = plus lourdes que du code (Nano Banana ~1-3 Mo)
  const entries = [...urls.entries()].slice(0, 8); // cap anti-coût/latence
  const results = await Promise.all(entries.map(async ([fullUrl, qs], idx) => {
    try {
      const params = new URLSearchParams(qs);
      const prompt = (params.get("prompt") || "").trim();
      if (!prompt) return null;
      // &edit=nom1,nom2 → édition image-à-image (Seedream) à partir des pièces jointes
      const editNames = (params.get("edit") || "").split(",").map((s) => s.trim()).filter(Boolean);
      let url;
      if (editNames.length) {
        const imageUrls = await loadAttachmentDataUris(projectId, editNames);
        if (!imageUrls.length) return null;
        ({ url } = await generateImage(SEEDREAM_EDIT_ID, prompt, { imageUrls }));
      } else {
        ({ url } = await generateImage(imgModel, prompt));
      }
      if (!url) return null;
      // Nano Banana/Gemini renvoient une data URL base64 ; Flux une URL http.
      let buf, ext;
      if (url.startsWith("data:")) {
        const m = url.match(/^data:image\/([a-z0-9]+);base64,(.+)$/is);
        if (!m) return null;
        ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
        buf = Buffer.from(m[2], "base64");
      } else {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        buf = Buffer.from(await resp.arrayBuffer());
        ext = (url.match(/\.(jpe?g|png|webp|gif)/i)?.[1] || "jpg").toLowerCase();
      }
      if (!buf.length || buf.length > MAX_AI_IMAGE_BYTES) return null;
      const fname = `ai-${idx + 1}.${ext}`;
      await getDb().query(
        `INSERT INTO launch_files (project_id, path, content, bytes, encoding, content_type)
         VALUES ($1,$2,$3,$4,'base64',$5)
         ON CONFLICT (project_id, path) DO UPDATE SET content=$3, bytes=$4, encoding='base64', content_type=$5`,
        [projectId, `public/${fname}`, buf.toString("base64"), buf.length, `image/${ext === "jpg" ? "jpeg" : ext}`]
      );
      return { fullUrl, localPath: `/${fname}` };
    } catch { return null; }
  }));

  const replacements = new Map();
  for (const r of results) if (r) replacements.set(r.fullUrl, r.localPath);
  if (!replacements.size) return;
  for (const [path, content] of map) {
    let c = content;
    for (const [fullUrl, localPath] of replacements) c = c.split(fullUrl).join(localPath);
    if (c !== content) map.set(path, c);
  }
}

// Titre d'onglet = nom de l'app + favicon SVG distinct (lettre + couleur dérivée du nom).
function setAppBranding(map, name) {
  let html = map.get("index.html");
  if (!html) return;
  const clean = String(name || "App").slice(0, 60).replace(/[<>]/g, "").trim() || "App";
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${clean}</title>`);
  if (!/rel=["']icon["']/.test(html)) {
    const palette = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9"];
    const hash = [...clean].reduce((a, c) => a + c.charCodeAt(0), 0);
    const color = palette[hash % palette.length];
    const letter = clean[0].toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${color}"/><text x="16" y="22" font-size="18" font-family="sans-serif" font-weight="700" fill="white" text-anchor="middle">${letter}</text></svg>`;
    const link = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`;
    html = html.replace(/<\/head>/, `    ${link}\n  </head>`);
  }
  map.set("index.html", html);
}

// Applique un bloc search/replace (exact, puis tolérant aux espaces de fin de ligne).
function applyEditBlock(content, search, replace) {
  if (!search) return null;
  if (content.includes(search)) return content.replace(search, replace);
  const norm = (s) => String(s).replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
  const nc = norm(content), ns = norm(search);
  if (ns && nc.includes(ns)) return nc.replace(ns, norm(replace));
  return null;
}

// Map(path → content) → applique les actions du modèle (mutation en place).
// Renvoie l'ensemble des chemins touchés (pour les diffs).
function applyActionsToMap(map, actions) {
  if (!Array.isArray(actions) || actions.length === 0) throw new Error("Aucune action de code reçue.");
  if (actions.length > MAX_ACTIONS) throw new Error("Trop d'actions générées.");
  const touched = new Set();
  for (const action of actions) {
    const type = String(action?.type || "");
    if (type === "create_folder") continue;
    const clean = cleanRelPath(action?.path);
    if (type === "delete_file") { map.delete(clean); touched.add(clean); continue; }
    if (type === "delete_folder") {
      for (const k of [...map.keys()]) if (k === clean || k.startsWith(clean + "/")) { map.delete(k); touched.add(k); }
      continue;
    }
    if (type === "write_file") {
      const content = String(action?.content ?? "");
      if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) throw new Error(`Fichier trop gros: ${clean}`);
      map.set(clean, content); touched.add(clean);
      continue;
    }
    if (type === "edit_file") {
      const cur = map.get(clean);
      if (cur == null) throw new Error(`edit_file sur un fichier inexistant: ${clean}`);
      const next = applyEditBlock(cur, String(action?.search ?? ""), String(action?.replace ?? ""));
      if (next == null) {
        const err = new Error(`Bloc à remplacer introuvable dans ${clean} (le "search" doit être un extrait EXACT du fichier).`);
        err.code = "EDIT_NOT_FOUND";
        throw err;
      }
      map.set(clean, next); touched.add(clean);
      continue;
    }
    throw new Error(`Action inconnue: ${type}`);
  }
  let total = 0;
  for (const c of map.values()) {
    total += Buffer.byteLength(c, "utf8");
    if (total > MAX_TOTAL_BYTES) throw new Error("Projet généré trop volumineux.");
  }
  return touched;
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
  const { rows } = await db.query(`SELECT id, mode, slug FROM launch_projects WHERE id=$1 AND user_id=$2`, [id, userId]);
  if (!rows[0]) throw new Error("Projet introuvable");
  return rows[0];
}

// ─── Chat persisté par projet ─────────────────────────────────────────────────
export async function getProjectChat(userId, projectId) {
  if (!UUID_RE.test(String(projectId))) return [];
  const { rows } = await getDb().query(
    `SELECT chat FROM launch_projects WHERE id=$1 AND user_id=$2`, [projectId, userId]
  );
  const chat = rows[0]?.chat;
  return Array.isArray(chat) ? chat : [];
}

export async function saveProjectChat(userId, projectId, chat) {
  if (!UUID_RE.test(String(projectId))) throw new Error("Projet invalide");
  const trimmed = (Array.isArray(chat) ? chat : []).slice(-60); // garde les 60 derniers messages
  await getDb().query(
    `UPDATE launch_projects SET chat=$3 WHERE id=$1 AND user_id=$2`,
    [projectId, userId, JSON.stringify(trimmed)]
  );
  return { ok: true };
}

// Résout un slug → projet (pour l'URL launch.../p/<slug>).
export async function getProjectBySlug(userId, slug) {
  const { rows } = await getDb().query(
    `SELECT id, name, summary, mode, slug FROM launch_projects WHERE user_id=$1 AND slug=$2`,
    [userId, String(slug || "")]
  );
  if (!rows[0]) throw new Error("Projet introuvable");
  return rows[0];
}

// Charge UNIQUEMENT les fichiers texte (éditables par l'IA). Les binaires (images)
// sont gérés à part et ne passent jamais dans la map de l'IA.
async function loadFilesMap(projectId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT path, content FROM launch_files WHERE project_id=$1 AND encoding='utf8'`, [projectId]
  );
  return new Map(rows.map((r) => [r.path, r.content]));
}

// Persiste les fichiers texte SANS toucher aux binaires (qui survivent aux éditions IA).
async function saveFilesMap(projectId, map) {
  const db = getDb();
  await db.query(`DELETE FROM launch_files WHERE project_id=$1 AND encoding='utf8'`, [projectId]);
  const entries = [...map.entries()];
  if (entries.length === 0) return;
  const tuples = entries.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}, 'utf8')`);
  const vals = [];
  for (const [p, content] of entries) vals.push(p, content, Buffer.byteLength(content, "utf8"));
  await db.query(`INSERT INTO launch_files (project_id, path, content, bytes, encoding) VALUES ${tuples.join(",")}`, [projectId, ...vals]);
}

// Liste les chemins des fichiers binaires (pour le contexte IA + l'arbre).
async function listBinaryPaths(projectId) {
  const { rows } = await getDb().query(
    `SELECT path FROM launch_files WHERE project_id=$1 AND encoding='base64'`, [projectId]
  );
  return rows.map((r) => r.path);
}

// Ajoute/remplace un fichier binaire (image, logo…) en base64.
export async function addBinaryFile(userId, projectId, filePath, base64, contentType) {
  await getProject(userId, projectId);
  const clean = cleanRelPath(filePath);
  const bytes = Math.floor((String(base64).length * 3) / 4);
  if (bytes > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux (max 500 Ko).");
  await getDb().query(
    `INSERT INTO launch_files (project_id, path, content, bytes, encoding, content_type)
     VALUES ($1,$2,$3,$4,'base64',$5)
     ON CONFLICT (project_id, path) DO UPDATE SET content=$3, bytes=$4, encoding='base64', content_type=$5`,
    [projectId, clean, String(base64), bytes, contentType || "application/octet-stream"]
  );
  return { path: clean, bytes };
}

export async function deleteProjectFile(userId, projectId, filePath) {
  await getProject(userId, projectId);
  const clean = cleanRelPath(filePath);
  await getDb().query(`DELETE FROM launch_files WHERE project_id=$1 AND path=$2`, [projectId, clean]);
  return { ok: true };
}

// Visual Edits — remplacement de texte direct dans le source (gratuit, sans IA).
// Renvoie { found } : si le texte exact n'est pas trouvé, le client bascule sur l'IA.
export async function visualTextEdit(userId, projectId, oldText, newText) {
  await getProject(userId, projectId);
  const o = String(oldText ?? "");
  const n = String(newText ?? "");
  if (!o.trim()) throw new Error("Texte source vide");
  const map = await loadFilesMap(projectId);
  let changed = false;
  for (const [path, content] of map) {
    if (path === "src/launch.js") continue;
    if (content.includes(o)) { map.set(path, content.split(o).join(n)); changed = true; }
  }
  if (!changed) return { found: false };
  await saveFilesMap(projectId, map);
  return { found: true };
}

// Définit une image du projet comme favicon/logo (met à jour index.html).
export async function setProjectFavicon(userId, projectId, imagePath) {
  await getProject(userId, projectId);
  const map = await loadFilesMap(projectId);
  let html = map.get("index.html");
  if (!html) throw new Error("index.html introuvable");
  const href = "/" + cleanRelPath(imagePath).replace(/^public\//, "");
  if (/<link[^>]*rel=["']icon["'][^>]*>/.test(html)) {
    html = html.replace(/<link[^>]*rel=["']icon["'][^>]*>/, `<link rel="icon" href="${href}" />`);
  } else {
    html = html.replace(/<\/head>/, `    <link rel="icon" href="${href}" />\n  </head>`);
  }
  map.set("index.html", html);
  await saveFilesMap(projectId, map);
  return { ok: true, href };
}

// Émet les diffs (lignes +/-) pour chaque fichier touché (avant vs après).
function emitTouchedDiffs(touched, oldMap, newMap, emit) {
  for (const p of touched) {
    const before = oldMap.get(p);
    const after = newMap.get(p);
    if (after == null) {
      emit?.({ type: "file", path: p, op: "delete", added: 0, removed: String(before || "").split("\n").length });
    } else {
      const { added, removed } = lineDiffStats(before || "", after);
      emit?.({ type: "file", path: p, op: before == null ? "create" : "update", added, removed });
    }
  }
}

export async function getCodeSessionFiles(userId, sessionId) {
  await getProject(userId, sessionId);
  const { rows } = await getDb().query(
    `SELECT path, content, bytes, encoding, content_type FROM launch_files WHERE project_id=$1`, [sessionId]
  );
  return rows
    .map((r) => ({ path: r.path, content: r.content, bytes: r.bytes, encoding: r.encoding || "utf8", contentType: r.content_type || null }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// ─── Persistance des projets (table launch_projects + launch_files) ──────────
export async function listCodeSessions(userId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT id, name, summary, mode, slug, created_at, updated_at
     FROM launch_projects WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug || null,
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

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "app";
}

// Crée la ligne projet (slug unique) + renvoie { id, slug }.
async function insertProject(userId, { summary, prompt, mode, run }) {
  const db = getDb();
  const base = slugify(summary);
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const { rows } = await db.query(
        `INSERT INTO launch_projects (user_id, name, summary, prompt, mode, run, slug)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, slug`,
        [userId, summary.slice(0, 80), summary, String(prompt || "").slice(0, 300), mode, run ? JSON.stringify(run) : null, slug]
      );
      return rows[0];
    } catch (e) {
      if (e.code === "23505" && attempt < 5) continue; // collision slug → suffixe
      throw e;
    }
  }
  throw new Error("Impossible de générer un slug unique");
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
  const { plan, raw } = await callRing(prompt, modelId, withSkills(isReact ? loadSkill("launch-create") : SYSTEM_PROMPT, prompt, null, isReact ? ["react-vite", "design-ui"] : ["html-css-js", "design-ui"]));
  applyActionsToMap(map, plan.actions);
  const usage = extractUsage(raw, plan);
  const summary = String(plan.summary || "Projet généré par Kimi");
  const { id, slug } = await insertProject(userId, { summary, prompt, mode, run: plan.run });
  setAppBranding(map, plan.appName || summary.split(/[\s,.:;—-]+/).slice(0, 2).join(" "));
  await materializeAiImages(id, map).catch(() => {});
  injectLaunchSdk(map, id);
  await saveFilesMap(id, map);
  return { id, slug, model: modelId, mode, summary, questions: plan.questions ?? null, run: plan.run ?? null, files: filesList(map), tokensOut: usage.tokensOut, usage };
}

export async function editCodeSession(userId, sessionId, prompt, modelId = KIMI_MODEL, mode = "static") {
  const proj = await getProject(userId, sessionId);
  const isReact = mode === "react" || proj.mode === "react";
  const map = await loadFilesMap(sessionId);
  const editPrompt = `Projet actuel:\n${projectContext(map)}\n\nModification demandée:\n${String(prompt || "").slice(0, 12000)}\n\nRéponds avec le même JSON d'actions. Modifie uniquement ce qui est nécessaire.`;
  const { plan, raw } = await callRing(editPrompt, modelId, withSkills(isReact ? loadSkill("launch-edit") : SYSTEM_PROMPT, prompt, null, isReact ? ["react-vite"] : ["html-css-js"], 2));
  applyActionsToMap(map, plan.actions);
  const usage = extractUsage(raw, plan);
  const summary = String(plan.summary || "Projet modifié par Kimi");
  await touchProject(userId, sessionId, { summary, run: plan.run });
  injectLaunchSdk(map, sessionId);
  await saveFilesMap(sessionId, map);
  return { id: sessionId, slug: proj.slug, model: modelId, mode: proj.mode, summary, questions: plan.questions ?? null, run: plan.run ?? null, files: filesList(map), tokensOut: usage.tokensOut, usage };
}

// Mémoire conversationnelle : transforme l'historique du chat en bloc de contexte
// pour que le mode Code « se souvienne » de ce qui a été dit/décidé avant.
function historyBlock(history) {
  if (!Array.isArray(history) || !history.length) return "";
  const lines = history
    .filter((m) => m && m.text)
    .slice(-10)
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Toi"}: ${String(m.text).slice(0, 700)}`);
  if (!lines.length) return "";
  return `═══ HISTORIQUE (CONTEXTE SEULEMENT) ═══\nCe rappel sert UNIQUEMENT à comprendre les références (« le bouton », « ça », « comme avant »). Les demandes passées sont DÉJÀ traitées : ne les refais PAS, ne repars PAS dessus. Exécute UNIQUEMENT la demande actuelle indiquée plus bas.\n${lines.join("\n")}\n═══ FIN HISTORIQUE ═══\n\n`;
}

// Skills façon Claude Code : matche la demande contre la librairie
// (server/skills/library/*/SKILL.md), charge les corps à la demande et émet
// un événement { type:"skill" } par skill lu → l'UI affiche
// « Je lis le skill html-css-js/SKILL.md ». Le prompt de base reste léger.
function withSkills(systemPrompt, request, emit, include = [], max = 3) {
  // Budget serré (état de l'art : les perfs chutent au-delà de ~3k tokens de
  // prompt) : création = 3 skills max, édition = 2 max.
  const { block } = skillBlockFor(request, { max, emit, include });
  return block ? `${systemPrompt}${block}` : systemPrompt;
}

// Décompose une demande en étapes de construction (boucle agentique).
// 1 étape = demande simple → single-pass. 2-4 étapes = plan affiché + exécution
// séquentielle avec relecture des fichiers entre chaque étape (re-think).
async function planTodos(prompt, modelId) {
  const sys = 'Tu décomposes une demande de création d\'app en étapes de CONSTRUCTION. Réponds en JSON strict : {"todos":["…"]} — 2 à 4 étapes maximum, chacune concrète et livrable (ex : "Structure, navigation et hero", "Boutique : cartes produits + panier", "CSS global, responsive et animations", "États de chargement et messages d\'erreur"). Si la demande est SIMPLE (un composant, une petite page), renvoie UNE seule étape. Rien d\'autre que le JSON.';
  const empty = { tokensIn: 0, tokensOut: 0, costUsd: 0 };
  try {
    const data = await requestRing(prompt, true, modelId, sys);
    const u = data?.usage || {};
    const parsed = parseJsonObject(data?.choices?.[0]?.message?.content || "{}");
    const todos = Array.isArray(parsed.todos)
      ? parsed.todos.map((t) => String(t).trim()).filter(Boolean).slice(0, 4)
      : [];
    return { todos, usage: { tokensIn: Number(u.prompt_tokens) || 0, tokensOut: Number(u.completion_tokens) || 0, costUsd: Number(u.cost) || 0 } };
  } catch { return { todos: [], usage: empty }; }
}

export async function createCodeSessionStream(userId, prompt, modelId, mode, emit, imageModel, history) {
  const isReact = mode === "react";
  const baseMap = isReact ? scaffoldMap() : new Map();
  const systemPrompt = withSkills(
    isReact ? loadSkill("launch-create") : SYSTEM_PROMPT,
    prompt, emit,
    isReact ? ["react-vite", "design-ui"] : ["html-css-js", "design-ui"]
  );

  // ── Boucle agentique : plan → étape → re-think → étape… ──
  emit?.({ type: "status", text: "Je planifie la construction…" });
  const { todos, usage: planUsage } = await planTodos(prompt, modelId);
  const totals = { ...planUsage };
  const addUsage = (x) => { totals.tokensIn += x.tokensIn || 0; totals.tokensOut += x.tokensOut || 0; totals.costUsd += x.costUsd || 0; };

  let plan, map, touched;
  if (todos.length >= 2) {
    // Todolist visuelle (cases à cocher côté IDE) — la vérification est une étape à part entière.
    emit?.({ type: "todo_list", items: [
      ...todos.map((t, i) => ({ id: i + 1, label: t })),
      { id: "verify", label: "Vérification finale (imports, CSS, responsive)" }
    ] });
    map = new Map(baseMap);
    const summaries = [];
    let appName = null, run = null, questions = null;
    touched = new Set();
    for (let i = 0; i < todos.length; i++) {
      emit?.({ type: "todo_state", id: i + 1, status: "running" });
      emit?.({ type: "status", text: `Étape ${i + 1}/${todos.length} — ${todos[i]}` });
      const stepMarks = todos.map((t, j) => `${j < i ? "[fait]" : j === i ? "[EN COURS]" : "[à venir]"} ${j + 1}. ${t}`).join("\n");
      const stepPrompt = `${historyBlock(history)}DEMANDE GLOBALE :\n${prompt}\n\nPLAN DE CONSTRUCTION :\n${stepMarks}\n\nÉTAPE ACTUELLE (${i + 1}/${todos.length}) : ${todos[i]}\nLes fichiers du projet sont fournis ci-dessous : appuie-toi sur leur contenu RÉEL (classes CSS réellement stylées, imports valides), puis implémente UNIQUEMENT cette étape. Ne casse rien de ce qui existe : fichier existant → edit_file (jamais un write_file partiel qui effacerait le travail des étapes précédentes).\nSOIS COMPLET : du vrai contenu (jamais de lorem ipsum ni de placeholder « à compléter »), chaque section entièrement construite et stylée. Un site pro fait plusieurs centaines de lignes de CSS — livrer un squelette est un échec.${projectFilesBlock(map)}`;
      const prevMap = new Map(map);
      const r = await generatePlan({
        prompt: stepPrompt, modelId, baseMap: map, systemPrompt,
        onPath: (p) => emit?.({ type: "action", path: p }),
        onThinking: (delta) => emit?.({ type: "thinking", delta }),
        allowEmptyActions: true,
        emit
      });
      map = r.map;
      for (const t of r.touched || []) touched.add(t);
      addUsage(r.usage || {});
      if (r.plan?.summary) summaries.push(`Étape ${i + 1} — ${r.plan.summary}`);
      appName = appName || r.plan?.appName || null;
      run = r.plan?.run || run;
      questions = r.plan?.questions || questions;
      emitTouchedDiffs(r.touched, prevMap, map, emit);
      emit?.({ type: "todo_state", id: i + 1, status: "done" });
      emit?.({ type: "status", text: `Étape ${i + 1}/${todos.length} terminée — je relis avant d'enchaîner` });
    }
    // ── Phase VERIFY (façon Lovable) : relire tout, contrôler, se corriger ──
    emit?.({ type: "todo_state", id: "verify", status: "running" });
    emit?.({ type: "status", text: "Je vérifie mon travail (imports, CSS, responsive)…" });
    try {
      const reviewPrompt = `DEMANDE GLOBALE :\n${prompt}\n\nTu viens de terminer la construction — les fichiers du projet sont fournis ci-dessous, NE fais AUCUN read_file. PASSE DE VÉRIFICATION — contrôle chaque point :\n1. Chaque import pointe vers un fichier qui EXISTE (chemins/casse exacts).\n2. Chaque className utilisé dans le JSX a une règle dans le CSS (aucune classe orpheline).\n3. Aucun composant déclaré mais jamais rendu, aucun TODO/placeholder oublié.\n4. Responsive : la page tient sur mobile (grilles qui s'empilent).\n5. La demande globale est ENTIÈREMENT couverte.\nSi tu trouves des problèmes : corrige-les via des actions (edit_file/write_file) et liste-les dans summary. Si tout est bon : "actions": [] et summary = "Vérification OK".${projectFilesBlock(map)}`;
      const prevMap = new Map(map);
      const rv = await generatePlan({
        prompt: reviewPrompt, modelId, baseMap: map, systemPrompt,
        onPath: (p) => emit?.({ type: "action", path: p }),
        onThinking: (delta) => emit?.({ type: "thinking", delta }),
        allowEmptyActions: true,
        emit
      });
      map = rv.map;
      for (const t of rv.touched || []) touched.add(t);
      addUsage(rv.usage || {});
      emitTouchedDiffs(rv.touched, prevMap, map, emit);
      const fixes = (rv.touched || []).length;
      emit?.({ type: "todo_state", id: "verify", status: "done" });
      emit?.({ type: "status", text: fixes ? `Vérification : ${fixes} correction(s) appliquée(s)` : "Vérification OK — rien à corriger" });
      if (fixes && rv.plan?.summary) summaries.push(`Vérification — ${rv.plan.summary}`);
    } catch { emit?.({ type: "status", text: "Vérification sautée (erreur non bloquante)" }); }

    // ── Garde-fou DA (statique) : classes sans CSS après la vérification ──
    const orphansC = orphanClassNames(map, [...touched]).slice(0, 12);
    if (orphansC.length) {
      emit?.({ type: "status", text: `J'applique la DA aux éléments non stylés (${orphansC.length} classe(s))…` });
      try {
        const prevMap = new Map(map);
        const fix = await generatePlan({
          prompt: `Ces classes utilisées dans le JSX/HTML n'ont AUCUNE règle CSS : ${orphansC.join(", ")}.\nAjoute leurs styles (edit_file sur le CSS) en respectant STRICTEMENT la DA du site (mêmes variables, couleurs, radius, espacements, typo). Si une classe est déjà couverte (sélecteur parent, style inline volontaire), ignore-la.${projectFilesBlock(map)}`,
          modelId, baseMap: map, systemPrompt,
          onPath: (p) => emit?.({ type: "action", path: p }),
          onThinking: (delta) => emit?.({ type: "thinking", delta }),
          allowEmptyActions: true, emit
        });
        map = fix.map;
        for (const t of fix.touched || []) touched.add(t);
        addUsage(fix.usage || {});
        emitTouchedDiffs(fix.touched, prevMap, map, emit);
      } catch { /* best-effort */ }
    }

    plan = {
      summary: summaries.join("\n\n") || "Projet généré",
      appName, run, questions
    };
  } else {
    // Demande simple → single-pass (comportement historique)
    emit?.({ type: "status", text: "Génération du code…" });
    const oldMap = new Map(baseMap);
    const r = await generatePlan({
      prompt: historyBlock(history) + prompt, modelId, baseMap,
      systemPrompt,
      onPath: (p) => emit?.({ type: "action", path: p }),
      onThinking: (delta) => emit?.({ type: "thinking", delta })
    });
    plan = r.plan; map = r.map; touched = r.touched;
    addUsage(r.usage || {});
    emitTouchedDiffs(touched, oldMap, map, emit);
  }
  const u = totals;
  const summary = String(plan.summary || "Projet généré");
  const { id, slug } = await insertProject(userId, { summary, prompt, mode, run: plan.run });
  setAppBranding(map, plan.appName || summary.split(/[\s,.:;—-]+/).slice(0, 2).join(" "));
  emit?.({ type: "status", text: "Génération des images…" });
  await materializeAiImages(id, map, imageModel).catch(() => {});
  injectLaunchSdk(map, id);
  await saveFilesMap(id, map);
  if (!u.tokensOut) u.tokensOut = Math.ceil(JSON.stringify(plan).length / 4);
  return { id, slug, model: modelId, mode, summary, questions: plan.questions ?? null, run: plan.run ?? null, files: filesList(map), tokensOut: u.tokensOut, usage: u };
}

// Étape 1 de l'édition : le modèle choisit le(s) fichier(s) à modifier (peu de tokens,
// évite de noyer le contexte). Renvoie { files, usage }.
async function pickFilesForEdit(request, fileList, modelId) {
  const usage = { tokensIn: 0, tokensOut: 0, costUsd: 0 };
  const sys = `Tu es un routeur de fichiers pour un éditeur de code. Pour la tâche donnée, renvoie UNIQUEMENT un JSON {"files":["chemin/exact",...]} : la liste MINIMALE des fichiers existants à modifier et/ou des nouveaux fichiers à créer (souvent un seul). Si la tâche ne nécessite AUCUNE lecture de code (salutation, remerciement, question générale sans modification), renvoie {"files":[]}. Base-toi UNIQUEMENT sur la tâche ci-dessous, PAS sur d'éventuelles demandes passées. Rien d'autre que le JSON.`;
  const user = `Fichiers du projet :\n${fileList.join("\n")}\n\nTâche : ${request}`;
  try {
    const data = await requestRing(user, true, modelId, sys);
    const u = data?.usage || {};
    usage.tokensIn = Number(u.prompt_tokens) || 0;
    usage.tokensOut = Number(u.completion_tokens) || 0;
    usage.costUsd = Number(u.cost) || 0;
    const parsed = parseJsonObject(data?.choices?.[0]?.message?.content || "{}");
    const files = Array.isArray(parsed.files) ? parsed.files.map(String).filter(Boolean) : [];
    return { files, usage };
  } catch { return { files: [], usage }; }
}

export async function editCodeSessionStream(userId, sessionId, prompt, modelId, mode, emit, imageModel, history) {
  const proj = await getProject(userId, sessionId);
  const isReact = mode === "react" || proj.mode === "react";
  const baseMap = await loadFilesMap(sessionId);
  const oldMap = new Map(baseMap);
  const request = String(prompt || "").slice(0, 12000);
  const binaryPaths = await listBinaryPaths(sessionId);
  const fileList = [...baseMap.keys()];

  // ── Lecture agentique CONDITIONNELLE : le routeur décide s'il faut lire ──
  const { files: picked, usage: pickUsage } = await pickFilesForEdit(request, fileList, modelId);
  const targets = picked.filter((p) => fileList.includes(p) || /^[\w.-]+(\/[\w.-]+)*$/.test(p));
  const needsRead = targets.length > 0;
  emit?.({ type: "todo_list", items: [
    ...(needsRead ? [{ id: "read", label: "Lire le projet (fichiers concernés + CSS)" }] : []),
    { id: "apply", label: "Appliquer les modifications" }
  ] });
  if (needsRead) {
    emit?.({ type: "todo_state", id: "read", status: "running" });
    emit?.({ type: "status", text: `Je liste les fichiers du projet (${fileList.length})…` });
  }
  // Les CSS du projet sont TOUJOURS dans le contexte : sinon le modèle ne
  // relit pas les styles existants et ajoute des éléments avec des classes
  // orphelines (jamais stylées) ou des doublons de classes.
  const cssFiles = fileList.filter((p) => p.endsWith(".css"));
  let ctxPaths = needsRead
    ? [...targets, ...cssFiles].filter((p, i, a) => a.indexOf(p) === i).slice(0, 14)
    : [];
  for (const p of ctxPaths) emit?.({ type: "status", text: `Je lis ${p}` });

  // Re-think : avec ce qu'il vient de lire, le modèle peut réclamer d'AUTRES
  // fichiers avant de modifier (max 1 tour — évite les boucles infinies).
  const unread = fileList.filter((p) => !ctxPaths.includes(p));
  if (needsRead && unread.length > 0) {
    try {
      const preview = ctxPaths.map((p) => `--- ${p} ---\n${String(baseMap.get(p) ?? "").slice(0, 1500)}`).join("\n\n");
      const askSys = 'Tu prépares une modification de code. Réponds en JSON strict {"read":["chemin",...]} : la liste des fichiers SUPPLÉMENTAIRES qu\'il te faut lire pour faire la tâche proprement (souvent aucun → {"read":[]}). Maximum 4. Rien d\'autre.';
      const askUser = `Tâche : ${request}\n\nDéjà lus :\n${preview}\n\nFichiers non lus disponibles :\n${unread.join("\n")}`;
      const data = await requestRing(askUser, true, modelId, askSys);
      const uu = data?.usage || {};
      pickUsage.tokensIn += Number(uu.prompt_tokens) || 0;
      pickUsage.tokensOut += Number(uu.completion_tokens) || 0;
      pickUsage.costUsd += Number(uu.cost) || 0;
      const more = (parseJsonObject(data?.choices?.[0]?.message?.content || "{}").read || [])
        .map(String).filter((p) => unread.includes(p)).slice(0, 4);
      for (const p of more) {
        emit?.({ type: "status", text: `Je lis aussi ${p}` });
        ctxPaths.push(p);
      }
    } catch { /* le tour de relecture est optionnel */ }
  }
  const focus = ctxPaths.length
    ? ctxPaths.map((p) => `--- ${p} ---\n${baseMap.get(p) ?? "(nouveau fichier à créer)"}`).join("\n\n")
    : `(Aucun fichier lu — tâche jugée conversationnelle. Fichiers du projet : ${fileList.join(", ")})`;

  // Note sur les images dispo (uploadées/générées) — référençables, non éditables.
  const imagesNote = binaryPaths.length
    ? `\n\nImages disponibles (réfère-les via leur URL racine, ex: <img src="/${binaryPaths[0].replace(/^public\//, "")}" />) : ${binaryPaths.map((p) => "/" + p.replace(/^public\//, "")).join(", ")}`
    : "";

  // Contexte Notion (cible + schéma) si le projet en a une — l'IA ne doit
  // jamais répondre « envoie-moi l'ID de ta base ».
  const notionCtx = /notion|commande|order|sync/i.test(request)
    ? await notionContextBlock(userId, sessionId, { autoCreate: /notion/i.test(request), appName: proj?.summary || "", emit })
    : "";

  // Étape 2 : édition focalisée sur ces seuls fichiers
  const editPrompt = `${historyBlock(history)}Fichier(s) du projet (pour contexte) :\n\n${focus}${imagesNote}${notionCtx}\n\n════════ MESSAGE ACTUEL DE L'UTILISATEUR ════════\n${request}\n\nRéponds à CE message (ignore les demandes passées de l'historique, déjà traitées).\n• RÈGLE PAR DÉFAUT : ce message EST une demande de modification → EXÉCUTE-la immédiatement (edit_file pour un fichier existant, write_file pour un nouveau), sans toucher au reste. Même court ou elliptique (« Ajouter la connexion », « corrige le footer », un choix parmi des options que TU as proposées), c'est un ORDRE : agis, ne redemande JAMAIS « dis-moi ce que tu veux » — il vient de te le dire.\n• SEULE exception (rare) : message sans AUCUN contenu actionnable — pur bonjour/merci/question de curiosité (« salut », « merci ! », « c'est fait avec quoi ? »). Alors réponds naturellement dans "summary" avec "actions": []. En cas de doute → AGIS.`;
  if (needsRead) emit?.({ type: "todo_state", id: "read", status: "done" });
  emit?.({ type: "todo_state", id: "apply", status: "running" });
  emit?.({ type: "status", text: "Application des modifications…" });
  const editSysPrompt = withSkills(isReact ? loadSkill("launch-edit") : SYSTEM_PROMPT, request, emit, isReact ? ["react-vite"] : ["html-css-js"], 2);
  let { plan, map, touched, usage: u } = await generatePlan({
    prompt: editPrompt, modelId, baseMap,
    systemPrompt: editSysPrompt,
    onPath: (p) => emit?.({ type: "action", path: p }),
    onThinking: (delta) => emit?.({ type: "thinking", delta }),
    // Actions vides autorisées UNIQUEMENT pour du pur conversationnel :
    // toute demande substantielle DOIT produire des actions (sinon retry forcé).
    allowEmptyActions:
      /^(salut|bonjour|hello|coucou|yo|hey|merci|thanks|ok|d'accord|super|cool|parfait|top|👍|🙏|😊)[\s!,.?😊👍🙏]*$/i.test(request.trim())
      || request.trim().length < 12
      // vraie question courte (« c'est fait avec quoi ? ») — mais pas un ordre
      || (/\?\s*$/.test(request.trim()) && request.trim().length < 60 && !/^(fais|fait|ajoute|mets|met|change|corrige|crée|cree|gère|gere|supprime|enlève|enleve|modifie)\b/i.test(request.trim())),
    emit
  });
  u.tokensIn += pickUsage.tokensIn; u.tokensOut += pickUsage.tokensOut; u.costUsd += pickUsage.costUsd;

  // ── Garde-fou DA : tout élément ajouté DOIT arriver stylé ──
  // Détection statique des classes sans règle CSS → passe corrective forcée
  // (le prompt seul ne suffit pas, le modèle « oublie » régulièrement).
  const orphans = orphanClassNames(map, touched).slice(0, 12);
  if (orphans.length) {
    emit?.({ type: "status", text: `J'applique la DA du site aux nouveaux éléments (${orphans.length} classe(s) à styler)…` });
    try {
      const fix = await generatePlan({
        prompt: `Tu viens d'appliquer une modification, mais ces classes utilisées dans le JSX/HTML n'ont AUCUNE règle CSS dans le projet : ${orphans.join(", ")}.\nAjoute leurs styles (edit_file sur le fichier CSS concerné) en respectant STRICTEMENT la DA existante du site : mêmes variables, couleurs, radius, espacements et typo que le reste. Si une classe est en réalité déjà couverte (sélecteur parent, style inline volontaire), ignore-la.${projectFilesBlock(map)}`,
        modelId, baseMap: map, systemPrompt: editSysPrompt,
        onPath: (p) => emit?.({ type: "action", path: p }),
        onThinking: (delta) => emit?.({ type: "thinking", delta }),
        allowEmptyActions: true, emit
      });
      map = fix.map;
      touched = [...new Set([...(touched || []), ...(fix.touched || [])])];
      u.tokensIn += fix.usage?.tokensIn || 0; u.tokensOut += fix.usage?.tokensOut || 0; u.costUsd += fix.usage?.costUsd || 0;
    } catch { /* passe corrective best-effort */ }
  }

  emitTouchedDiffs(touched, oldMap, map, emit);
  emit?.({ type: "todo_state", id: "apply", status: "done" });
  const summary = String(plan.summary || "Projet modifié");
  await touchProject(userId, sessionId, { summary, run: plan.run });
  await materializeAiImages(sessionId, map, imageModel).catch(() => {});
  injectLaunchSdk(map, sessionId);
  await saveFilesMap(sessionId, map);
  if (!u.tokensOut) u.tokensOut = Math.ceil(JSON.stringify(plan).length / 4);
  return { id: sessionId, slug: proj.slug, model: modelId, mode: proj.mode, summary, questions: plan.questions ?? null, run: plan.run ?? null, files: filesList(map), tokensOut: u.tokensOut, usage: u };
}

// Mode Plan : l'IA brainstorme et pose des questions, sans écrire de code.
// Renvoie { message, questions: [{question, options}], usage }.
// Agent du chat Launch : il PARLE et EXÉCUTE les outils Composio du créateur
// (Notion, etc.) quand l'utilisateur le demande. Boucle tool_calls (max 6 tours).
export async function planChat(userId, projectId, messages, modelId) {
  let context = "";
  let projectMap = null;
  if (projectId && UUID_RE.test(String(projectId))) {
    try {
      projectMap = await loadFilesMap(projectId);
      if (projectMap.size) context = `\n\nProjet en cours (fichiers) : ${[...projectMap.keys()].join(", ")}\nTu disposes de l'outil launch_read_file : LIS toi-même les fichiers dont tu as besoin. Ne demande JAMAIS à l'utilisateur d'envoyer/coller un fichier ou un composant.`;
      context += await notionContextBlock(userId, projectId);
    } catch { /* pas de projet */ }
  }

  const chatMsgs = [{ role: "system", content: loadSkill("launch-plan") + context }];
  for (const m of (messages || []).slice(-12)) {
    chatMsgs.push({ role: m.role === "user" ? "user" : "assistant", content: String(m.text || "").slice(0, 4000) });
  }

  // Outils Composio du créateur (Notion…) — l'agent peut les appeler.
  let tools = [];
  try {
    const { getToolsForUser } = await import("./composio.js");
    tools = await getToolsForUser(userId);
  } catch { /* pas d'intégrations connectées */ }
  if (/^delt\/|gemma-/i.test(String(modelId || ""))) tools = []; // modèles sans function-calling

  // Outil LOCAL : lecture des fichiers du projet par l'agent lui-même
  // (sinon il demandait à l'utilisateur de coller src/App.jsx…).
  if (projectMap?.size && !/^delt\/|gemma-/i.test(String(modelId || ""))) {
    tools = [{
      type: "function",
      function: {
        name: "launch_read_file",
        description: "Lit le contenu d'un fichier du projet en cours. Utilise-le TOI-MÊME dès que tu as besoin de voir du code (JSX, CSS…). Ne demande jamais à l'utilisateur de coller un fichier.",
        parameters: {
          type: "object",
          properties: { path: { type: "string", description: "Chemin exact, ex: src/App.jsx" } },
          required: ["path"]
        }
      }
    }, ...tools];
  }

  const { chatWithTools } = await import("./openrouter.js");
  const { executeToolCall } = await import("./composio.js");
  const usage = { tokensIn: 0, tokensOut: 0, costUsd: 0 };
  const addU = (u) => { if (!u) return; usage.tokensIn += u.prompt_tokens || 0; usage.tokensOut += u.completion_tokens || 0; usage.costUsd += u.cost || 0; };
  const toolEvents = [];
  let message = "";

  const MAX = tools.length ? 6 : 1;
  for (let round = 0; round < MAX; round++) {
    const useTools = tools.length > 0 && round < MAX - 1; // dernier tour : force une réponse texte
    let resp;
    try {
      resp = await chatWithTools({ modelId, messages: chatMsgs, tools: useTools ? tools : [] });
    } catch (e) { message = message || `Erreur : ${e.message}`; break; }
    addU(resp.usage);
    const msg = resp.message || {};
    const toolCalls = useTools ? msg.tool_calls : null;
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      message = String(msg.content || "").trim();
      break;
    }
    chatMsgs.push({ role: "assistant", content: msg.content || "", tool_calls: toolCalls });
    const results = await Promise.all(toolCalls.map(async (tc) => {
      const name = tc.function?.name || tc.name;
      let args = {};
      try { args = JSON.parse(tc.function?.arguments || tc.arguments || "{}"); } catch { /* */ }
      // Lecture locale d'un fichier du projet (pas un outil Composio)
      if (name === "launch_read_file") {
        const p = String(args.path || "").trim();
        const content = projectMap?.get(p);
        toolEvents.push({ name: `lecture ${p}`, ok: content != null, error: content == null ? "introuvable" : null });
        return {
          tool_call_id: tc.id, role: "tool", name,
          content: content != null
            ? String(content).slice(0, 8000)
            : `Fichier introuvable. Fichiers disponibles : ${[...(projectMap?.keys() || [])].join(", ")}`
        };
      }
      const result = await executeToolCall({ userId, toolName: name, args });
      toolEvents.push({ name, ok: !result?.error, error: result?.error || null });
      return { tool_call_id: tc.id, role: "tool", name, content: JSON.stringify(result).slice(0, 8000) };
    }));
    chatMsgs.push(...results);
  }

  return { message, questions: [], toolEvents, usage };
}

export async function getCodeZip(userId, sessionId) {
  await getProject(userId, sessionId);
  const map = await loadFilesMap(sessionId);
  return zipFiles([...map.entries()].map(([p, content]) => ({ path: p, content })));
}

export async function getCodePreviewFile(userId, sessionId, filePath) {
  await getProject(userId, sessionId);
  const clean = cleanRelPath(filePath || "index.html");
  const { rows } = await getDb().query(
    `SELECT content, encoding, content_type FROM launch_files WHERE project_id=$1 AND path=$2`, [sessionId, clean]
  );
  if (!rows[0]) throw new Error("Fichier preview introuvable");
  const r = rows[0];
  return {
    path: clean,
    content: r.encoding === "base64" ? Buffer.from(r.content, "base64") : r.content,
    contentType: r.content_type || null
  };
}
