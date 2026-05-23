// Wrapper embeddings via OpenRouter (model openai/text-embedding-3-small).
// Utilisé par le pipeline Deep Search pour ranker les chunks de pages
// scrapées par similarité cosinus avec la question utilisateur.
//
// Coût : $0.02 / 1M tokens → quasi-gratuit à l'échelle de Delt AI.

import crypto from "node:crypto";
import { getDb } from "./db.js";

const OR_URL = "https://openrouter.ai/api/v1/embeddings";
const MODEL = "openai/text-embedding-3-small";
const BATCH = 96; // OpenAI accepte jusqu'à 2048 inputs, on reste prudent

// ─── Cache pgvector (DB Supabase) ────────────────────────────────────────────
// Stocke chaque embedding pour ne jamais le recalculer. Lookup par hash SHA1
// du texte. Si pgvector n'est pas dispo ou table absente, fallback transparent.

let pgvectorReady = null;
async function ensurePgvectorTable() {
  if (pgvectorReady !== null) return pgvectorReady;
  try {
    const db = getDb();
    await db.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        text_hash CHAR(40) PRIMARY KEY,
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    pgvectorReady = true;
  } catch (e) {
    console.warn("[embeddings] pgvector indisponible, cache désactivé:", e.message);
    pgvectorReady = false;
  }
  return pgvectorReady;
}

function hashText(text) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

async function cacheGet(hashes) {
  if (!(await ensurePgvectorTable())) return new Map();
  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT text_hash, embedding FROM embedding_cache WHERE text_hash = ANY($1::char(40)[])`,
      [hashes]
    );
    const map = new Map();
    for (const r of rows) {
      // pgvector renvoie une string "[0.1, 0.2, ...]" — parse en array
      const vec = typeof r.embedding === "string"
        ? JSON.parse(r.embedding)
        : r.embedding;
      map.set(r.text_hash, vec);
    }
    return map;
  } catch (e) {
    return new Map();
  }
}

async function cacheSet(entries) {
  if (entries.length === 0) return;
  if (!(await ensurePgvectorTable())) return;
  try {
    const db = getDb();
    const hashes = entries.map((e) => e.hash);
    const vectors = entries.map((e) => `[${e.vector.join(",")}]`);
    await db.query(
      `INSERT INTO embedding_cache (text_hash, embedding)
       SELECT * FROM UNNEST($1::char(40)[], $2::vector(1536)[])
       ON CONFLICT (text_hash) DO NOTHING`,
      [hashes, vectors]
    );
  } catch (e) {
    // Silently fail — cache n'est pas critique
  }
}

function headers() {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": "https://delt.ai",
    "X-Title": "DELT AI"
  };
}

// Embed un seul texte (question utilisateur typiquement).
export async function embedOne(text, signal) {
  const res = await fetch(OR_URL, {
    method: "POST",
    signal,
    headers: headers(),
    body: JSON.stringify({ model: MODEL, input: String(text || "").slice(0, 8000) })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`embeddings ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.data?.[0]?.embedding || null;
}

