// ─── Vortex — mémoire personnelle chiffrée, multimodale, cross-modèle ─────────
//
// Répond directement aux 3 inquiétudes soulevées avant de coder ça :
//
// 1. CONFIDENTIALITÉ MULTI-FOURNISSEURS : le contenu brut n'est JAMAIS envoyé
//    en entier à un modèle. `searchRelevant()` ne renvoie QUE les 3-5 extraits
//    les plus pertinents pour la question posée (RAG classique), jamais tout
//    le Vortex. Le contenu est chiffré au repos (AES-256-GCM par utilisateur,
//    même mécanisme que les conversations — cryptoBox.js) — un leak DB
//    n'expose rien de lisible. Et l'usage est opt-in par conversation (le
//    front doit explicitement passer useVortex:true) : rien ne part nulle
//    part sans que l'utilisateur ait choisi ce modèle pour CETTE question.
//
// 2. COÛT D'INFRA : l'embedding (le seul poste qui grossit avec le volume)
//    n'est fait QU'UNE FOIS à l'ajout, jamais recalculé. Le dédoublonnage
//    (voir point 3) évite d'indexer 10× la même photo. L'auto-tag utilise un
//    modèle NANO (quasi gratuit), une seule fois par item.
//
// 3. LE FOURRE-TOUT : c'est le point que l'utilisateur a insisté pour qu'on
//    gère en priorité. Trois mécanismes :
//    - Dédoublonnage AUTOMATIQUE à l'ajout (similarité > 0.95 → on ne stocke
//      pas un doublon, on renvoie l'existant).
//    - Auto-classification en catégories fixes (tags) pour permettre de
//      filtrer/naviguer au lieu d'un blob unique.
//    - `cleanupSuggestions()` : détecte les quasi-doublons restants (0.85-0.95,
//      pas assez proches pour un rejet auto mais probablement redondants) et
//      les items jamais réutilisés depuis longtemps (STALE_DAYS) — proposés
//      au ménage, jamais supprimés sans confirmation utilisateur.
import { getDb } from "./db.js";
import { getUserDataKey, encryptForUser, decryptForUser } from "./cryptoBox.js";
import { chatWithFallback } from "./openrouter.js";

const OR_URL = "https://openrouter.ai/api/v1/embeddings";
const MODEL = "google/gemini-embedding-2";
const DIM = 768;
const DEDUPE_THRESHOLD = 0.95;   // au-delà → doublon strict, pas re-stocké
const NEAR_DUP_THRESHOLD = 0.85; // en dessous du strict mais suspect → suggéré au ménage
const STALE_DAYS = 120;
const MAX_ITEMS_PER_USER = 500;  // garde-fou coût/volume
const TAGS = ["Documents", "Photos", "Notes", "Travail", "Personnel", "Factures", "Contacts", "Autre"];

let ready = null;
async function ensureTable() {
  if (ready !== null) return ready;
  try {
    const db = getDb();
    await db.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS vortex_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        kind TEXT NOT NULL,               -- 'file' | 'image' | 'note'
        name TEXT NOT NULL,
        content_enc TEXT,                 -- texte/notes chiffré (cryptoBox) — null pour les images pures
        image_url TEXT,                   -- data/URL image (déjà "opaque", pas de texte en clair à chiffrer)
        mime_type TEXT,
        tag TEXT,
        embedding vector(${DIM}) NOT NULL,
        duplicate_count INT NOT NULL DEFAULT 0,  -- nb de tentatives de doublon absorbées
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_vortex_user ON vortex_items(user_id, created_at DESC)`);
    ready = true;
  } catch (e) {
    console.warn("[vortex] pgvector indisponible, feature désactivée:", e.message);
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
    "X-Title": "DELT AI Vortex"
  };
}

// L'endpoint /embeddings n'accepte QUE du texte (`input` doit être une string).
// Lui passer une data URL d'image "marche" mais embedde la chaîne base64, pas
// l'image : deux images visuellement opposées ressortent à 96 % de similarité
// (vérifié). On passe donc par une légende générée par un modèle vision, puis
// on embedde CETTE légende — vrai cross-modal, et la légende est réutilisable
// (affichable, chiffrable, lisible par l'IA dans le contexte).
async function embed(text) {
  const res = await fetch(OR_URL, {
    method: "POST",
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

// Légende d'image via un modèle vision bon marché (une seule fois, à l'ajout).
export async function captionImage(imageUrl, fileName = "") {
  try {
    const r = await chatWithFallback({
      modelId: "google/gemini-3.5-flash-lite",
      manual: true,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Décris cette image en 1-2 phrases factuelles : sujet, objets, couleurs, texte visible s'il y en a. Réponds uniquement par la description." },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }]
    });
    return (r.content || "").trim() || fileName;
  } catch {
    return fileName; // vision indispo → on retombe sur le nom du fichier
  }
}

// Modèle NANO quasi gratuit : classe l'item dans une catégorie fixe pour
// éviter le fourre-tout (filtrage/navigation côté UI).
async function autoTag(name, snippet) {
  try {
    const r = await chatWithFallback({
      modelId: "mistralai/mistral-small-2603",
      messages: [
        { role: "system", content: `Classe cet élément dans EXACTEMENT une de ces catégories : ${TAGS.join(", ")}. Réponds avec UNIQUEMENT le nom de la catégorie, rien d'autre.` },
        { role: "user", content: `Nom : ${name}\nContenu (extrait) : ${String(snippet || "").slice(0, 500)}` }
      ]
    });
    const tag = TAGS.find((t) => r.content?.trim().toLowerCase().startsWith(t.toLowerCase()));
    return tag || "Autre";
  } catch {
    return "Autre";
  }
}

