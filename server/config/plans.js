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

// ─── Packs de crédits prépayés (PAYG / top-up ponctuel) ──────────────────────
// Achat one-time via PayPal. 1€ = 100 Cr, avec bonus croissant sur les gros packs.
export const CREDIT_PACKS = {
  pack_5:  { id: "pack_5",  priceEur: 5,   credits: 500,    bonus: 0,    label: "Recharge 5€" },
  pack_10: { id: "pack_10", priceEur: 10,  credits: 1050,   bonus: 50,   label: "Recharge 10€" },
  pack_25: { id: "pack_25", priceEur: 25,  credits: 2750,   bonus: 250,  label: "Recharge 25€" },
  pack_50: { id: "pack_50", priceEur: 50,  credits: 5750,   bonus: 750,  label: "Recharge 50€" },
  pack_100:{ id: "pack_100",priceEur: 100, credits: 12000,  bonus: 2000, label: "Recharge 100€" }
};

export function getCreditPack(packId) {
  return CREDIT_PACKS[packId] || null;
}

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

// Nombre d'agents IA personnalisés créables par plan
//  FREE 0 · BASIC (10€) 1 · PLUS (23€) 2 · PRO (75€) 6 · ULTRA (200€) 20
export const AGENT_LIMITS = {
  FREE:  0,
  BASIC: 1,
  PLUS:  2,
  PRO:   6,
  ULTRA: 20
};

export function getAgentLimit(plan) {
  return AGENT_LIMITS[plan] ?? 0;
}

// Stockage total de fichiers de connaissances (RAG) par utilisateur, en Mo
//  BASIC (10€) 20 Mo · PLUS (23€) 75 Mo · PRO (75€) 200 Mo · ULTRA (200€) 1 Go
export const AGENT_KNOWLEDGE_MB = {
  FREE:  0,
  BASIC: 20,
  PLUS:  75,
  PRO:   200,
  ULTRA: 1024
};

export function getKnowledgeQuotaBytes(plan) {
  return (AGENT_KNOWLEDGE_MB[plan] ?? 0) * 1024 * 1024;
}

// Fallback tier-based si modelId inconnu (Cr / 1k tokens, in+out combinés)
export const CREDITS_PER_1K = {
  FREE:       0,
  UNCENSORED: 0.10,
  PICO:       0.10,
  NANO:       0.20,
  MINI:       0.40,
  NORMAL:     4.00,
  EXPERT:     8.00,
  PRO:        50.00,
  VENICE:     0.10,
  PRICE:      8.00
};

// Calcule le coût en crédits selon le tier DELT. La facturation ne dépend pas
// du prix fournisseur : elle suit strictement CREDITS_PER_1K.
export function computeCreditCost(tierOrModelId, tokensIn, tokensOut) {
  const found = findModelInCatalog(tierOrModelId);
  const tier = normalizeTier(found?.tier || tierOrModelId);
  const rate = CREDITS_PER_1K[tier] ?? CREDITS_PER_1K.NANO;
  return Math.ceil(((tokensIn + tokensOut) / 1000) * rate * 100) / 100;
}

// ─── Facturation par coût réel (OpenRouter usage.cost) ──────────────────────
// 1 USD = COST_BASED_CR_PER_USD crédits côté DELT (≈ marge 80-100%).
// Le coût réel facturé par OpenRouter est dans data.usage.cost (en $).
// Conversion : 1€ = 100 Cr et $1 ≈ €0.92, donc CR_PER_USD = 100 / 1.10 ≈ 91 → on prend 200 pour la marge.
const COST_BASED_CR_PER_USD = 200;
// Plancher minimum (1 Cr ≈ 0.01€) : on facture au moins 0.1 Cr même pour requêtes minuscules
const MIN_CREDIT_COST = 0.1;

/**
 * Calcule le coût en crédits à partir du coût réel fournisseur (USD).
 * Fallback vers la grille tier si le coût n'est pas disponible.
 */
export function computeCreditFromCost({ costUsd, modelId, tokensIn = 0, tokensOut = 0 }) {
  if (Number.isFinite(costUsd) && costUsd > 0) {
    const cr = costUsd * COST_BASED_CR_PER_USD;
    return Math.max(MIN_CREDIT_COST, Math.ceil(cr * 100) / 100);
  }
  // Fallback : grille tier
  return computeCreditCost(modelId, tokensIn, tokensOut);
}

// ─── Tarif API publique /v1 : PAYG quasi au coût (marge fine) ───────────────
// L'API n'est PAS facturée comme le chat. Modèle : 1€ = 100 Cr ; $1 de coût réel
// ≈ EUR_PER_USD € → ×100 Cr ; on ajoute API_MARGIN_PCT % de marge. Les deux sont
// configurables en env car une marge de 3% ne tolère pas une dérive du change
// EUR/USD : mieux vaut un EUR_PER_USD légèrement conservateur (buffer FX).
const EUR_PER_USD    = Number(process.env.EUR_PER_USD || 0.95);   // 1 USD ≈ 0.95€ (prudent)
const API_MARGIN_PCT = Number(process.env.API_MARGIN_PCT || 3);   // marge cible sur l'API
const API_CR_PER_USD = EUR_PER_USD * 100 * (1 + API_MARGIN_PCT / 100);

/**
 * Coût en crédits API (pool api_credits) — marge fine ~3% au lieu de ~117% du chat.
 */
export function computeApiCreditFromCost({ costUsd, modelId, tokensIn = 0, tokensOut = 0 }) {
  if (Number.isFinite(costUsd) && costUsd > 0) {
    const cr = costUsd * API_CR_PER_USD;
    return Math.max(MIN_CREDIT_COST, Math.ceil(cr * 100) / 100);
  }
  // Fallback : grille tier (rare — uniquement si le fournisseur ne renvoie pas de coût)
  return computeCreditCost(modelId, tokensIn, tokensOut);
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
