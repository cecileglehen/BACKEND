// PayPal Subscriptions API
import { getDb } from "./db.js";
import { grantPlanCredits, resetMonthlyCredits } from "./credits.js";

// PAYPAL_MODE=sandbox → utilise SAND_PAYPAL_* (cohabite avec la prod)
// Sinon → utilise PAYPAL_* (live)
const isSandbox = () => process.env.PAYPAL_MODE === "sandbox";
const envPrefix = () => (isSandbox() ? "SAND_PAYPAL_" : "PAYPAL_");

const baseUrl = () => isSandbox()
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

async function getAccessToken() {
  const prefix = envPrefix();
  const id  = process.env[`${prefix}CLIENT_ID`];
  const sec = process.env[`${prefix}CLIENT_SECRET`];
  if (!id || !sec) throw new Error(`${prefix}CLIENT_ID / ${prefix}CLIENT_SECRET manquants`);

  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${sec}`).toString("base64")
    },
    body: "grant_type=client_credentials"
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("PayPal auth failed: " + JSON.stringify(data));
  return data.access_token;
}

// ─── Commandes one-time (packs de crédits prépayés / PAYG) ──────────────────
import { getCreditPack } from "../config/plans.js";
import { addCredits, addApiCredits } from "./credits.js";

// ─── PAYG API : top-up à montant LIBRE du pool api_credits ───────────────────
// PayPal ne fait pas d'auto-recharge off-session simplement (Reference
// Transactions = approbation spéciale), donc PAYG API = recharges prépayées.
// 1€ = 100 crédits API. Bornes anti-erreur : 5€ min, 500€ max.
const API_TOPUP_MIN_EUR = Number(process.env.API_TOPUP_MIN_EUR || 5);
const API_TOPUP_MAX_EUR = Number(process.env.API_TOPUP_MAX_EUR || 500);
const API_CR_PER_EUR = 100;

function sanitizeTopupEur(amountEur) {
  const v = Math.round(Number(amountEur) * 100) / 100;
  if (!Number.isFinite(v) || v < API_TOPUP_MIN_EUR || v > API_TOPUP_MAX_EUR) {
    throw new Error(`Montant invalide (entre ${API_TOPUP_MIN_EUR}€ et ${API_TOPUP_MAX_EUR}€)`);
  }
  return v;
}

export async function createApiTopupOrder(userId, amountEur, returnUrl, cancelUrl) {
  const eur = sanitizeTopupEur(amountEur);
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        custom_id: `${userId}:apitopup:${eur.toFixed(2)}`,
        description: `DELT AI — crédits API (${eur.toFixed(2)}€)`,
        amount: { currency_code: "EUR", value: eur.toFixed(2) }
      }],
      application_context: {
        brand_name: "DELT AI",
        locale: "fr-FR",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    })
  });
  const data = await res.json();
  if (!data.id) throw new Error("PayPal order error: " + JSON.stringify(data));
  const approveUrl = data.links?.find((l) => l.rel === "approve")?.href;
  return { orderId: data.id, approveUrl, amountEur: eur };
}

export async function captureApiTopupOrder(userId, orderId) {
  const db = getDb();

  // Idempotence : déjà traité ?
  const existing = await db.query(`SELECT status, credits FROM credit_orders WHERE id=$1`, [orderId]);
  if (existing.rows[0]?.status === "completed") {
    return { ok: true, alreadyProcessed: true, apiCredits: Number(existing.rows[0].credits) };
  }

  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.status !== "COMPLETED") {
    throw new Error("Paiement non complété: " + (data.message || data.status || "inconnu"));
  }

  // Vérifie l'appartenance + le montant via custom_id (userId:apitopup:eur)
  const pu = data.purchase_units?.[0];
  const customId = pu?.payments?.captures?.[0]?.custom_id || pu?.custom_id || "";
  const [ownerId, kind, eurStr] = customId.split(":");
  if (ownerId !== userId || kind !== "apitopup") throw new Error("Commande API non liée à cet utilisateur");
  const eur = sanitizeTopupEur(eurStr);

  const paidValue = Number(pu?.payments?.captures?.[0]?.amount?.value || pu?.amount?.value || 0);
  if (paidValue + 0.001 < eur) throw new Error("Montant payé insuffisant");

  const apiCr = Math.round(eur * API_CR_PER_EUR * 100) / 100;

  // Enregistre la commande (idempotence) PUIS crédite le pool API
  const ins = await db.query(
    `INSERT INTO credit_orders (id, user_id, pack_id, credits, amount_eur, status)
     VALUES ($1,$2,'api_topup',$3,$4,'completed')
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [orderId, userId, apiCr, eur]
  );
  if (ins.rowCount === 0) {
    return { ok: true, alreadyProcessed: true, apiCredits: apiCr };
  }
  const balance = await addApiCredits(userId, apiCr);
  return { ok: true, apiCreditsAdded: apiCr, apiCredits: balance, amountEur: eur };
}

// Crée une commande PayPal (Orders API v2) pour un pack de crédits.
export async function createCreditOrder(userId, packId, returnUrl, cancelUrl) {
  const pack = getCreditPack(packId);
  if (!pack) throw new Error("Pack de crédits inconnu");
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        custom_id: `${userId}:${pack.id}`,
        description: `DELT AI — ${pack.credits} crédits`,
        amount: { currency_code: "EUR", value: pack.priceEur.toFixed(2) }
      }],
      application_context: {
        brand_name: "DELT AI",
        locale: "fr-FR",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    })
  });
  const data = await res.json();
  if (!data.id) throw new Error("PayPal order error: " + JSON.stringify(data));
  const approveUrl = data.links?.find((l) => l.rel === "approve")?.href;
  return { orderId: data.id, approveUrl };
}

