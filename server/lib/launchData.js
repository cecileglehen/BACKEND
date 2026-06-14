// Base de données "no-code" managée pour les apps Launch.
// Données scopées par projet + collection, type document (JSONB).
// Ownership : owner_id = app-user créateur ; modification/suppression réservées
// au propriétaire (ou libres si la ligne est anonyme).
import { getDb } from "./db.js";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const COLLECTION_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const MAX_DATA_BYTES = 100_000;
const MAX_LIMIT = 500;

function checkCollection(c) {
  if (!COLLECTION_RE.test(String(c || ""))) throw new Error("Collection invalide");
  return c;
}

async function ensureProject(projectId) {
  if (!UUID_RE.test(String(projectId))) throw new Error("Projet introuvable");
  const { rows } = await getDb().query(`SELECT 1 FROM launch_projects WHERE id=$1`, [projectId]);
  if (!rows[0]) throw new Error("Projet introuvable");
}

function toDoc(r) {
  return { id: r.id, ...(r.data || {}), createdAt: r.created_at, updatedAt: r.updated_at, ownerId: r.owner_id };
}

// Retire les champs réservés et borne la taille.
function sanitizeData(data) {
  if (data == null || typeof data !== "object" || Array.isArray(data)) throw new Error("data doit être un objet");
  const { id, createdAt, updatedAt, ownerId, ...rest } = data;
  if (Buffer.byteLength(JSON.stringify(rest), "utf8") > MAX_DATA_BYTES) throw new Error("Document trop volumineux");
  return rest;
}

function forbidden() {
  const e = new Error("Accès refusé");
  e.status = 403;
  return e;
}

export async function listDocs(projectId, collection, { mine, ownerId, limit } = {}) {
  await ensureProject(projectId);
  checkCollection(collection);
  const lim = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || 100));
  const params = [projectId, collection];
  let where = `project_id=$1 AND collection=$2`;
  if (mine) { params.push(ownerId || "00000000-0000-0000-0000-000000000000"); where += ` AND owner_id=$3`; }
  const { rows } = await getDb().query(
    `SELECT * FROM launch_app_data WHERE ${where} ORDER BY created_at DESC LIMIT ${lim}`,
    params
  );
  return rows.map(toDoc);
}

export async function createDoc(projectId, collection, data, ownerId) {
  await ensureProject(projectId);
  checkCollection(collection);
  const clean = sanitizeData(data);
  const { rows: [r] } = await getDb().query(
    `INSERT INTO launch_app_data (project_id, collection, owner_id, data)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [projectId, collection, ownerId || null, JSON.stringify(clean)]
  );
  return toDoc(r);
}

export async function getDoc(projectId, collection, id) {
  await ensureProject(projectId);
  checkCollection(collection);
  if (!UUID_RE.test(String(id))) throw new Error("id invalide");
  const { rows: [r] } = await getDb().query(
    `SELECT * FROM launch_app_data WHERE project_id=$1 AND collection=$2 AND id=$3`,
    [projectId, collection, id]
  );
  if (!r) throw new Error("Introuvable");
  return toDoc(r);
}

export async function updateDoc(projectId, collection, id, data, ownerId) {
  await ensureProject(projectId);
  checkCollection(collection);
  if (!UUID_RE.test(String(id))) throw new Error("id invalide");
  const clean = sanitizeData(data);
  const db = getDb();
  const { rows: [existing] } = await db.query(
    `SELECT owner_id FROM launch_app_data WHERE project_id=$1 AND collection=$2 AND id=$3`,
    [projectId, collection, id]
  );
  if (!existing) throw new Error("Introuvable");
  if (existing.owner_id && String(existing.owner_id) !== String(ownerId || "")) throw forbidden();
  const { rows: [r] } = await db.query(
    `UPDATE launch_app_data SET data = data || $4::jsonb, updated_at=NOW()
     WHERE project_id=$1 AND collection=$2 AND id=$3 RETURNING *`,
    [projectId, collection, id, JSON.stringify(clean)]
  );
  return toDoc(r);
}

export async function deleteDoc(projectId, collection, id, ownerId) {
  await ensureProject(projectId);
  checkCollection(collection);
  if (!UUID_RE.test(String(id))) throw new Error("id invalide");
  const db = getDb();
  const { rows: [existing] } = await db.query(
    `SELECT owner_id FROM launch_app_data WHERE project_id=$1 AND collection=$2 AND id=$3`,
    [projectId, collection, id]
  );
  if (!existing) return { ok: true };
  if (existing.owner_id && String(existing.owner_id) !== String(ownerId || "")) throw forbidden();
  await db.query(`DELETE FROM launch_app_data WHERE project_id=$1 AND collection=$2 AND id=$3`, [projectId, collection, id]);
  return { ok: true };
}
