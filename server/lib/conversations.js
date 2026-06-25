import { getDb } from "./db.js";
import { decryptForUser, encryptForUser, getUserDataKey, isEncrypted } from "./cryptoBox.js";

// Chiffrement zero-knowledge AU REPOS activé par défaut : le contenu, les titres
// et le meta (URLs images/fichiers) sont chiffrés en AES-256-GCM avec la DEK du
// user (envelope encryption). Le clair n'existe qu'en RAM le temps de la requête.
// Mettre ENCRYPT_CONVERSATIONS=false pour désactiver (déconseillé). Le coût est
// négligeable grâce au cache DEK (cf. cryptoBox.js) — AES-NI ~1–3 Go/s.
const ENCRYPT = String(process.env.ENCRYPT_CONVERSATIONS ?? "true").toLowerCase() !== "false";

// Champs riches à persister (images, fichiers générés, vidéo, musique, recherche…)
const META_FIELDS = ["imageUrl", "imageUrls", "generatedImages", "artifacts", "videoUrl", "musicTracks", "webResults", "deepSearch", "modelSwap", "toolCalls"];
function pickMeta(message) {
  const meta = {};
  for (const k of META_FIELDS) if (message[k] != null) meta[k] = message[k];
  return Object.keys(meta).length ? meta : null;
}

function cleanMessage(message) {
  return {
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content ?? ""),
    tier: message.tier ?? message.tier_used ?? null,
    modelId: message.model?.id ?? message.modelId ?? message.model_id ?? null,
    tokensOut: Number.isFinite(Number(message.tokensOut ?? message.tokens_out))
      ? Number(message.tokensOut ?? message.tokens_out)
      : null,
    meta: pickMeta(message)
  };
}

function titleFromMessages(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  const raw = firstUser?.content || "Nouvelle conversation";
  return raw.slice(0, 48).replace(/\n/g, " ") + (raw.length > 48 ? "..." : "");
}

// Décrypte si chiffré (legacy), sinon renvoie tel quel
async function maybeDecrypt(value, userKey) {
  if (!isEncrypted(value)) return value ?? "";
  return decryptForUser(value, userKey);
}

async function maybeEncrypt(value, userKey) {
  if (!ENCRYPT) return value;
  return encryptForUser(value, userKey);
}

// Le meta (URLs d'images, fichiers générés, vidéo, recherche…) est lui aussi
// sensible. On chiffre le JSON entier dans une enveloppe { _enc: "enc:u1:…" }
// pour que la colonne jsonb ne révèle rien au repos.
function encryptMeta(meta, userKey) {
  if (!meta) return null;
  if (!ENCRYPT) return JSON.stringify(meta);
  return JSON.stringify({ _enc: encryptForUser(JSON.stringify(meta), userKey) });
}
function metaIsEncrypted(meta) {
  return meta && typeof meta === "object" && typeof meta._enc === "string" && isEncrypted(meta._enc);
}
function decryptMeta(meta, userKey) {
  if (!meta || typeof meta !== "object") return {};
  if (!metaIsEncrypted(meta)) return meta; // legacy clair
  try { return JSON.parse(decryptForUser(meta._enc, userKey)); }
  catch { return {}; }
}

export async function listConversations(userId) {
  const db = getDb();
  const userKey = ENCRYPT ? await getUserDataKey(userId) : null;
  const { rows } = await db.query(
    `SELECT c.id, c.title, c.created_at, c.updated_at, c.project_id, COUNT(m.id)::int AS message_count,
            (SELECT model_id FROM messages WHERE conv_id = c.id AND model_id IS NOT NULL ORDER BY created_at ASC LIMIT 1) AS last_model_id
     FROM conversations c
     LEFT JOIN messages m ON m.conv_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.updated_at DESC`,
    [userId]
  );
  // Si on lit des titres legacy chiffrés, on les déchiffre quand même
  const needsKey = !userKey && rows.some((r) => isEncrypted(r.title));
  const key = userKey || (needsKey ? await getUserDataKey(userId) : null);

  return rows.map((row) => ({
    id: row.id,
    title: isEncrypted(row.title) ? decryptForUser(row.title, key) : row.title,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    projectId: row.project_id || null,
    messageCount: row.message_count,
    lastModelId: row.last_model_id || null,
    messages: []
  }));
}

