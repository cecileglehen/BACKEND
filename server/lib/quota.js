import { getDb } from "./db.js";
import { findModelInCatalog } from "../config/models.js";

// ─── Quota glissant façon Mammouth ───────────────────────────────────────────
// Pas de cap mensuel : chaque utilisateur a un budget de conso (en Cr) par
// fenêtre glissante, ENTIÈREMENT renouvelé à expiration. Quand la fenêtre est
// vidée → bascule auto vers un modèle léger/gratuit (coût ~0). Les crédits
// top-up servent d'overflow au-dessus de la fenêtre.
//
// Plafond anti-abus invisible : un ceiling glissant 24h (= N fenêtres pleines)
// borne le PIRE cas (bot 24/7). Réglé haut → invisible aux users légitimes, il
// ne stoppe que la conso scriptée continue. N'affecte PAS les crédits top-up payés.

export const WINDOW_HOURS = Number(process.env.QUOTA_WINDOW_HOURS || 3);

// Budget de conso par fenêtre, par plan (Cr de conso réelle = coût provider × marge).
export const WINDOW_QUOTA = {
  FREE:  Number(process.env.QUOTA_FREE  || 40),
  BASIC: Number(process.env.QUOTA_BASIC || 350),
  PLUS:  Number(process.env.QUOTA_PLUS  || 800),
  PRO:   Number(process.env.QUOTA_PRO   || 2200),
  ULTRA: Number(process.env.QUOTA_ULTRA || 6000)
};

// Plafond invisible : nb de fenêtres pleines max consommables par 24h glissantes.
// 6 ≈ bien au-dessus de tout usage humain (≈ 6×3h = 18h actives/jour) ; ne stoppe
// que les bots. Baisse-le (ex. 4) pour border davantage, monte-le pour relâcher.
export const DAILY_CAP_WINDOWS = Number(process.env.QUOTA_DAILY_CAP_WINDOWS || 6);
export const DAILY_HOURS = 24;

// ─── Garde-fou mensuel invisible : perte bornée à 15% du CA max ──────────────
// 1 Cr consommé = 1/200 $ de coût provider. Plafond mensuel de conso premium =
// CA_net × 1,15 → au-delà, bascule gratuit pour le reste du mois. Invisible aux
// users normaux (qui consomment bien en-dessous), il ne borne que les très gros.
// Défauts calés sur prix×1,08(€→$)×0,90(frais)×1,15×200 Cr/$. Surchargeable par env.
export const MONTHLY_LOSS_CAP = {
  FREE:  Number(process.env.QUOTA_MONTHLY_FREE  || 150),
  BASIC: Number(process.env.QUOTA_MONTHLY_BASIC || 2200),
  PLUS:  Number(process.env.QUOTA_MONTHLY_PLUS  || 5100),
  PRO:   Number(process.env.QUOTA_MONTHLY_PRO   || 16700),
  ULTRA: Number(process.env.QUOTA_MONTHLY_ULTRA || 44000)
};

export function windowQuotaFor(plan) {
  return WINDOW_QUOTA[plan] ?? WINDOW_QUOTA.FREE;
}
export function dailyCapFor(plan) {
  return windowQuotaFor(plan) * DAILY_CAP_WINDOWS;
}
export function monthlyCapFor(plan) {
  return MONTHLY_LOSS_CAP[plan] ?? MONTHLY_LOSS_CAP.FREE;
}
function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
// 1er du mois suivant (UTC) = moment où le garde-fou mensuel se relâche.
function nextMonthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

