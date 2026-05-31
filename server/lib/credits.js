import { getDb } from "./db.js";
import { PLANS } from "../config/plans.js";

// Crédits en mémoire si DB indisponible
const memCredits = new Map();

export async function getCredits(userId) {
  try {
    const db = getDb();
    const { rows } = await db.query(`SELECT credits FROM users WHERE id=$1`, [userId]);
    return rows[0]?.credits ?? 0;
  } catch {
    return memCredits.get(userId) ?? 0;
  }
}

export async function deductCredits(userId, amount) {
  if (amount <= 0) return getCredits(userId);
  if (!process.env.DATABASE_URL) {
    const next = Math.max(0, (memCredits.get(userId) ?? 0) - amount);
    memCredits.set(userId, next);
    return next;
  }
  const db = getDb();
  const { rows } = await db.query(
    `UPDATE users SET credits = GREATEST(0, credits - $2) WHERE id=$1 RETURNING credits`,
    [userId, amount]
  );
  if (!rows[0]) throw new Error("Utilisateur introuvable pour débit crédits");
  memCredits.set(userId, Number(rows[0].credits));
  return Number(rows[0].credits);
}

export async function hasEnoughCredits(userId, cost) {
  if (cost <= 0) return true;
  const credits = await getCredits(userId);
  return credits >= cost;
}

// Ajoute des crédits au solde (top-up / pack prépayé). Renvoie le nouveau solde.
export async function addCredits(userId, amount) {
  if (!(amount > 0)) return getCredits(userId);
  if (!process.env.DATABASE_URL) {
    const next = (memCredits.get(userId) ?? 0) + amount;
    memCredits.set(userId, next);
    return next;
  }
  const db = getDb();
  const { rows } = await db.query(
    `UPDATE users SET credits = credits + $2 WHERE id=$1 RETURNING credits`,
    [userId, amount]
  );
  if (!rows[0]) throw new Error("Utilisateur introuvable pour ajout crédits");
  memCredits.set(userId, Number(rows[0].credits));
  return Number(rows[0].credits);
}

// Attribue les crédits mensuels au renouvellement d'abonnement
export async function grantPlanCredits(userId, plan) {
  const planInfo = PLANS[plan];
  if (!planInfo) return;
  try {
    const db = getDb();
    await db.query(
      `UPDATE users SET credits = credits + $2 WHERE id=$1`,
      [userId, planInfo.credits]
    );
  } catch { /* ignore */ }
}

// Reset crédits mensuels (appelé par webhook PayPal RENEWED)
export async function resetMonthlyCredits(userId, plan) {
  const planInfo = PLANS[plan];
  if (!planInfo) return;
  try {
    const db = getDb();
    await db.query(
      `UPDATE users SET credits = $2 WHERE id=$1`,
      [userId, planInfo.credits]
    );
  } catch { /* ignore */ }
}

// ─── Crédits API (pool séparé pour /v1) ──────────────────────────────────────
export async function getApiCredits(userId) {
  try {
    const db = getDb();
    const { rows } = await db.query(`SELECT api_credits FROM users WHERE id=$1`, [userId]);
    return Number(rows[0]?.api_credits ?? 0);
  } catch {
    return 0;
  }
}

export async function deductApiCredits(userId, amount) {
  if (amount <= 0) return getApiCredits(userId);
  const db = getDb();
  const { rows } = await db.query(
    `UPDATE users SET api_credits = GREATEST(0, api_credits - $2) WHERE id=$1 RETURNING api_credits`,
    [userId, amount]
  );
  if (!rows[0]) throw new Error("Utilisateur introuvable pour débit crédits API");
  return Number(rows[0].api_credits);
}

export async function hasEnoughApiCredits(userId, cost) {
  if (cost <= 0) return true;
  const credits = await getApiCredits(userId);
  return credits >= cost;
}

// ─── Free Nano tokens (Mistral Small 4 — legacy column, plan FREE) ──────────
export const FREE_NANO_MODEL_ID = "mistralai/mistral-small-2603";
const FREE_NANO_LIMIT = 50000;

export async function getFreeNanoTokens(userId) {
  const db = getDb();
  const month = new Date().toISOString().slice(0, 7);
  const { rows } = await db.query(
    `SELECT free_nano_tokens, free_nano_month FROM users WHERE id=$1`, [userId]
  );
  const row = rows[0];
  if (!row) return 0;
  if (row.free_nano_month !== month) {
    await db.query(
      `UPDATE users SET free_nano_tokens=$2, free_nano_month=$3 WHERE id=$1`,
      [userId, FREE_NANO_LIMIT, month]
    );
    return FREE_NANO_LIMIT;
  }
  return row.free_nano_tokens ?? 0;
}

export async function deductFreeNanoTokens(userId, tokens) {
  const db = getDb();
  await db.query(
    `UPDATE users SET free_nano_tokens = GREATEST(0, free_nano_tokens - $2) WHERE id=$1`,
    [userId, Math.ceil(tokens)]
  );
}

// ─── Generic per-model free token pools (JSONB free_model_tokens) ───────────
// Shape: { "<modelId>": { tokens: 12345, month: "2026-05" } }
export async function getFreeModelTokens(userId, modelId, limit) {
  const db = getDb();
  const month = new Date().toISOString().slice(0, 7);
  const { rows } = await db.query(
    `SELECT free_model_tokens FROM users WHERE id=$1`, [userId]
  );
  if (!rows[0]) return 0;
  const map = rows[0].free_model_tokens || {};
  const entry = map[modelId];
  if (!entry || entry.month !== month) {
    map[modelId] = { tokens: limit, month };
    await db.query(
      `UPDATE users SET free_model_tokens = $2 WHERE id=$1`,
      [userId, JSON.stringify(map)]
    );
    return limit;
  }
  return Number(entry.tokens) || 0;
}

export async function deductFreeModelTokens(userId, modelId, tokens) {
  const db = getDb();
  const month = new Date().toISOString().slice(0, 7);
  const n = Math.ceil(tokens);
  // jsonb_set on the {modelId,tokens} path. We compute new value in JS for safety.
  const { rows } = await db.query(
    `SELECT free_model_tokens FROM users WHERE id=$1`, [userId]
  );
  if (!rows[0]) return;
  const map = rows[0].free_model_tokens || {};
  const cur = map[modelId];
  if (!cur || cur.month !== month) return;
  map[modelId] = { tokens: Math.max(0, (Number(cur.tokens) || 0) - n), month };
  await db.query(
    `UPDATE users SET free_model_tokens = $2 WHERE id=$1`,
    [userId, JSON.stringify(map)]
  );
}

// Transfère X Cr du pool plan vers le pool API (ou inverse si toApi=false)
export async function transferCredits(userId, amount, toApi = true) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant invalide");
  }
  const db = getDb();
  // Transaction atomique
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (toApi) {
      const { rows } = await client.query(
        `UPDATE users
           SET credits = credits - $2,
               api_credits = api_credits + $2
         WHERE id = $1 AND credits >= $2
         RETURNING credits, api_credits`,
        [userId, amount]
      );
      if (!rows[0]) throw new Error("Crédits plan insuffisants");
      await client.query("COMMIT");
      return rows[0];
    } else {
      const { rows } = await client.query(
        `UPDATE users
           SET api_credits = api_credits - $2,
               credits = credits + $2
         WHERE id = $1 AND api_credits >= $2
         RETURNING credits, api_credits`,
        [userId, amount]
      );
      if (!rows[0]) throw new Error("Crédits API insuffisants");
      await client.query("COMMIT");
      return rows[0];
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
