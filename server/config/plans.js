// Crédits inclus par plan mensuel
export const PLANS = {
  FREE:  { price: 0,   credits: 0,     label: "FREE",  color: "#94a3b8", freeTierOnly: true },
  BASIC: { price: 10,  credits: 1000,  label: "BASIC", color: "#10b981" },
  PLUS:  { price: 23,  credits: 2500,  label: "PLUS",  color: "#6366f1" },
  PRO:   { price: 75,  credits: 8500,  label: "PRO",   color: "#0891b2" },
  ULTRA: { price: 200, credits: 25000, label: "ULTRA", color: "#f59e0b" }
};

// Plans limités aux modèles gratuits uniquement
export const FREE_TIER_ONLY_PLANS = new Set(["FREE"]);

// Coût en crédits par 1 000 tokens (in + out combinés)
export const CREDITS_PER_1K = {
  FREE:       0,
  NANO:       0.10,
  MINI:       0.30,
  NORMAL:     1.20,
  PRICE:      0.60,
  EXPERT:     6.00,
  UNCENSORED: 0.50,
  VENICE:     0.50
};

export function computeCreditCost(tier, tokensIn, tokensOut) {
  const rate = CREDITS_PER_1K[tier] ?? 0.10;
  return Math.ceil(((tokensIn + tokensOut) / 1000) * rate * 100) / 100;
}

// Modèles principaux par tier (importé depuis models.js)
export { TIER_PRIMARY_MODELS as TIER_MODELS } from "./models.js";

// Conservés pour windows.js (système de quotas legacy — plus utilisé pour le throttle)
export const QUOTAS_5H = {};
export const WEEKLY_EXPERT_CAP = {};
export const FALLBACK_CHAIN = {
  EXPERT: "NORMAL", NORMAL: "MINI", MINI: "NANO", NANO: "FREE", FREE: null
};

export function estimateCostEur(tier, tokensIn, tokensOut) {
  const API_COST_EUR_PER_1K = {
    FREE: 0, NANO: 0.0004, MINI: 0.0012, NORMAL: 0.005,
    PRICE: 0.003, EXPERT: 0.025, UNCENSORED: 0.0003, VENICE: 0.0003
  };
  const rate = API_COST_EUR_PER_1K[tier] ?? 0;
  return ((tokensIn + tokensOut) / 1000) * rate;
}
