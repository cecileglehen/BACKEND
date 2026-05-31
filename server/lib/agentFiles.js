// Fichiers de connaissances des agents (RAG via pgvector).
// Upload → extraction texte → chunking → embeddings → stockage.
// Au chat : on récupère les top-K chunks pertinents pour la question.

import { getDb } from "./db.js";
import { getKnowledgeQuotaBytes } from "../config/plans.js";
import { embedOne, embedMany, chunkText, cosine } from "./embeddings.js";

let tablesReady = null;
async function ensureTables() {
  if (tablesReady !== null) return tablesReady;
  try {
    const db = getDb();
    await db.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS agent_files (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        mime        TEXT,
        size_bytes  BIGINT NOT NULL DEFAULT 0,
        chunk_count INT NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_agent_files_agent ON agent_files(agent_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_agent_files_user ON agent_files(user_id)`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS agent_file_chunks (
        id          BIGSERIAL PRIMARY KEY,
        file_id     UUID NOT NULL REFERENCES agent_files(id) ON DELETE CASCADE,
        agent_id    UUID NOT NULL,
        chunk_index INT NOT NULL,
        content     TEXT NOT NULL,
        embedding   vector(1536)
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_agent_chunks_agent ON agent_file_chunks(agent_id)`);
    tablesReady = true;
  } catch (e) {
    console.warn("[agentFiles] pgvector/table indisponible:", e.message);
    tablesReady = false;
  }
  return tablesReady;
}

// Octets de connaissances déjà stockés par l'utilisateur (tous agents confondus).
export async function getKnowledgeUsage(userId) {
  if (!(await ensureTables())) return 0;
  const db = getDb();
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS total FROM agent_files WHERE user_id=$1`,
    [userId]
  );
  return Number(rows[0]?.total) || 0;
}

export async function getKnowledgeQuota(userId, plan) {
  const limit = getKnowledgeQuotaBytes(plan);
  const used = await getKnowledgeUsage(userId);
  return { limitBytes: limit, usedBytes: used, remainingBytes: Math.max(0, limit - used) };
}

export async function listKnowledgeFiles(userId, agentId) {
  if (!(await ensureTables())) return [];
  const db = getDb();
  const { rows } = await db.query(
    `SELECT id, name, mime, size_bytes, chunk_count, created_at
     FROM agent_files WHERE user_id=$1 AND agent_id=$2 ORDER BY created_at DESC`,
    [userId, agentId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    mime: r.mime,
    sizeBytes: Number(r.size_bytes) || 0,
    chunkCount: r.chunk_count || 0,
    createdAt: new Date(r.created_at).getTime()
  }));
}

// Ajoute un fichier de connaissances : extrait, chunk, embed, stocke.
// `parsed` vient de parseAttachment ({ type, name, mime, text, size }).
export async function addKnowledgeFile(userId, agentId, plan, parsed) {
  if (!(await ensureTables())) {
    const err = new Error("Stockage de connaissances indisponible.");
    err.status = 503;
    throw err;
  }
  const text = String(parsed.text || "").trim();
  if (!text) {
    const err = new Error("Aucun texte exploitable dans ce fichier.");
    err.status = 400;
    throw err;
  }
  const sizeBytes = Number(parsed.size) || Buffer.byteLength(text, "utf8");

  // Vérifie le quota total
  const quota = await getKnowledgeQuota(userId, plan);
  if (quota.limitBytes === 0) {
    const err = new Error("Les fichiers de connaissances nécessitent un abonnement payant.");
    err.status = 403; err.code = "knowledge_quota";
    throw err;
  }
  if (sizeBytes > quota.remainingBytes) {
    const err = new Error(
      `Quota de connaissances dépassé : ce fichier fait ${(sizeBytes / 1048576).toFixed(1)} Mo mais il ne reste que ${(quota.remainingBytes / 1048576).toFixed(1)} Mo sur ${(quota.limitBytes / 1048576).toFixed(0)} Mo.`
    );
    err.status = 403; err.code = "knowledge_quota"; err.quota = quota;
    throw err;
  }

  const db = getDb();
  // Chunking + embeddings
  const chunks = chunkText(text, 350, 40);
  const vectors = await embedMany(chunks);

  const { rows } = await db.query(
    `INSERT INTO agent_files (agent_id, user_id, name, mime, size_bytes, chunk_count)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
    [agentId, userId, String(parsed.name || "fichier").slice(0, 200), parsed.mime || null, sizeBytes, chunks.length]
  );
  const fileId = rows[0].id;

  // Insert des chunks par batch
  for (let i = 0; i < chunks.length; i += 1) {
    const vec = vectors[i];
    await db.query(
      `INSERT INTO agent_file_chunks (file_id, agent_id, chunk_index, content, embedding)
       VALUES ($1,$2,$3,$4,$5)`,
      [fileId, agentId, i, chunks[i].slice(0, 4000), vec ? `[${vec.join(",")}]` : null]
    );
  }

  return {
    id: fileId,
    name: String(parsed.name || "fichier").slice(0, 200),
    mime: parsed.mime || null,
    sizeBytes,
    chunkCount: chunks.length,
    createdAt: new Date(rows[0].created_at).getTime()
  };
}

