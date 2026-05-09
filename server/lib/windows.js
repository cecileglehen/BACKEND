// Fenêtre 5h glissante + cap hebdo EXPERT
import { getDb } from "./db.js";
import { QUOTAS_5H, WEEKLY_EXPERT_CAP, FALLBACK_CHAIN } from "../config/plans.js";

const WINDOW_MS = 5 * 60 * 60 * 1000; // 5h

// Quota en mémoire si DB indisponible
const memUsage = new Map();
function memKey(userId, tier) { return `${userId}:${tier}`; }
function memGet(userId, tier) { return memUsage.get(memKey(userId, tier)) ?? 0; }
function memInc(userId, tier) { memUsage.set(memKey(userId, tier), memGet(userId, tier) + 1); }

async function getOrCreateWindow(userId, tier) {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - WINDOW_MS);
    const { rows } = await db.query(
      `SELECT * FROM usage_windows
       WHERE user_id=$1 AND tier=$2 AND window_start > $3
       ORDER BY window_start DESC LIMIT 1`,
      [userId, tier, cutoff]
    );
    if (rows.length > 0) return rows[0];
    const { rows: [row] } = await db.query(
      `INSERT INTO usage_windows (user_id, tier, window_start)
       VALUES ($1, $2, NOW()) RETURNING *`,
      [userId, tier]
    );
    return row;
  } catch {
    // Fallback mémoire
    return { messages_count: memGet(userId, tier), window_start: new Date() };
  }
}

export async function recordUsage(userId, tier, tokensIn, tokensOut) {
  memInc(userId, tier); // toujours en mémoire (backup)
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - WINDOW_MS);
    await db.query(
      `UPDATE usage_windows
       SET messages_count = messages_count + 1,
           tokens_in      = tokens_in + $3,
           tokens_out     = tokens_out + $4
       WHERE user_id=$1 AND tier=$2 AND window_start > $5`,
      [userId, tier, tokensIn, tokensOut, cutoff]
    );
    const monday = getMonday();
    await db.query(
      `INSERT INTO weekly_usage (user_id, tier, week_start, messages_count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (user_id, tier, week_start)
       DO UPDATE SET messages_count = weekly_usage.messages_count + 1`,
      [userId, tier, monday]
    );
  } catch { /* DB non dispo, usage tracé en mémoire */ }
}

export async function resolveTier(userId, plan, requestedTier) {
  let tier = requestedTier;
  const tried = new Set();

  while (tier) {
    if (tried.has(tier)) break;
    tried.add(tier);

    const quota = QUOTAS_5H[plan]?.[tier] ?? 9999;
    const window = await getOrCreateWindow(userId, tier);

    if (window.messages_count >= quota) {
      const next = FALLBACK_CHAIN[tier];
      return { tier: next ?? "NANO", fellBack: true, from: tier };
    }

    if (tier === "EXPERT") {
      const cap = WEEKLY_EXPERT_CAP[plan] ?? 0;
      try {
        const db = getDb();
        const monday = getMonday();
        const { rows } = await db.query(
          `SELECT messages_count FROM weekly_usage
           WHERE user_id=$1 AND tier='EXPERT' AND week_start=$2`,
          [userId, monday]
        );
        const weeklyCount = rows[0]?.messages_count ?? 0;
        if (weeklyCount >= cap) { tier = FALLBACK_CHAIN.EXPERT; continue; }
      } catch { /* ignore, pas de cap si DB indispo */ }
    }

    return { tier, fellBack: false, from: null };
  }

  return { tier: "NANO", fellBack: true, from: requestedTier };
}

export async function quotaSnapshot(userId, plan) {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - WINDOW_MS);
    const monday = getMonday();
    const { rows: windows } = await db.query(
      `SELECT tier, messages_count, window_start FROM usage_windows
       WHERE user_id=$1 AND window_start > $2`,
      [userId, cutoff]
    );
    const { rows: weekly } = await db.query(
      `SELECT tier, messages_count FROM weekly_usage
       WHERE user_id=$1 AND week_start=$2`,
      [userId, monday]
    );
    const result = {};
    for (const tier of ["EXPERT", "PRICE", "NORMAL", "MINI", "NANO"]) {
      const win  = windows.find((w) => w.tier === tier);
      const wk   = weekly.find((w) => w.tier === tier);
      const quota = QUOTAS_5H[plan]?.[tier] ?? 0;
      result[tier] = {
        used5h:       win?.messages_count ?? 0,
        quota5h:      quota,
        usedWeek:     wk?.messages_count ?? 0,
        weekCap:      tier === "EXPERT" ? (WEEKLY_EXPERT_CAP[plan] ?? 0) : null,
        windowResetAt: win ? new Date(new Date(win.window_start).getTime() + WINDOW_MS) : null
      };
    }
    return result;
  } catch {
    // Fallback : quotas mémoire
    const result = {};
    for (const tier of ["EXPERT", "PRICE", "NORMAL", "MINI", "NANO"]) {
      result[tier] = {
        used5h:   memGet(userId, tier),
        quota5h:  QUOTAS_5H[plan]?.[tier] ?? 0,
        weekCap:  tier === "EXPERT" ? (WEEKLY_EXPERT_CAP[plan] ?? 0) : null,
        windowResetAt: null
      };
    }
    return result;
  }
}

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split("T")[0];
}