// Embed plusieurs textes en parallèle (par batches), avec cache pgvector.
// Retourne un tableau de vecteurs alignés avec l'ordre d'entrée.
export async function embedMany(texts, signal) {
  const inputs = texts.map((t) => String(t || "").slice(0, 8000));
  const hashes = inputs.map(hashText);
  const results = new Array(inputs.length);

  // Lookup cache
  const cached = await cacheGet(hashes);
  const toFetchIdx = [];
  for (let i = 0; i < inputs.length; i += 1) {
    const hit = cached.get(hashes[i]);
    if (hit) results[i] = hit;
    else toFetchIdx.push(i);
  }

  // Appel API uniquement sur les cache miss
  const toFetchInputs = toFetchIdx.map((i) => inputs[i]);
  const newEntries = [];
  for (let i = 0; i < toFetchInputs.length; i += BATCH) {
    const slice = toFetchInputs.slice(i, i + BATCH);
    const res = await fetch(OR_URL, {
      method: "POST",
      signal,
      headers: headers(),
      body: JSON.stringify({ model: MODEL, input: slice })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`embeddings ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const items = data?.data || [];
    for (let j = 0; j < items.length; j += 1) {
      const targetIdx = toFetchIdx[i + j];
      results[targetIdx] = items[j].embedding;
      newEntries.push({ hash: hashes[targetIdx], vector: items[j].embedding });
    }
  }

  // Persist new embeddings dans le cache (fire and forget)
  if (newEntries.length > 0) cacheSet(newEntries).catch(() => {});

  return results;
}

// ─── Clustering greedy : dédoublonne les chunks quasi-identiques ─────────────
// Pour chaque chunk, on l'assigne au cluster existant le plus proche si la
// similarité dépasse `threshold`, sinon on crée un nouveau cluster.
// Retourne 1 représentant par cluster (celui de plus haut score).
export function clusterChunks(scoredChunks, threshold = 0.86) {
  if (scoredChunks.length === 0) return [];
  const clusters = []; // { centroid: vec, members: [{chunk, score}] }

  for (const item of scoredChunks) {
    if (!item.vector) continue;
    let bestIdx = -1;
    let bestSim = threshold;
    for (let i = 0; i < clusters.length; i += 1) {
      const sim = cosine(clusters[i].centroid, item.vector);
      if (sim > bestSim) { bestSim = sim; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      clusters[bestIdx].members.push(item);
    } else {
      clusters.push({ centroid: item.vector, members: [item] });
    }
  }

  // 1 représentant par cluster = celui avec le meilleur score
  return clusters.map((c) => {
    c.members.sort((a, b) => (b.score || 0) - (a.score || 0));
    const rep = c.members[0];
    return {
      ...rep,
      clusterSize: c.members.length,
      duplicates: c.members.length - 1
    };
  });
}

// Découpe un texte en chunks d'environ `targetTokens` tokens (1 token ≈ 4 chars).
// Privilégie les coupures de paragraphe pour préserver le contexte.
export function chunkText(text, targetTokens = 350, overlap = 40) {
  const targetChars = targetTokens * 4;
  const overlapChars = overlap * 4;
  const clean = String(text || "").replace(/\r\n/g, "\n").trim();
  if (clean.length <= targetChars) return clean ? [clean] : [];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= targetChars) {
      current += (current ? "\n\n" : "") + para;
    } else {
      if (current) chunks.push(current);
      // Si le paragraphe seul est trop gros, le découper en phrases
      if (para.length > targetChars) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        let sub = "";
        for (const s of sentences) {
          if (sub.length + s.length + 1 <= targetChars) {
            sub += (sub ? " " : "") + s;
          } else {
            if (sub) chunks.push(sub);
            sub = s.length > targetChars ? s.slice(0, targetChars) : s;
          }
        }
        if (sub) chunks.push(sub);
        current = "";
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);

  // Overlap pour préserver le contexte aux frontières
  if (overlap > 0 && chunks.length > 1) {
    return chunks.map((c, i) => {
      if (i === 0) return c;
      const tail = chunks[i - 1].slice(-overlapChars);
      return tail + "\n\n" + c;
    });
  }
  return chunks;
}

// Cosine similarity entre 2 vecteurs.
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Pour une page : retourne tous ses chunks scorés contre la question
// (avec leurs vecteurs pour clustering ultérieur).
export async function chunkAndScore({ pageText, sourceId, sourceUrl, sourceTitle, questionEmbedding, signal }) {
  const chunks = chunkText(pageText, 350, 40);
  if (chunks.length === 0) return [];

  const vectors = await embedMany(chunks, signal);
  return chunks.map((text, i) => ({
    text,
    vector: vectors[i],
    score: vectors[i] ? cosine(questionEmbedding, vectors[i]) : 0,
    sourceId, sourceUrl, sourceTitle,
    indexInPage: i
  }));
}

// Legacy : rank par page (gardé pour rétrocompat éventuelle, plus utilisé).
export async function rankPageChunks({ pageText, questionEmbedding, topK = 5, signal }) {
  const chunks = chunkText(pageText, 350, 40);
  if (chunks.length === 0) return [];
  if (chunks.length <= topK) {
    return chunks.map((text, i) => ({ text, score: 1, index: i }));
  }
  const chunkEmbeddings = await embedMany(chunks, signal);
  const scored = chunks.map((text, i) => ({
    text,
    score: cosine(questionEmbedding, chunkEmbeddings[i] || []),
    index: i
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
