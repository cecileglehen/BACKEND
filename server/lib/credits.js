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
  if (amount <= 0) return;
  try {
    const db = getDb();
    await db.query(
      `UPDATE users SET credits = GREATEST(0, credits - $2) WHERE id=$1`,
      [userId, amount]
    );
    memCredits.set(userId, Math.max(0, (memCredits.get(userId) ?? 0) - amount));
  } catch {
    memCredits.set(userId, Math.max(0, (memCredits.get(userId) ?? 0) - amount));
  }
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
