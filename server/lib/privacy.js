import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db.js";
import { decryptForUser, getUserDataKey } from "./cryptoBox.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CODE_SESSIONS_ROOT = path.join(__dirname, "..", "data", "code-sessions");

export function hashIp(req) {
  const raw = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function userAgent(req) {
  return String(req.headers["user-agent"] || "").slice(0, 500) || null;
}

export async function recordConsent(userId, consentType, req, granted = true) {
  const db = getDb();
  await db.query(
    `INSERT INTO gdpr_consents (user_id, consent_type, granted, ip_hash, user_agent, granted_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NULL)
     ON CONFLICT (user_id, consent_type)
     DO UPDATE SET granted = EXCLUDED.granted,
                   ip_hash = EXCLUDED.ip_hash,
                   user_agent = EXCLUDED.user_agent,
                   granted_at = NOW(),
                   revoked_at = NULL`,
    [userId, consentType, granted, hashIp(req), userAgent(req)]
  );
}

export async function audit(userId, action, req, metadata = {}) {
  const db = getDb();
  await db.query(
    `INSERT INTO audit_logs (user_id, action, ip_hash, metadata)
     VALUES ($1, $2, $3, $4)`,
    [userId, action, hashIp(req), metadata]
  );
}

export async function createGdprRequest(userId, email, requestType, req, notes = null) {
  const db = getDb();
  const { rows } = await db.query(
    `INSERT INTO gdpr_requests (user_id, email, request_type, status, notes)
     VALUES ($1, $2, $3, 'done', $4)
     RETURNING id, request_type, status, created_at`,
    [userId, email, requestType, notes]
  );
  await audit(userId, `gdpr_${requestType}`, req, { requestId: rows[0].id });
  return rows[0];
}

export async function exportUserData(userId, req) {
  const db = getDb();
  const one = async (sql, params = [userId]) => (await db.query(sql, params)).rows;
  let codeSessions = [];
  try {
    codeSessions = await fs.readdir(path.join(CODE_SESSIONS_ROOT, userId));
  } catch { /* no local code sessions */ }

  const userRows = await one(
    `SELECT id, email, auth_provider, plan, status, credits, api_credits,
            sub_start, sub_end, age_verified, created_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`
  );
  const user = userRows[0];
  if (!user) throw new Error("Utilisateur introuvable");
  const userKey = await getUserDataKey(userId);

  const messages = await one(
    `SELECT conv_id, role, content, tier_used, model_id, tokens_in, tokens_out, created_at
     FROM messages
     WHERE user_id = $1
     ORDER BY created_at ASC`
  );

  const data = {
    exportedAt: new Date().toISOString(),
    user,
    consents: await one(
      `SELECT consent_type, granted, granted_at, revoked_at
       FROM gdpr_consents
       WHERE user_id = $1
       ORDER BY granted_at DESC`
    ),
    apiKeys: await one(
      `SELECT id, key_prefix, name, last_used_at, revoked_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`
    ),
    usageWindows: await one(
      `SELECT tier, window_start, messages_count, tokens_in, tokens_out
       FROM usage_windows
       WHERE user_id = $1
       ORDER BY window_start DESC`
    ),
    weeklyUsage: await one(
      `SELECT tier, week_start, messages_count
       FROM weekly_usage
       WHERE user_id = $1
       ORDER BY week_start DESC`
    ),
    conversations: await one(
      `SELECT id, title, summary, created_at, updated_at
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`
    ),
    messages: messages.map((message) => ({ ...message, content: decryptForUser(message.content, userKey) })),
    gdprRequests: await one(
      `SELECT id, request_type, status, notes, created_at, resolved_at
       FROM gdpr_requests
       WHERE user_id = $1
       ORDER BY created_at DESC`
    ),
    codeSessions
  };

  await createGdprRequest(userId, user.email, "access", req, "Export utilisateur généré");
  return data;
}

export async function deleteUserData(userId, req) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const user = rows[0];
  if (!user) throw new Error("Utilisateur introuvable");

  await createGdprRequest(userId, user.email, "delete", req, "Compte anonymisé depuis l'espace utilisateur");
  await db.query(`SELECT anonymize_user($1)`, [userId]);
  await fs.rm(path.join(CODE_SESSIONS_ROOT, userId), { recursive: true, force: true }).catch(() => {});
  return { ok: true };
}
