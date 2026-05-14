import { getDb } from "./db.js";
import { decryptForUser, encryptForUser, getUserDataKey, isEncrypted } from "./cryptoBox.js";

// Désactivé par défaut pour la performance (Supabase chiffre déjà au repos).
// Mettre ENCRYPT_CONVERSATIONS=true pour activer le chiffrement zero-knowledge.
const ENCRYPT = String(process.env.ENCRYPT_CONVERSATIONS || "").toLowerCase() === "true";

function cleanMessage(message) {
  return {
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content ?? ""),
    tier: message.tier ?? message.tier_used ?? null,
    modelId: message.model?.id ?? message.modelId ?? message.model_id ?? null,
    tokensOut: Number.isFinite(Number(message.tokensOut ?? message.tokens_out))
      ? Number(message.tokensOut ?? message.tokens_out)
      : null
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

export async function listConversations(userId) {
  const db = getDb();
  const userKey = ENCRYPT ? await getUserDataKey(userId) : null;
  const { rows } = await db.query(
    `SELECT c.id, c.title, c.created_at, c.updated_at, c.project_id, COUNT(m.id)::int AS message_count
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
    `SELECT role, content, tier_used, model_id, tokens_out, created_at
     FROM messages
     WHERE conv_id = $1 AND user_id = $2
     ORDER BY created_at ASC, id ASC`,
    [conversationId, userId]
  );

  // Récupère la clé user uniquement si une des valeurs est chiffrée (legacy)
  const needsKey =
    isEncrypted(conv.title) ||
    rows.some((r) => isEncrypted(r.content));
  const key = needsKey ? await getUserDataKey(userId) : null;

  const messages = rows.map((row) => ({
    role: row.role,
    content: isEncrypted(row.content) ? decryptForUser(row.content, key) : row.content,
    tier: row.tier_used ?? undefined,
    model: row.model_id ? { id: row.model_id } : undefined,
    tokensOut: row.tokens_out ?? undefined,
    createdAt: new Date(row.created_at).getTime()
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

  const messages = rawMessages.map(cleanMessage).filter((m) => m.content.trim());
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

      await client.query(
        `INSERT INTO messages (user_id, conv_id, role, content, tier_used, model_id, tokens_out)
         SELECT * FROM UNNEST (
           $1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[]
         )`,
        [userIds, convIds, roles, contents, tiers, models, tokensO]
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
