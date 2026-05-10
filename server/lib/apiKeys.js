import crypto from "node:crypto";
import { getDb } from "./db.js";

// Format : sk-delt-<48 chars hex>
function generateRawKey() {
  const random = crypto.randomBytes(24).toString("hex");
  return `sk-delt-${random}`;
}

function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function createApiKey(userId, name) {
  const db = getDb();
  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12); // "sk-delt-abcd"

  const { rows } = await db.query(
    `INSERT INTO api_keys (user_id, key_hash, key_prefix, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, key_prefix, name, created_at`,
    [userId, keyHash, keyPrefix, name?.slice(0, 100) || null]
  );

  return { ...rows[0], key: rawKey };
}

export async function listApiKeys(userId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT id, key_prefix, name, last_used_at, created_at, revoked_at
     FROM api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function revokeApiKey(userId, keyId) {
  const db = getDb();
  const { rowCount } = await db.query(
    `UPDATE api_keys SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [keyId, userId]
  );
  return rowCount > 0;
}

export async function verifyApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith("sk-delt-")) return null;
  const db = getDb();
  const keyHash = hashKey(rawKey);
  const { rows } = await db.query(
    `SELECT k.id, k.user_id, k.revoked_at, u.email, u.plan, u.status
     FROM api_keys k
     JOIN users u ON u.id = k.user_id
     WHERE k.key_hash = $1 AND u.deleted_at IS NULL`,
    [keyHash]
  );
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  if (row.status === "suspended" || row.status === "deleted") return null;

  db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => {});

  return { id: row.user_id, email: row.email, plan: row.plan, keyId: row.id };
}
