import { getDb } from "./db.js";
import { decryptForUser, encryptForUser, getUserDataKey } from "./cryptoBox.js";

function cleanMessage(message) {
  return {
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content ?? ""),
    tier: message.tier ?? message.tier_used ?? null,
    modelId: message.model?.id ?? message.modelId ?? message.model_id ?? null,
    tokensOut: Number.isFinite(Number(message.tokensOut ?? message.tokens_out)) ? Number(message.tokensOut ?? message.tokens_out) : null
  };
}

function titleFromMessages(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  const raw = firstUser?.content || "Nouvelle conversation";
  return raw.slice(0, 48).replace(/\n/g, " ") + (raw.length > 48 ? "..." : "");
}

export async function listConversations(userId) {
  const db = getDb();
  const userKey = await getUserDataKey(userId);
  const { rows } = await db.query(
    `SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id)::int AS message_count
     FROM conversations c
     LEFT JOIN messages m ON m.conv_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.updated_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    title: decryptForUser(row.title, userKey),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    messageCount: row.message_count,
    messages: []
  }));
}

export async function getConversation(userId, conversationId) {
  const db = getDb();
  const userKey = await getUserDataKey(userId);
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

  const messages = rows.map((row) => ({
    role: row.role,
    content: decryptForUser(row.content, userKey),
    tier: row.tier_used ?? undefined,
    model: row.model_id ? { id: row.model_id } : undefined,
    tokensOut: row.tokens_out ?? undefined,
    createdAt: new Date(row.created_at).getTime()
  }));

  return {
    id: conv.id,
    title: decryptForUser(conv.title, userKey),
    createdAt: new Date(conv.created_at).getTime(),
    updatedAt: new Date(conv.updated_at).getTime(),
    messageCount: messages.length,
    messages
  };
}

export async function saveConversation(userId, conversationId, rawMessages) {
  if (!conversationId) throw new Error("conversationId requis");
  if (!Array.isArray(rawMessages)) throw new Error("messages requis");

  const messages = rawMessages.map(cleanMessage).filter((message) => message.content.trim());
  const title = titleFromMessages(messages);
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const userKey = await getUserDataKey(userId, client);
    const upsert = await client.query(
      `INSERT INTO conversations (id, user_id, title, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id)
       DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
       WHERE conversations.user_id = EXCLUDED.user_id
      RETURNING id`,
      [conversationId, userId, encryptForUser(title, userKey)]
    );
    if (!upsert.rows[0]) throw new Error("Conversation introuvable");

    await client.query(
      `DELETE FROM messages WHERE conv_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    for (const message of messages) {
      await client.query(
        `INSERT INTO messages (user_id, conv_id, role, content, tier_used, model_id, tokens_out)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          conversationId,
          message.role,
          encryptForUser(message.content, userKey),
          message.tier,
          message.modelId,
          message.tokensOut
        ]
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