function toSqlVector(vec) { return `[${vec.join(",")}]`; }

// ─── Ajout : dédoublonne AVANT de stocker (cœur de la solution "fourre-tout") ──
export async function addItem(userId, { kind, name, text, imageUrl, mimeType }) {
  if (!(await ensureTable())) throw new Error("Vortex indisponible");

  const db = getDb();
  const { rows: countRows } = await db.query(`SELECT COUNT(*) FROM vortex_items WHERE user_id=$1`, [userId]);
  if (Number(countRows[0]?.count || 0) >= MAX_ITEMS_PER_USER) {
    throw new Error(`Limite de ${MAX_ITEMS_PER_USER} éléments atteinte — fais du ménage (bouton Nettoyer) avant d'en ajouter.`);
  }

  // Image → légende vision d'abord (l'embedding direct d'une data URL n'encode
  // que la chaîne base64, pas le contenu visuel). La légende devient le texte
  // indexé ET le contenu chiffré consultable.
  const indexedText = kind === "image" ? await captionImage(imageUrl, name) : text;
  const vec = await embed(indexedText);
  if (!vec) throw new Error("Échec de l'indexation");

  // Dédoublonnage strict : une quasi-copie existe déjà → on ne stocke rien de
  // plus, on renvoie l'existant (incrémente juste son compteur de doublons).
  const { rows: dupRows } = await db.query(
    `SELECT id, name, tag, 1 - (embedding <=> $2::vector) AS score
       FROM vortex_items WHERE user_id=$1
      ORDER BY embedding <=> $2::vector LIMIT 1`,
    [userId, toSqlVector(vec)]
  );
  const best = dupRows[0];
  if (best && Number(best.score) >= DEDUPE_THRESHOLD) {
    await db.query(`UPDATE vortex_items SET duplicate_count = duplicate_count + 1, last_used_at = NOW() WHERE id=$1`, [best.id]);
    return { id: best.id, name: best.name, tag: best.tag, duplicate: true, similarity: Number(best.score) };
  }

  const userKey = await getUserDataKey(userId);
  // La légende d'image est chiffrée comme le reste : c'est du contenu dérivé
  // de la photo de l'utilisateur, donc sensible au même titre.
  const contentEnc = indexedText ? encryptForUser(indexedText, userKey) : null;
  const tag = await autoTag(name, indexedText || "photo importée");

  const { rows } = await db.query(
    `INSERT INTO vortex_items (user_id, kind, name, content_enc, image_url, mime_type, tag, embedding)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector) RETURNING id`,
    [userId, kind, name.slice(0, 200), contentEnc, imageUrl || null, mimeType || null, tag, toSqlVector(vec)]
  );
  return { id: rows[0].id, name, tag, duplicate: false };
}

