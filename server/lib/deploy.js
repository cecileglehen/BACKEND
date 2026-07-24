// Déploiement de sites statiques Launch — persistés en DB (launch_deploys /
// launch_deploy_files), servis à /sites/<slug>. Le filesystem Render est éphémère.
import { getDb } from "./db.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 30_000_000; // builds avec images IA embarquées (base64)

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
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf"
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

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function deploySite(userId, projectId, slugRaw, files) {
  if (!UUID_RE.test(String(projectId))) throw new Error("Projet invalide");
  if (!Array.isArray(files) || files.length === 0) throw new Error("Aucun fichier à déployer.");
  if (files.length > MAX_FILES) throw new Error("Trop de fichiers.");

  const db = getDb();

  // Le projet doit appartenir à l'utilisateur
  const { rows: proj } = await db.query(`SELECT id FROM launch_projects WHERE id=$1 AND user_id=$2`, [projectId, userId]);
  if (!proj[0]) throw new Error("Projet introuvable");

  // 1 déploiement max par projet : réutilise le slug existant, sinon en crée un.
  const { rows: cur } = await db.query(`SELECT slug FROM launch_deploys WHERE project_id=$1`, [projectId]);
  let slug;
  if (cur[0]) {
    slug = cur[0].slug;
    await db.query(`UPDATE launch_deploys SET updated_at=NOW() WHERE slug=$1`, [slug]);
  } else {
    slug = normalizeSlug(slugRaw);
    if (!SLUG_RE.test(slug)) throw new Error("Slug invalide (a-z, 0-9, tirets, 2-40 caractères).");
    const { rows: taken } = await db.query(`SELECT 1 FROM launch_deploys WHERE slug=$1`, [slug]);
    if (taken[0]) throw new Error("Ce nom est déjà pris.");
    await db.query(
      `INSERT INTO launch_deploys (slug, user_id, project_id, updated_at) VALUES ($1, $2, $3, NOW())`,
      [slug, userId, projectId]
    );
  }

  // Réécrit les fichiers à neuf
  await db.query(`DELETE FROM launch_deploy_files WHERE slug=$1`, [slug]);

  let total = 0;
  const rows = [];
  for (const f of files) {
    const path = cleanPath(f.path);
    const content = String(f.content ?? "");
    const encoding = f.encoding === "base64" ? "base64" : "utf8";
    total += content.length;
    if (total > MAX_TOTAL_BYTES) throw new Error("Build trop volumineux.");
    rows.push([path, content, contentType(path), encoding]);
  }

  const tuples = rows.map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`);
  const vals = rows.flat();
  await db.query(
    `INSERT INTO launch_deploy_files (slug, path, content, content_type, encoding) VALUES ${tuples.join(",")}`,
    [slug, ...vals]
  );

  return { slug, url: `/sites/${slug}/` };
}

// Shutdown : retire le déploiement d'un projet (supprime site + fichiers).
export async function undeploySite(userId, projectId) {
  if (!UUID_RE.test(String(projectId))) throw new Error("Projet invalide");
  const db = getDb();
  const { rows } = await db.query(
    `SELECT slug FROM launch_deploys WHERE project_id=$1 AND user_id=$2`, [projectId, userId]
  );
  if (!rows[0]) return { ok: true, deployed: false };
  await db.query(`DELETE FROM launch_deploys WHERE slug=$1`, [rows[0].slug]); // cascade → fichiers
  return { ok: true, deployed: false };
}

// État du déploiement d'un projet (pour l'IDE).
export async function getProjectDeploy(userId, projectId) {
  if (!UUID_RE.test(String(projectId))) return { deployed: false };
  const { rows } = await getDb().query(
    `SELECT slug FROM launch_deploys WHERE project_id=$1 AND user_id=$2`, [projectId, userId]
  );
  if (!rows[0]) return { deployed: false };
  return { deployed: true, slug: rows[0].slug, url: `/sites/${rows[0].slug}/` };
}

// Sert un fichier d'un site déployé (avec fallback index.html à la racine).
export async function getDeployFile(slug, requestedPath) {
  const s = normalizeSlug(slug);
  if (!SLUG_RE.test(s)) return null;
  let path = cleanPath(requestedPath || "index.html");
  if (path === "" || path.endsWith("/")) path += "index.html";

  const db = getDb();
  const lookup = async (p) => (await db.query(
    `SELECT content, content_type, encoding FROM launch_deploy_files WHERE slug=$1 AND path=$2`,
    [s, p]
  )).rows[0];

  let row = await lookup(path);
  const hasExt = /\.[a-z0-9]+$/i.test(path);

  if (!row && hasExt) {
    // Asset demandé sous une route imbriquée (ex: /about/assets/app.js) alors
    // que le build Vite utilise base "./" (chemins relatifs) → on retire les
    // segments de tête un à un jusqu'à trouver le vrai fichier (assets/app.js).
    // Si rien ne matche, 404 franc : ne JAMAIS servir index.html à la place
    // d'un .js/.css (ça casse le module loading en silence).
    const segs = path.split("/");
    for (let i = 1; i < segs.length && !row; i++) row = await lookup(segs.slice(i).join("/"));
    if (!row) return null;
  }

  if (!row) {
    // Pas d'extension → page. Sites statiques multi-pages : /about → about.html
    // ou about/index.html. Sinon fallback SPA (React Router gère la route).
    row = await lookup(`${path}.html`)
      || await lookup(`${path}/index.html`)
      || await lookup("index.html");
  }
  if (!row) return null;
  const r = row;
  return {
    content: r.encoding === "base64" ? Buffer.from(r.content, "base64") : r.content,
    contentType: r.content_type || "text/html; charset=utf-8"
  };
}
