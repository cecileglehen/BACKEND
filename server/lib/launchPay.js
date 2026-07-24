// Paiements managés pour les apps Launch via Stripe Connect (modèle platform).
// Le créateur connecte son compte Express ; les paiements vont sur SON compte
// (destination charge) avec une commission plateforme (application_fee).
import Stripe from "stripe";
import { getDb } from "./db.js";

const FEE_PCT = Number(process.env.LAUNCH_PLATFORM_FEE_PCT || 7);
const UUID_RE = /^[0-9a-f-]{36}$/i;

let _stripe = null;
function stripe() {
  if (!_stripe) {
    const key = (process.env.STRIPE_SECRET_KEY || "").trim();
    if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// Récupère (ou crée) le compte Stripe DU CRÉATEUR (1 par user, tous projets confondus).
async function getUserAccount(userId) {
  const { rows } = await getDb().query(`SELECT launch_stripe_account_id FROM users WHERE id=$1`, [userId]);
  return rows[0]?.launch_stripe_account_id || null;
}

// ─── Onboarding du créateur (Express) — 1 seule fois par utilisateur ──────────
export async function createConnectLink(userId, { returnUrl, refreshUrl } = {}) {
  const s = stripe();
  let acct = await getUserAccount(userId);
  if (!acct) {
    const account = await s.accounts.create({ type: "express", metadata: { userId: String(userId) } });
    acct = account.id;
    await getDb().query(`UPDATE users SET launch_stripe_account_id=$2 WHERE id=$1`, [userId, acct]);
  }
  const link = await s.accountLinks.create({
    account: acct,
    refresh_url: refreshUrl || returnUrl || "https://deltai.fr",
    return_url: returnUrl || "https://deltai.fr",
    type: "account_onboarding"
  });
  return { url: link.url };
}

export async function getConnectStatus(userId) {
  const acct = await getUserAccount(userId);
  if (!acct) return { connected: false, chargesEnabled: false, payoutsEnabled: false };
  const account = await stripe().accounts.retrieve(acct);
  return {
    connected: true,
    chargesEnabled: !!account.charges_enabled,
    payoutsEnabled: !!account.payouts_enabled,
    detailsSubmitted: !!account.details_submitted
  };
}

// ─── Paiement client (Checkout, destination charge + commission) ──────────────
export async function createCheckout(projectId, { amount, label, currency, quantity, successUrl, cancelUrl, shipping }, appUserId) {
  if (!UUID_RE.test(String(projectId))) throw new Error("Projet introuvable");
  // Le compte qui encaisse = celui du PROPRIÉTAIRE du projet (1 par user).
  const { rows } = await getDb().query(
    `SELECT u.launch_stripe_account_id AS acct
     FROM launch_projects p JOIN users u ON u.id = p.user_id WHERE p.id=$1`,
    [projectId]
  );
  const p = rows[0];
  if (!p) throw new Error("Projet introuvable");
  if (!p.acct) throw new Error("Paiements non configurés pour cette app.");

  const cents = Math.round(Number(amount));
  if (!Number.isFinite(cents) || cents < 50) throw new Error("Montant invalide (min 50).");
  const cur = String(currency || "eur").toLowerCase();
  const qty = Math.max(1, Math.min(100, Number(quantity) || 1));
  const fee = Math.floor((cents * qty * FEE_PCT) / 100);

  const s = stripe();
  const acct = await s.accounts.retrieve(p.acct);
  if (!acct.charges_enabled) throw new Error("Le compte Stripe du créateur n'est pas encore actif.");

  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: { currency: cur, unit_amount: cents, product_data: { name: String(label || "Paiement").slice(0, 120) } },
      quantity: qty
    }],
    payment_intent_data: {
      application_fee_amount: fee,
      transfer_data: { destination: p.acct }
    },
    // Infos client complètes (nom, email, téléphone, adresse) : Stripe les
    // collecte, on les stocke, et elles partent dans la base Notion du créateur.
    billing_address_collection: "required",
    phone_number_collection: { enabled: true },
    ...(shipping ? { shipping_address_collection: { allowed_countries: ["FR", "BE", "CH", "LU", "MC", "DE", "ES", "IT", "PT", "NL", "GB", "US", "CA"] } } : {}),
    success_url: successUrl || "https://deltai.fr",
    cancel_url: cancelUrl || successUrl || "https://deltai.fr"
  });

  await getDb().query(
    `INSERT INTO launch_payments (project_id, app_user_id, session_id, amount, currency, fee, label, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') ON CONFLICT (session_id) DO NOTHING`,
    [projectId, appUserId || null, session.id, cents * qty, cur, fee, String(label || "").slice(0, 120)]
  );
  return { url: session.url, id: session.id };
}

// ─── Webhook (confirme les paiements) ─────────────────────────────────────────
export async function handleWebhook(rawBody, sig) {
  const whsec = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const s = stripe();
  let event;
  if (whsec) {
    event = s.webhooks.constructEvent(rawBody, sig, whsec);
  } else {
    event = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString("utf8"));
  }
  if (event.type === "checkout.session.completed") {
    await markPaid(event.data.object);
  }
  return { received: true };
}

// Extrait les infos client d'une session Checkout (webhook OU réconciliation).
function customerFromSession(sess) {
  const cd = sess?.customer_details || {};
  return {
    name: cd.name || null,
    email: cd.email || null,
    phone: cd.phone || null,
    address: cd.address || null,                       // facturation
    shipping: sess?.shipping_details?.address || null  // livraison si collectée
  };
}

async function markPaid(sess) {
  const { rowCount } = await getDb().query(
    `UPDATE launch_payments SET status='paid', customer=$2 WHERE session_id=$1 AND status <> 'paid'`,
    [sess.id, JSON.stringify(customerFromSession(sess))]
  );
  if (!rowCount) return; // déjà traité (webhook + sweep ne doublonnent pas)
  // Intégrations créateur (Notion…) : best-effort, ne bloque jamais le flux.
  try {
    const { onLaunchPaymentPaid } = await import("./launchIntegrations.js");
    await onLaunchPaymentPaid(sess.id);
  } catch (e) { console.warn("[launchPay] integrations:", e.message); }
}

// ─── Réconciliation : rattrape les paiements dont le webhook s'est perdu ──────
// (webhook non configuré, down, ou dev local injoignable par Stripe). Interroge
// Stripe pour chaque paiement pending < 24 h ; s'il est payé → markPaid → la
// ligne Notion part quand même. Appelée toutes les 60 s depuis server.js.
export async function sweepPendingPayments() {
  if (!(process.env.STRIPE_SECRET_KEY || "").trim()) return;
  try {
    const { rows } = await getDb().query(
      `SELECT session_id FROM launch_payments
        WHERE status='pending' AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC LIMIT 20`
    );
    if (!rows.length) return;
    const s = stripe();
    for (const r of rows) {
      try {
        const sess = await s.checkout.sessions.retrieve(r.session_id);
        if (sess?.payment_status === "paid") await markPaid(sess);
      } catch { /* session expirée/introuvable — ignorée */ }
    }
  } catch (e) { console.warn("[launchPay] sweep:", e.message); }
}
