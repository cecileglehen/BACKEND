import { TIER_PRIMARY_MODELS } from "./models.js";

// Quotas par fenêtre 5h (messages) par plan × tier
export const PLANS = {
  LITE:  { price: 10, label: "LITE",  color: "#10b981" },
  PLUS:  { price: 23, label: "PLUS",  color: "#6366f1" },
  PRO:   { price: 50, label: "PRO",   color: "#0891b2" },
  ULTRA: { price: 200, label: "ULTRA", color: "#f59e0b" }
};

export const QUOTAS_5H = {
  //       EXPERT  PRICE  NORMAL  MINI   NANO   FREE (illimité = 99999)
  LITE:  { EXPERT: 5,   PRICE: 10,  NORMAL: 20,  MINI: 60,   NANO: 200,  FREE: 99999 },
  PLUS:  { EXPERT: 15,  PRICE: 30,  NORMAL: 50,  MINI: 150,  NANO: 500,  FREE: 99999 },
  PRO:   { EXPERT: 40,  PRICE: 80,  NORMAL: 120, MINI: 400,  NANO: 1500, FREE: 99999 },
  ULTRA: { EXPERT: 200, PRICE: 400, NORMAL: 600, MINI: 2000, NANO: 5000, FREE: 99999 }
};

export const WEEKLY_EXPERT_CAP = {
  LITE:  20,
  PLUS:  60,
  PRO:   200,
  ULTRA: 1000
};

// Cascade EXPERT → PRICE → NORMAL → MINI → NANO → FREE
export const FALLBACK_CHAIN = {
  EXPERT: "PRICE",
  PRICE:  "NORMAL",
  NORMAL: "MINI",
  MINI:   "NANO",
  NANO:   "FREE",
  FREE:   null   // toujours disponible, jamais bloqué
};

// Modèles principaux par tier. La liste complète et les fallbacks sont dans models.js.
export const TIER_MODELS = TIER_PRIMARY_MODELS;

// Coûts approximatifs USD/M tokens → pour loguer les dépenses
export const COST_PER_M = {
  FREE:       { in: 0,     out: 0      },
  UNCENSORED: { in: 0,     out: 0      },
  VENICE:     { in: 0,     out: 0      },
  NANO:       { in: 0.20,  out: 1.25   },
  MINI:       { in: 0.75,  out: 4.50   },
  NORMAL:     { in: 2.50,  out: 15.00  },
  PRICE:      { in: 1.50,  out: 7.50   },
  EXPERT:     { in: 30.00, out: 180.00 }
};

export function estimateCostEur(tier, tokensIn, tokensOut) {
  const c = COST_PER_M[tier] ?? COST_PER_M.NANO;
  const usd = (tokensIn / 1e6) * c.in + (tokensOut / 1e6) * c.out;
  return usd * 0.926;
}
