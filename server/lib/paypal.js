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