export async function getConversation(userId, conversationId) {
  const db = getDb();
  const { rows: convRows } = await db.query(
    `SELECT id, title, created_at, updated_at
     FROM conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  const conv = convRows[0];
  if (!conv) return null;

  const { rows } = await db.query(
    `SELECT role, content, tier_used, model_id, tokens_out, meta, created_at
     FROM messages
     WHERE conv_id = $1 AND user_id = $2
     ORDER BY created_at ASC, id ASC`,
    [conversationId, userId]
  );

  // Récupère la clé user uniquement si une des valeurs est chiffrée (legacy)
  const needsKey =
    isEncrypted(conv.title) ||
    rows.some((r) => isEncrypted(r.content) || metaIsEncrypted(r.meta));
  const key = needsKey ? await getUserDataKey(userId) : null;

  const messages = rows.map((row) => ({
    role: row.role,
    content: isEncrypted(row.content) ? decryptForUser(row.content, key) : row.content,
    tier: row.tier_used ?? undefined,
    model: row.model_id ? { id: row.model_id } : undefined,
    tokensOut: row.tokens_out ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    ...decryptMeta(row.meta, key)
  }));

  return {
    id: conv.id,
    title: isEncrypted(conv.title) ? decryptForUser(conv.title, key) : conv.title,
    createdAt: new Date(conv.created_at).getTime(),
    updatedAt: new Date(conv.updated_at).getTime(),
    messageCount: messages.length,
    messages
  };
}

export async function saveConversation(userId, conversationId, rawMessages) {
  if (!conversationId) throw new Error("conversationId requis");
  if (!Array.isArray(rawMessages)) throw new Error("messages requis");

  // Garde aussi les messages SANS texte mais avec média (image/fichier/vidéo/musique).
  const messages = rawMessages.map(cleanMessage).filter((m) => m.content.trim() || m.meta);
  const title = titleFromMessages(messages);
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const userKey = ENCRYPT ? await getUserDataKey(userId, client) : null;

    const upsert = await client.query(
      `INSERT INTO conversations (id, user_id, title, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id)
       DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
       WHERE conversations.user_id = EXCLUDED.user_id
      RETURNING id`,
      [conversationId, userId, ENCRYPT ? encryptForUser(title, userKey) : title]
    );
    if (!upsert.rows[0]) throw new Error("Conversation introuvable");

    await client.query(
      `DELETE FROM messages WHERE conv_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    // ─── BATCH INSERT via UNNEST (1 seul roundtrip au lieu de N) ─────────
    if (messages.length > 0) {
      const userIds  = messages.map(() => userId);
      const convIds  = messages.map(() => conversationId);
      const roles    = messages.map((m) => m.role);
      const contents = messages.map((m) => ENCRYPT ? encryptForUser(m.content, userKey) : m.content);
      const tiers    = messages.map((m) => m.tier);
      const models   = messages.map((m) => m.modelId);
      const tokensO  = messages.map((m) => m.tokensOut);
      const metas    = messages.map((m) => encryptMeta(m.meta, userKey));

      await client.query(
        `INSERT INTO messages (user_id, conv_id, role, content, tier_used, model_id, tokens_out, meta)
         SELECT * FROM UNNEST (
           $1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[], $8::jsonb[]
         )`,
        [userIds, convIds, roles, contents, tiers, models, tokensO, metas]
      );
    }

    await client.query("COMMIT");
    return { id: conversationId, title, messageCount: messages.length, updatedAt: Date.now() };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteConversation(userId, conversationId) {
  const db = getDb();
  const { rowCount } = await db.query(
    `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rowCount > 0;
}
