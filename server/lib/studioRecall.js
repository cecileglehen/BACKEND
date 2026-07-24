// ─── Studio Recall — google/gemini-embedding-2 (multimodal texte+image) ──────
//
// Utilité concrète (pas un gadget) : Gemini Embedding 2 place texte ET image
// dans le MÊME espace vectoriel — on peut donc chercher une image en tapant
// une phrase, ET comparer un nouveau prompt aux images déjà générées.
//
// Deux features réelles construites là-dessus :
//   1. Recherche sémantique dans l'historique Studio ("mon chat avec un
//      chapeau" retrouve l'image même si son prompt d'origine disait autre
//      chose) — l'historique actuel (localStorage, tri chronologique) devient
//      vite inutilisable après quelques dizaines de générations.
//   2. Anti-doublon AVANT paiement : si le prompt ressemble fortement (>0.90)
//      à une image déjà générée par cet utilisateur, on lui propose de la
//      réutiliser GRATUITEMENT au lieu de payer une nouvelle génération quasi
//      identique — économie réelle de crédits, chose qu'aucun concurrent
//      (Mammouth/Poe) ne fait aujourd'hui.
import { getDb } from "./db.js";

const OR_URL = "https://openrouter.ai/api/v1/embeddings";
const MODEL = "google/gemini-embedding-2";
const DIM = 768; // recommandé par Google : bon compromis précision/coût stockage
const REUSE_THRESHOLD = 0.90;

let ready = null;
async function ensureTable() {
  if (ready !== null) return ready;
  try {
    const db = getDb();
    await db.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS studio_image_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        image_url TEXT NOT NULL,
        prompt TEXT NOT NULL,
        model_id TEXT,
        embedding vector(${DIM}) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_studio_emb_user ON studio_image_embeddings(user_id, created_at DESC)`);
    ready = true;
  } catch (e) {
    console.warn("[studioRecall] pgvector indisponible, feature désactivée:", e.message);
    ready = false;
  }
  return ready;
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

// L'endpoint /embeddings n'accepte que du TEXTE (`input` = string). Passer une
// data URL d'image embedde la chaîne base64, pas l'image (deux images opposées
// ressortent à 96 % de similarité — vérifié). Ici c'est sans conséquence : on
// indexe le PROMPT de génération, qui décrit exactement l'image produite — donc
// prompt↔prompt, un espace cohérent et gratuit (pas d'appel vision).
async function embed(text, signal) {
  const res = await fetch(OR_URL, {
    method: "POST",
    signal,
    headers: headers(),
    body: JSON.stringify({ model: MODEL, input: String(text || "").slice(0, 8000), dimensions: DIM })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`gemini-embedding-2 ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.data?.[0]?.embedding || null;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Avant de payer une génération : cherche une image très similaire (même
// espace vectoriel texte↔image) déjà générée par CET utilisateur.
// Renvoie { reused: true, ... } ou null (silencieux si indispo — n'empêche
// jamais une génération de se lancer).
export async function findReusableImage(userId, prompt, signal) {
  if (!(await ensureTable())) return null;
  try {
    const qVec = await embed(prompt, signal);
    if (!qVec) return null;
    const db = getDb();
    const { rows } = await db.query(
      `SELECT image_url, prompt, model_id, 1 - (embedding <=> $2::vector) AS score
         FROM studio_image_embeddings
        WHERE user_id = $1
        ORDER BY embedding <=> $2::vector
        LIMIT 1`,
      [userId, `[${qVec.join(",")}]`]
    );
    const best = rows[0];
    if (!best || Number(best.score) < REUSE_THRESHOLD) return null;
    return { url: best.image_url, prompt: best.prompt, modelId: best.model_id, similarity: Number(best.score) };
  } catch (e) {
    console.warn("[studioRecall] findReusableImage:", e.message);
    return null;
  }
}

// Après une génération réussie : indexe l'image (fire-and-forget, jamais
// bloquant pour la réponse utilisateur). Sert aussi au backfill des galeries
// déjà constituées (l'historique Studio vit côté navigateur : sans ce rattrapage
// l'index resterait vide et la recherche ne trouverait jamais rien).
// Idempotent : une même image déjà indexée n'est pas ré-insérée.
export async function indexGeneratedImage(userId, { url, prompt, modelId }) {
  if (!(await ensureTable())) return { ok: false };
  if (!url || !String(prompt || "").trim()) return { ok: false };
  try {
    const db = getDb();
    const { rows: exists } = await db.query(
      `SELECT 1 FROM studio_image_embeddings WHERE user_id=$1 AND image_url=$2 LIMIT 1`,
      [userId, url]
    );
    if (exists.length) return { ok: true, already: true };

    const vec = await embed(prompt); // indexe le prompt, pas les octets de l'image
    if (!vec) return { ok: false };
    await db.query(
      `INSERT INTO studio_image_embeddings (user_id, image_url, prompt, model_id, embedding)
       VALUES ($1, $2, $3, $4, $5::vector)`,
      [userId, url, String(prompt || "").slice(0, 2000), modelId || null, `[${vec.join(",")}]`]
    );
    return { ok: true };
  } catch (e) {
    console.warn("[studioRecall] indexGeneratedImage:", e.message);
    return { ok: false, error: e.message };
  }
}

// Rattrapage groupé d'une galerie existante (max 40 par appel pour borner le coût).
export async function backfillGallery(userId, items = []) {
  let indexed = 0, skipped = 0;
  for (const it of items.slice(0, 40)) {
    const r = await indexGeneratedImage(userId, { url: it.url, prompt: it.prompt, modelId: it.modelId });
    if (r?.already) skipped++;
    else if (r?.ok) indexed++;
  }
  return { indexed, skipped };
}

// Normalise pour la comparaison lexicale : minuscules, sans accents.
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Recherche HYBRIDE : sémantique (cross-langue — « noir » retrouve « a black
// cat ») + lexicale (le mot exact tapé pèse lourd). Le pur vectoriel décroche
// sur les requêtes d'un seul mot : les scores se tassent (0.55-0.64) et un
// prompt sans rapport peut passer devant celui qui contient littéralement le
// terme. Le boost lexical rend ces cas déterministes.
export async function searchGallery(userId, query, limit = 24) {
  if (!(await ensureTable())) return [];
  try {
    const qVec = await embed(query);
    if (!qVec) return [];
    const db = getDb();
    // On élargit le pool avant de re-scorer (sinon un bon match lexical
    // pourrait être coupé par le tri purement vectoriel).
    const { rows } = await db.query(
      `SELECT image_url, prompt, model_id, created_at, 1 - (embedding <=> $2::vector) AS score
         FROM studio_image_embeddings
        WHERE user_id = $1
        ORDER BY embedding <=> $2::vector
        LIMIT $3`,
      [userId, `[${qVec.join(",")}]`, Math.max(limit * 3, 60)]
    );

    const terms = norm(query).split(/\s+/).filter((t) => t.length >= 3);
    const scored = rows.map((r) => {
      const semantic = Number(r.score);
      const p = norm(r.prompt);
      // Part des mots de la requête réellement présents dans le prompt.
      const hits = terms.length ? terms.filter((t) => p.includes(t)).length / terms.length : 0;
      return {
        url: r.image_url, prompt: r.prompt, modelId: r.model_id, createdAt: r.created_at,
        score: Math.min(1, semantic + hits * 0.3),
        semantic, lexical: hits
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  } catch (e) {
    console.warn("[studioRecall] searchGallery:", e.message);
    return [];
  }
}
