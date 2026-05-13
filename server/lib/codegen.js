import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { zipDirectory } from "./zip.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_ROOT = path.join(__dirname, "..", "data", "code-sessions");
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const RING_MODEL    = "inclusionai/ring-2.6-1t:free";
const MISTRAL_MODEL = "mistralai/mistral-small-2603";
const ALLOWED_CODE_MODELS = new Set([RING_MODEL, MISTRAL_MODEL]);
const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 2_000_000;
const MAX_ACTIONS = 80;

const SYSTEM_PROMPT = `Tu es Ring, un codeur IA. Tu dois répondre uniquement avec un objet JSON valide, sans markdown.

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
    throw new Error("Ring n'a pas renvoyé un JSON valide.");
  }
}

async function requestRing(prompt, jsonMode = true, modelId = RING_MODEL) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  const model = ALLOWED_CODE_MODELS.has(modelId) ? modelId : RING_MODEL;

  const body = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
    const error = new Error(`Ring ${res.status}: ${text.slice(0, 220)}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

async function callRing(prompt, modelId = RING_MODEL) {
  let data;
  try {
    data = await requestRing(prompt, true, modelId);
  } catch (e) {
    if (![400, 422].includes(e.status)) throw e;
    data = await requestRing(prompt, false, modelId);
  }

  const content = data?.choices?.[0]?.message?.content ?? "";
  return { plan: parseJsonObject(content), raw: data };
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

export async function createCodeSession(userId, prompt, modelId = RING_MODEL) {
  const id = crypto.randomUUID();
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  await fs.mkdir(root, { recursive: true });

  const { plan, raw } = await callRing(prompt, modelId);
  await applyActions(root, plan.actions);
  const files = await listProjectFiles(root);
  const tokensOut = raw?.usage?.completion_tokens ?? Math.ceil(JSON.stringify(plan).length / 4);

  return {
    id,
    model: modelId,
    summary: String(plan.summary || "Projet généré par Ring"),
    run: plan.run ?? null,
    files,
    tokensOut
  };
}

export async function editCodeSession(userId, sessionId, prompt, modelId = RING_MODEL) {
  const id = String(sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Session invalide");
  const root = path.join(SESSIONS_ROOT, String(userId), id);
  await fs.access(root);

  const currentProject = await readProjectContext(root);
  const editPrompt = `Projet actuel:\n${currentProject}\n\nModification demandée:\n${String(prompt || "").slice(0, 12000)}\n\nRéponds avec le même JSON d'actions. Modifie uniquement ce qui est nécessaire.`;
  const { plan, raw } = await callRing(editPrompt, modelId);
  await applyActions(root, plan.actions);
  const files = await listProjectFiles(root);
  const tokensOut = raw?.usage?.completion_tokens ?? Math.ceil(JSON.stringify(plan).length / 4);

  return {
    id,
    model: modelId,
    summary: String(plan.summary || "Projet modifié par Ring"),
    run: plan.run ?? null,
    files,
    tokensOut
  };
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