// État de la fenêtre courante + ceiling 24h (reset logique si expirés). Lecture seule.
export async function getWindow(userId, plan) {
  const quota = windowQuotaFor(plan);
  const dailyCap = dailyCapFor(plan);
  const ms = WINDOW_HOURS * 3600 * 1000;
  const dayMs = DAILY_HOURS * 3600 * 1000;
  const now = Date.now();
  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT quota_window_start, quota_window_used, daily_premium_start, daily_premium_used, monthly_premium_used, monthly_premium_month FROM users WHERE id=$1`, [userId]
    );
    const start = rows[0]?.quota_window_start ? new Date(rows[0].quota_window_start).getTime() : 0;
    const expired = !start || now - start >= ms;
    const used = expired ? 0 : Number(rows[0]?.quota_window_used || 0);
    const winStart = expired ? now : start;

    const dStart = rows[0]?.daily_premium_start ? new Date(rows[0].daily_premium_start).getTime() : 0;
    const dExpired = !dStart || now - dStart >= dayMs;
    const dailyUsed = dExpired ? 0 : Number(rows[0]?.daily_premium_used || 0);
    const dailyRemaining = Math.max(0, dailyCap - dailyUsed);

    const monthlyCap = monthlyCapFor(plan);
    const monthMatch = rows[0]?.monthly_premium_month === monthKey();
    const monthlyUsed = monthMatch ? Number(rows[0]?.monthly_premium_used || 0) : 0;
    const monthlyRemaining = Math.max(0, monthlyCap - monthlyUsed);

    // Budget effectif = min(reste fenêtre 3h, ceiling 24h, garde-fou mensuel 15%).
    const windowRemaining = Math.max(0, quota - used);
    const remaining = Math.min(windowRemaining, dailyRemaining, monthlyRemaining);
    return {
      used, quota,
      remaining,
      resetAt: new Date(winStart + ms).toISOString(),
      windowHours: WINDOW_HOURS,
      windowRemaining,
      dailyUsed, dailyCap, dailyRemaining,
      dailyResetAt: new Date((dExpired ? now : dStart) + dayMs).toISOString(),
      monthlyUsed, monthlyCap, monthlyRemaining,
      monthlyResetAt: nextMonthStart(),
      capped: Math.min(dailyRemaining, monthlyRemaining) < windowRemaining
    };
  } catch {
    return { used: 0, quota, remaining: quota, windowRemaining: quota, resetAt: new Date(now + ms).toISOString(), windowHours: WINDOW_HOURS, dailyUsed: 0, dailyCap, dailyRemaining: dailyCap, dailyResetAt: new Date(now + dayMs).toISOString(), monthlyUsed: 0, monthlyCap: monthlyCapFor(plan), monthlyRemaining: monthlyCapFor(plan), monthlyResetAt: nextMonthStart(), capped: false };
  }
}

// Répartition de la conso de la fenêtre courante par marque (provider).
// Renvoie { total, quota, byBrand:[{brand,cr,pct}], allQuotas } pour le popover.
export async function getWindowBreakdown(userId, plan) {
  const quota = windowQuotaFor(plan);
  const ms = WINDOW_HOURS * 3600 * 1000;
  const now = Date.now();
  const base = { total: 0, quota, byBrand: [], allQuotas: WINDOW_QUOTA, windowHours: WINDOW_HOURS };
  try {
    const db = getDb();
    const { rows: u } = await db.query(`SELECT quota_window_start FROM users WHERE id=$1`, [userId]);
    const start = u[0]?.quota_window_start ? new Date(u[0].quota_window_start) : null;
    if (!start || now - start.getTime() >= ms) return base;
    const { rows } = await db.query(
      `SELECT model_id, SUM(cost_cr) AS cr FROM usage_log WHERE user_id=$1 AND created_at >= $2 GROUP BY model_id`,
      [userId, start.toISOString()]
    );
    const brandMap = new Map();
    let total = 0;
    for (const r of rows) {
      const cr = Number(r.cr) || 0;
      if (cr <= 0) continue;
      total += cr;
      const brand = findModelInCatalog(r.model_id)?.brand || "Autre";
      brandMap.set(brand, (brandMap.get(brand) || 0) + cr);
    }
    const byBrand = [...brandMap.entries()]
      .map(([brand, cr]) => ({ brand, cr: Math.round(cr * 10) / 10, pct: total > 0 ? Math.round((cr / total) * 100) : 0 }))
      .sort((a, b) => b.cr - a.cr);
    return { ...base, total: Math.round(total * 10) / 10, byBrand };
  } catch {
    return base;
  }
}

// Consomme `cost` Cr sur la fenêtre 3h ET le ceiling 24h (resets atomiques si expirés).
export async function consumeWindow(userId, cost) {
  if (!(cost > 0)) return;
  try {
    const db = getDb();
    const mk = monthKey();
    // Chaque CASE lit l'ANCIENNE valeur du champ correspondant (sémantique Postgres).
    await db.query(
      `UPDATE users SET
         quota_window_used  = CASE WHEN quota_window_start IS NULL OR now() - quota_window_start >= make_interval(hours => $3)
                                   THEN $2 ELSE quota_window_used + $2 END,
         quota_window_start = CASE WHEN quota_window_start IS NULL OR now() - quota_window_start >= make_interval(hours => $3)
                                   THEN now() ELSE quota_window_start END,
         daily_premium_used  = CASE WHEN daily_premium_start IS NULL OR now() - daily_premium_start >= make_interval(hours => 24)
                                    THEN $2 ELSE daily_premium_used + $2 END,
         daily_premium_start = CASE WHEN daily_premium_start IS NULL OR now() - daily_premium_start >= make_interval(hours => 24)
                                    THEN now() ELSE daily_premium_start END,
         monthly_premium_used  = CASE WHEN monthly_premium_month IS DISTINCT FROM $4 THEN $2 ELSE monthly_premium_used + $2 END,
         monthly_premium_month = $4
       WHERE id=$1`,
      [userId, cost, WINDOW_HOURS, mk]
    );
  } catch { /* best-effort */ }
}