// Capture une commande approuvée, vérifie le montant, crédite l'utilisateur (idempotent).
export async function captureCreditOrder(userId, orderId) {
  const db = getDb();

  // Idempotence : déjà traité ?
  const existing = await db.query(`SELECT status, credits FROM credit_orders WHERE id=$1`, [orderId]);
  if (existing.rows[0]?.status === "completed") {
    return { ok: true, alreadyProcessed: true, credits: Number(existing.rows[0].credits) };
  }

  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.status !== "COMPLETED") {
    throw new Error("Paiement non complété: " + (data.message || data.status || "inconnu"));
  }

  // Vérifie l'appartenance + le montant via custom_id (userId:packId)
  const pu = data.purchase_units?.[0];
  const customId = pu?.payments?.captures?.[0]?.custom_id || pu?.custom_id || "";
  const [ownerId, packId] = customId.split(":");
  if (ownerId !== userId) throw new Error("Commande non liée à cet utilisateur");
  const pack = getCreditPack(packId);
  if (!pack) throw new Error("Pack inconnu sur la commande");

  const paidValue = Number(pu?.payments?.captures?.[0]?.amount?.value || pu?.amount?.value || 0);
  if (paidValue + 0.001 < pack.priceEur) throw new Error("Montant payé insuffisant");

  // Enregistre la commande (idempotence) PUIS crédite
  const ins = await db.query(
    `INSERT INTO credit_orders (id, user_id, pack_id, credits, amount_eur, status)
     VALUES ($1,$2,$3,$4,$5,'completed')
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [orderId, userId, pack.id, pack.credits, pack.priceEur]
  );
  if (ins.rowCount === 0) {
    // Course : un autre process a déjà inséré → ne pas double-créditer
    return { ok: true, alreadyProcessed: true, credits: pack.credits };
  }
  await addCredits(userId, pack.credits);
  return { ok: true, credits: pack.credits, packId: pack.id };
}

// Crée un lien d'abonnement PayPal pour un plan
// planId = ID du PayPal Billing Plan (créé manuellement dans le dashboard PayPal)
export async function createSubscriptionLink(paypalPlanId, returnUrl, cancelUrl) {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      plan_id: paypalPlanId,
      application_context: {
        brand_name: "DELT AI",
        locale: "fr-FR",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    })
  });
  const data = await res.json();
  if (!data.id) throw new Error("PayPal subscription error: " + JSON.stringify(data));
  const approveLink = data.links?.find((l) => l.rel === "approve")?.href;
  return { subscriptionId: data.id, approveUrl: approveLink };
}

// Appelé quand PayPal redirige l'utilisateur après paiement (return_url)
export async function activateSubscription(userId, subscriptionId, plan) {
  const db = getDb();
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);
  await db.query(
    `UPDATE users SET plan=$1, sub_id=$2, sub_start=$3, sub_end=$4 WHERE id=$5`,
    [plan, subscriptionId, now, end, userId]
  );
}

// Webhook PayPal → vérifie et traite les événements
export async function handleWebhook(body, headers) {
  const db = getDb();
  const eventId   = body.id;
  const eventType = body.event_type;

  // Déduplique
  const { rowCount } = await db.query(
    `INSERT INTO paypal_events (id, event_type, data) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO NOTHING`,
    [eventId, eventType, JSON.stringify(body)]
  );
  if (rowCount === 0) return { ok: true, skipped: true };

  const subId = body.resource?.id ?? body.resource?.billing_agreement_id;

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.RENEWED": {
      if (subId) {
        const end = new Date();
        end.setMonth(end.getMonth() + 1);
        const { rows } = await db.query(
          `UPDATE users SET status='active', sub_end=$1 WHERE sub_id=$2 RETURNING id, plan`,
          [end, subId]
        );
        if (rows[0]) {
          if (eventType === "BILLING.SUBSCRIPTION.RENEWED") {
            await resetMonthlyCredits(rows[0].id, rows[0].plan);
          } else {
            await grantPlanCredits(rows[0].id, rows[0].plan);
          }
        }
      }
      break;
    }
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      if (subId) {
        await db.query(
          `UPDATE users SET plan='BASIC', status='active', sub_id=NULL WHERE sub_id=$1`,
          [subId]
        );
      }
      break;
    }
    case "PAYMENT.SALE.DENIED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      if (subId) {
        await db.query(
          `UPDATE users SET status='payment_failed' WHERE sub_id=$1`,
          [subId]
        );
      }
      break;
    }
  }

  return { ok: true, handled: eventType };
}

// IDs des Billing Plans PayPal — lit SAND_PAYPAL_PLAN_* si PAYPAL_MODE=sandbox
// Proxy → lecture lazy de process.env (sinon undefined au moment de l'import ES module)
export const PAYPAL_PLAN_IDS = new Proxy({}, {
  get(_t, key) {
    // LITE est un alias de BASIC pour rétrocompatibilité
    const k = key === "LITE" ? "BASIC" : key;
    return process.env[`${envPrefix()}PLAN_${k}`];
  }
});
