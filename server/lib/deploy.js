// Déploiement de sites statiques Launch — persistés en DB (launch_deploys /
// launch_deploy_files), servis à /sites/<slug>. Le filesystem Render est éphémère.
import { getDb } from "./db.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 8_000_000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json"
};

function contentType(path) {
  const m = String(path).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return (m && TYPES[m[1]]) || "application/octet-stream";
}

export function normalizeSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function cleanPath(p) {
  const c = String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!c || c.includes("\0") || c.split("/").includes("..")) throw new Error(`Chemin refusé: ${p}`);
  return c;
}

export async function deploySite(userId, slugRaw, files) {
  const slug = normalizeSlug(slugRaw);
  if (!SLUG_RE.test(slug)) throw new Error("Slug invalide (a-z, 0-9, tirets, 2-40 caractères).");
  if (!Array.isArray(files) || files.length === 0) throw new Error("Aucun fichier à déployer.");
  if (files.length > MAX_FILES) throw new Error("Trop de fichiers.");

  const db = getDb();

  // Vérifie la propriété si le slug existe déjà
  const { rows: existing } = await db.query(`SELECT user_id FROM launch_deploys WHERE slug=$1`, [slug]);
  if (existing[0] && String(existing[0].user_id) !== String(userId)) throw new Error("Ce nom est déjà pris.");

  // Upsert du déploiement
  await db.query(
    `INSERT INTO launch_deploys (slug, user_id, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()`,
    [slug, userId]
  );

  // Réécrit les fichiers à neuf
  await db.query(`DELETE FROM launch_deploy_files WHERE slug=$1`, [slug]);

  let total = 0;
  const rows = [];
  for (const f of files) {
    const path = cleanPath(f.path);
    const content = String(f.content ?? "");
    total += Buffer.byteLength(content, "utf8");
    if (total > MAX_TOTAL_BYTES) throw new Error("Build trop volumineux.");
    rows.push([path, content, contentType(path)]);
  }

  const tuples = rows.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`);
  const vals = rows.flat();
  await db.query(
    `INSERT INTO launch_deploy_files (slug, path, content, content_type) VALUES ${tuples.join(",")}`,
    [slug, ...vals]
  );

  return { slug, url: `/sites/${slug}/` };
}

// Sert un fichier d'un site déployé (avec fallback index.html à la racine).
export async function getDeployFile(slug, requestedPath) {
  const s = normalizeSlug(slug);
  if (!SLUG_RE.test(s)) return null;
  let path = cleanPath(requestedPath || "index.html");
  if (path === "" || path.endsWith("/")) path += "index.html";

  const db = getDb();
  let { rows } = await db.query(
    `SELECT content, content_type FROM launch_deploy_files WHERE slug=$1 AND path=$2`,
    [s, path]
  );
  // Fallback SPA : sert index.html si le fichier exact n'existe pas
  if (!rows[0]) {
    ({ rows } = await db.query(
      `SELECT content, content_type FROM launch_deploy_files WHERE slug=$1 AND path='index.html'`,
      [s]
    ));
  }
  if (!rows[0]) return null;
  return { content: rows[0].content, contentType: rows[0].content_type || "text/html; charset=utf-8" };
}