export async function deleteKnowledgeFile(userId, fileId) {
  if (!(await ensureTables())) return false;
  const db = getDb();
  const { rowCount } = await db.query(
    `DELETE FROM agent_files WHERE id=$1 AND user_id=$2`,
    [fileId, userId]
  );
  return rowCount > 0;
}

// Récupère les top-K chunks les plus pertinents pour la question, pour un agent.
// Utilise la distance cosinus pgvector (<=>). Renvoie [{ content, score, name }].
export async function retrieveKnowledge(agentId, query, k = 6) {
  if (!(await ensureTables())) return [];
  const q = String(query || "").trim();
  if (!q) return [];
  let queryVec;
  try { queryVec = await embedOne(q); } catch { return []; }
  if (!queryVec) return [];

  const db = getDb();
  try {
    const { rows } = await db.query(
      `SELECT c.content, f.name AS file_name,
              1 - (c.embedding <=> $2::vector) AS score
       FROM agent_file_chunks c
       JOIN agent_files f ON f.id = c.file_id
       WHERE c.agent_id = $1 AND c.embedding IS NOT NULL
       ORDER BY c.embedding <=> $2::vector
       LIMIT $3`,
      [agentId, `[${queryVec.join(",")}]`, k]
    );
    return rows
      .filter((r) => Number(r.score) > 0.15)
      .map((r) => ({ content: r.content, score: Number(r.score), fileName: r.file_name }));
  } catch (e) {
    // Fallback in-JS si l'opérateur <=> échoue
    try {
      const { rows } = await db.query(
        `SELECT content, embedding, (SELECT name FROM agent_files f WHERE f.id = c.file_id) AS file_name
         FROM agent_file_chunks c WHERE agent_id=$1 AND embedding IS NOT NULL LIMIT 2000`,
        [agentId]
      );
      const scored = rows.map((r) => {
        const vec = typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding;
        return { content: r.content, fileName: r.file_name, score: cosine(queryVec, vec) };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.filter((s) => s.score > 0.15).slice(0, k);
    } catch {
      return [];
    }
  }
}

// Construit un bloc texte injectable dans le system prompt depuis les chunks.
export function buildKnowledgeContext(chunks) {
  if (!chunks?.length) return null;
  const lines = chunks.map((c, i) => `[${i + 1}] (${c.fileName || "doc"}) ${c.content}`);
  return `=== EXTRAITS PERTINENTS DE TA BASE DOCUMENTAIRE (utilise-les en priorité, cite la source si utile) ===\n${lines.join("\n\n")}`;
}
