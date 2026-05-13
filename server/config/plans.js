import { findModelInCatalog, normalizeTier } from "./models.js";

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

// Limites des pièces jointes par plan
//  - attachmentsPerConv  : nombre max de fichiers par conversation
//  - pdfMaxPages         : nombre max de pages PDF lues (le reste est ignoré)
//  - maxFileSizeMB       : taille max d'un fichier en MB
export const PLAN_LIMITS = {
  FREE:  { attachmentsPerConv: 2,   pdfMaxPages: 1,   maxFileSizeMB: 5  },
  BASIC: { attachmentsPerConv: 10,  pdfMaxPages: 3,   maxFileSizeMB: 10 },
  PLUS:  { attachmentsPerConv: 25,  pdfMaxPages: 10,  maxFileSizeMB: 20 },
  PRO:   { attachmentsPerConv: 60,  pdfMaxPages: 30,  maxFileSizeMB: 40 },
  ULTRA: { attachmentsPerConv: 200, pdfMaxPages: 100, maxFileSizeMB: 80 }
};

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
}

// Fallback tier-based si modelId inconnu (Cr / 1k tokens, in+out combinés)
export const CREDITS_PER_1K = {
  FREE:       0,
  UNCENSORED: 0.10,
  NANO:       0.20,
  MINI:       0.80,
  NORMAL:     4.00,
  EXPERT:     17.00,
  PRO:        50.00,
  VENICE:     0.10,
  PRICE:      17.00
};

// Calcule le coût en crédits selon le tier DELT. La facturation ne dépend pas
// du prix fournisseur : elle suit strictement CREDITS_PER_1K.
export function computeCreditCost(tierOrModelId, tokensIn, tokensOut) {
  const found = findModelInCatalog(tierOrModelId);
  const tier = normalizeTier(found?.tier || tierOrModelId);
  const rate = CREDITS_PER_1K[tier] ?? CREDITS_PER_1K.NANO;
  return Math.ceil(((tokensIn + tokensOut) / 1000) * rate * 100) / 100;
}

// Modèles principaux par tier (importé depuis models.js)
export { TIER_PRIMARY_MODELS as TIER_MODELS } from "./models.js";

// Conservés pour windows.js (système de quotas legacy — plus utilisé pour le throttle)
export const QUOTAS_5H = {};
export const WEEKLY_EXPERT_CAP = {};
export const FALLBACK_CHAIN = {
  PRO: "EXPERT", EXPERT: "NORMAL", NORMAL: "MINI", MINI: "NANO", NANO: "FREE", FREE: null
};

export function estimateCostEur(tier, tokensIn, tokensOut) {
  const cr = computeCreditCost(tier, tokensIn, tokensOut);
  return cr / 100;
}
