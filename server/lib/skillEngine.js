// ─── Moteur de skills DELT (façon Claude Code / anthropics/skills) ───────────
// Divulgation progressive :
//   1. Frontmatter YAML (name, description, triggers) — scanné au boot,
//      quelques tokens par skill, sert UNIQUEMENT au matching.
//   2. Corps du SKILL.md — chargé à la demande quand un prompt matche,
//      injecté dans le system prompt + événement SSE { type:"skill" } pour
//      que l'UI montre « Je lis le skill css/SKILL.md ».
//
// Format d'un skill : server/skills/library/<nom>/SKILL.md
//   ---
//   name: css-moderne
//   description: Quand écrire du CSS…
//   triggers: css, style, design, responsive
//   ---
//   <runbook markdown>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = path.resolve(__dirname, "..", "skills", "library");
const PUBLIC_API = (process.env.PUBLIC_API_URL || "https://deltai-backend.onrender.com").replace(/\/$/, "");

// ─── Registry (frontmatter seulement) ────────────────────────────────────────
let _registry = null; // [{ name, description, triggers: [RegExp], file }]
const _bodyCache = new Map();

function parseFrontmatter(txt) {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: txt };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: txt.slice(m[0].length) };
}

function buildTriggers(raw) {
  // "css, feuille de style, /grid|flexbox/" → mots-clés (word-boundary) + regex
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => {
      if (t.startsWith("/") && t.endsWith("/")) {
        try { return new RegExp(t.slice(1, -1), "i"); } catch { return null; }
      }
      return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    })
    .filter(Boolean);
}

export function skillRegistry() {
  if (_registry) return _registry;
  _registry = [];
  let dirs = [];
  try { dirs = fs.readdirSync(LIBRARY_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()); }
  catch { return _registry; }
  for (const d of dirs) {
    const file = path.join(LIBRARY_DIR, d.name, "SKILL.md");
    try {
      const txt = fs.readFileSync(file, "utf8");
      const { meta } = parseFrontmatter(txt);
      _registry.push({
        name: meta.name || d.name,
        description: meta.description || "",
        triggers: buildTriggers(meta.triggers),
        file: `${d.name}/SKILL.md`,
        path: file
      });
    } catch { /* skill illisible → ignoré */ }
  }
  console.log(`[skills] ${_registry.length} skills chargés depuis library/`);
  return _registry;
}

export function loadSkillBody(name) {
  if (_bodyCache.has(name)) return _bodyCache.get(name);
  const entry = skillRegistry().find((s) => s.name === name);
  if (!entry) return "";
  let body = "";
  try {
    body = parseFrontmatter(fs.readFileSync(entry.path, "utf8")).body
      .split("${PUBLIC_API}").join(PUBLIC_API);
  } catch { /* fichier disparu */ }
  _bodyCache.set(name, body);
  return body;
}

// ─── Matching : score = nb de triggers touchés, top N ────────────────────────
export function matchSkills(text, { max = 3 } = {}) {
  const t = String(text || "");
  if (!t) return [];
  return skillRegistry()
    .map((s) => ({ skill: s, score: s.triggers.filter((re) => re.test(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.skill);
}

// ─── Injection + événements « Je lis le skill … » ────────────────────────────
// `emit` reçoit { type:"skill", name, file } pour chaque skill lu (affiché par
// l'UI comme une étape). Renvoie le bloc à concaténer au system prompt.
export function skillBlockFor(text, { max = 3, emit, include = [] } = {}) {
  // Skills forcés (ex. react-vite quand le mode du projet est React) + matchés.
  const forced = include
    .map((name) => skillRegistry().find((s) => s.name === name))
    .filter(Boolean);
  const matched = [
    ...forced,
    ...matchSkills(text, { max }).filter((s) => !forced.some((f) => f.name === s.name))
  ].slice(0, Math.max(max, forced.length));
  if (!matched.length) return { block: "", matched: [] };
  const parts = [];
  for (const s of matched) {
    emit?.({ type: "skill", name: s.name, file: s.file });
    const body = loadSkillBody(s.name);
    if (body) parts.push(`=== SKILL: ${s.name} ===\n${body}`);
  }
  return {
    block: parts.length
      ? `\n\n─── SKILLS CHARGÉS (suis ces runbooks à la lettre) ───\n${parts.join("\n\n")}`
      : "",
    matched: matched.map((s) => ({ name: s.name, file: s.file }))
  };
}

// Ligne d'index (méta uniquement) à mettre dans un system prompt : permet au
// modèle de savoir quels skills existent sans en charger le corps.
export function skillIndexLine() {
  const reg = skillRegistry();
  if (!reg.length) return "";
  return `Skills disponibles: ${reg.map((s) => s.name).join(", ")}.`;
}