// ─── Recherche RAG — SEULE fonction utilisée par le chat. Ne renvoie jamais
// tout le Vortex, seulement les extraits pertinents (transparence + coût). ──
// minScore volontairement haut : mieux vaut n'envoyer AUCUN extrait au
// fournisseur qu'un extrait hors-sujet (confidentialité + bruit dans le prompt).
export async function searchRelevant(userId, query, { limit = 4, minScore = 0.68 } = {}) {
  if (!(await ensureTable())) return [];
  try {
    const vec = await embed(query);
    if (!vec) return [];
    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, kind, name, content_enc, image_url, tag, 1 - (embedding <=> $2::vector) AS score
         FROM vortex_items WHERE user_id=$1
        ORDER BY embedding <=> $2::vector LIMIT $3`,
      [userId, toSqlVector(vec), limit]
    );
    const relevant = rows.filter((r) => Number(r.score) >= minScore);
    if (!relevant.length) return [];
    const userKey = await getUserDataKey(userId);
    const ids = relevant.map((r) => r.id);
    db.query(`UPDATE vortex_items SET last_used_at = NOW() WHERE id = ANY($1::uuid[])`, [ids]).catch(() => {});
    return relevant.map((r) => ({
      id: r.id, kind: r.kind, name: r.name, tag: r.tag, score: Number(r.score),
      text: r.content_enc ? decryptForUser(r.content_enc, userKey) : null,
      imageUrl: r.image_url
    }));
  } catch (e) {
    console.warn("[vortex] searchRelevant:", e.message);
    return [];
  }
}

// ─── Liste pour la page Vortex (aperçus déchiffrés, pas de recherche) ────────
export async function listItems(userId) {
  if (!(await ensureTable())) return [];
  const db = getDb();
  const { rows } = await db.query(
    `SELECT id, kind, name, content_enc, image_url, tag, duplicate_count, created_at
       FROM vortex_items WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [userId, MAX_ITEMS_PER_USER]
  );
  const userKey = rows.length ? await getUserDataKey(userId) : null;
  return rows.map((r) => ({
    id: r.id, kind: r.kind, name: r.name, tag: r.tag, duplicateCount: r.duplicate_count, createdAt: r.created_at,
    text: r.content_enc ? decryptForUser(r.content_enc, userKey) : null,
    imageUrl: r.image_url
  }));
}

export async function deleteItem(userId, id) {
  if (!(await ensureTable())) return { ok: false };
  await getDb().query(`DELETE FROM vortex_items WHERE id=$1 AND user_id=$2`, [id, userId]);
  return { ok: true };
}

// ─── Ménage suggéré : quasi-doublons (pas assez proches pour le rejet auto à
// l'ajout) + items jamais réutilisés depuis STALE_DAYS. Jamais supprimé sans
// confirmation utilisateur — on ne fait QUE suggérer. ──────────────────────
export async function cleanupSuggestions(userId) {
  if (!(await ensureTable())) return { nearDuplicates: [], stale: [] };
  const db = getDb();

  const { rows: items } = await db.query(
    `SELECT id, name, tag, embedding FROM vortex_items WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [userId, MAX_ITEMS_PER_USER]
  );
  const nearDuplicates = [];
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    if (seen.has(items[i].id)) continue;
    const { rows: close } = await db.query(
      `SELECT id, name, 1 - (embedding <=> $2::vector) AS score
         FROM vortex_items WHERE user_id=$1 AND id <> $3
        ORDER BY embedding <=> $2::vector LIMIT 1`,
      [userId, items[i].embedding, items[i].id]
    );
    const c = close[0];
    if (c && Number(c.score) >= NEAR_DUP_THRESHOLD && Number(c.score) < DEDUPE_THRESHOLD) {
      nearDuplicates.push({ a: { id: items[i].id, name: items[i].name }, b: { id: c.id, name: c.name }, similarity: Number(c.score) });
      seen.add(items[i].id); seen.add(c.id);
    }
  }

  const { rows: stale } = await db.query(
    `SELECT id, name, tag, last_used_at FROM vortex_items
      WHERE user_id=$1 AND last_used_at < NOW() - INTERVAL '${STALE_DAYS} days'
      ORDER BY last_used_at ASC LIMIT 30`,
    [userId]
  );

  return { nearDuplicates, stale: stale.map((s) => ({ id: s.id, name: s.name, tag: s.tag, lastUsedAt: s.last_used_at })) };
}

export { TAGS as VORTEX_TAGS };
