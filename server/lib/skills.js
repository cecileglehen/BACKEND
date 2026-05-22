// Charge les skills (markdown) au boot et expose le prompt système à injecter.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, "..", "skills");

let cachedPrompt = null;

function loadSkills() {
  if (cachedPrompt) return cachedPrompt;
  try {
    const base = fs.readFileSync(path.join(SKILLS_DIR, "base.md"), "utf-8");
    cachedPrompt = base.trim();
    return cachedPrompt;
  } catch (e) {
    console.warn("[skills] erreur chargement:", e.message);
    return "";
  }
}

export function getBaseSkillPrompt() {
  return loadSkills();
}

// Parse une réponse complète et extrait les blocs %%write_file et %%generate_image.
// Retourne { cleaned, artifacts, images } où :
//   - cleaned : texte sans les blocs %% (remplacés par des placeholders lisibles)
//   - artifacts : [{ filename, content, mime }]
//   - images : [{ prompt }]
const WRITE_FILE_RE = /%%write_file:([^\n\r]+)\r?\n([\s\S]*?)%%end/g;
const GEN_IMAGE_RE = /%%generate_image:([^\n\r]+)(?:\r?\n)?%%end/g;

const EXT_MIME = {
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  py: "text/x-python",
  js: "text/javascript",
  ts: "text/typescript",
  jsx: "text/javascript",
  tsx: "text/typescript",
  html: "text/html",
  css: "text/css",
  sql: "application/sql",
  sh: "text/x-shellscript",
  yaml: "text/yaml",
  yml: "text/yaml",
  xml: "text/xml",
  dart: "text/x-dart",
  go: "text/x-go",
  rs: "text/x-rust",
  java: "text/x-java",
  kt: "text/x-kotlin",
  swift: "text/x-swift",
  cpp: "text/x-c++",
  c: "text/x-c",
  rb: "text/x-ruby",
  php: "text/x-php"
};

export function parseSkillBlocks(content) {
  const artifacts = [];
  const images = [];

  // Extract write_file blocks
  let m;
  WRITE_FILE_RE.lastIndex = 0;
  while ((m = WRITE_FILE_RE.exec(content)) !== null) {
    const filename = m[1].trim();
    const fileContent = m[2].replace(/\n$/, "");
    const ext = (filename.split(".").pop() || "txt").toLowerCase();
    artifacts.push({
      filename,
      content: fileContent,
      mime: EXT_MIME[ext] || "text/plain",
      ext
    });
  }

  GEN_IMAGE_RE.lastIndex = 0;
  while ((m = GEN_IMAGE_RE.exec(content)) !== null) {
    const prompt = m[1].trim();
    if (prompt) images.push({ prompt });
  }

  // Remplace les blocs par des placeholders dans le texte affiché
  const cleaned = content
    .replace(WRITE_FILE_RE, (_, name) => `📄 *Fichier généré : ${name.trim()}*`)
    .replace(GEN_IMAGE_RE, (_, prompt) => `🎨 *Image générée : ${prompt.trim().slice(0, 80)}${prompt.trim().length > 80 ? "…" : ""}*`)
    .trim();

  return { cleaned, artifacts, images };
}
