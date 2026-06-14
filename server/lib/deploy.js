// Déploiement de sites statiques générés par Launch.
// Écrit le build (dist/) dans un dossier public servi à /sites/<slug>.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEPLOYS_ROOT = path.join(__dirname, "..", "data", "deploys");

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 8_000_000;

export function normalizeSlug(raw) {
  const slug = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug;
}

function safeInside(root, relativePath) {
  const clean = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) {
    throw new Error(`Chemin refusé: ${relativePath}`);
  }
  const target = path.resolve(root, clean);
  if (!target.startsWith(root + path.sep)) throw new Error(`Chemin hors site refusé: ${relativePath}`);
  return target;
}

export async function deploySite(userId, slugRaw, files) {
  const slug = normalizeSlug(slugRaw);
  if (!SLUG_RE.test(slug)) throw new Error("Slug invalide (a-z, 0-9, tirets, 2-40 caractères).");
  if (!Array.isArray(files) || files.length === 0) throw new Error("Aucun fichier à déployer.");
  if (files.length > MAX_FILES) throw new Error("Trop de fichiers.");

  const siteRoot = path.join(DEPLOYS_ROOT, slug);
  const metaPath = path.join(siteRoot, ".launch.json");

  // Vérifie la propriété si le slug existe déjà
  const existing = await fs.readFile(metaPath, "utf8").catch(() => null);
  if (existing) {
    const meta = JSON.parse(existing);
    if (String(meta.userId) !== String(userId)) throw new Error("Ce nom est déjà pris.");
  }

  // Réécrit le site à neuf
  await fs.rm(siteRoot, { recursive: true, force: true });
  await fs.mkdir(siteRoot, { recursive: true });

  let total = 0;
  for (const f of files) {
    const target = safeInside(siteRoot, f.path);
    const content = String(f.content ?? "");
    total += Buffer.byteLength(content, "utf8");
    if (total > MAX_TOTAL_BYTES) throw new Error("Build trop volumineux.");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }

  await fs.writeFile(metaPath, JSON.stringify({ userId, slug, deployedAt: Date.now() }), "utf8");
  return { slug, url: `/sites/${slug}/` };
}
