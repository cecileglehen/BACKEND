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
