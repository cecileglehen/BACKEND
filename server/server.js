process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { initSchema } from "./lib/db.js";
import { register, login, signToken, requireAuth, refreshUser, verifyToken } from "./lib/auth.js";
import { routeMessage } from "./lib/router.js";
import { chatWithFallback } from "./lib/openrouter.js";
import { recordUsage, quotaSnapshot, resolveTier } from "./lib/windows.js";
import { getCredits, deductCredits, hasEnoughCredits, grantPlanCredits, resetMonthlyCredits } from "./lib/credits.js";
import { computeCreditCost, FREE_TIER_ONLY_PLANS } from "./config/plans.js";
import { checkThrottle } from "./lib/throttle.js";
import { compressIfNeeded } from "./lib/context.js";
import { createCodeSession, editCodeSession, getCodePreviewFile, getCodeZip } from "./lib/codegen.js";
import { TIER_MODELS, estimateCostEur } from "./config/plans.js";
import { CREATIVE, findModelInCatalog, normalizeTier, publicCatalog } from "./config/models.js";
import { createSubscriptionLink, activateSubscription, handleWebhook, PAYPAL_PLAN_IDS } from "./lib/paypal.js";
import { createClient } from "@supabase/supabase-js";
import { routeMessage as groqRoute } from "./lib/router.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const found = cookies.find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
}

function requirePreviewAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : req.query.token || cookieValue(req, "delt_preview_token");

  if (!token) return res.status(401).send("Non authentifié");
  try {
    req.user = verifyToken(String(token));
    if (req.query.token) {
      res.cookie("delt_preview_token", String(token), {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 60 * 1000,
        path: `/api/code/session/${req.params.id}/preview`
      });
    }
    next();
  } catch {
    res.status(401).send("Token invalide ou expiré");
  }
}

const PREVIEW_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const supabase = createClient(
  "https://ogtbgcawznbuqejloubr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndGJnY2F3em5idXFlamxvdWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyOTc3ODAsImV4cCI6MjA5Mzg3Mzc4MH0.ULUYhGHP1-IY5i7Yub_pXP5BJsW_WFp4E_4D2zS0Rjk"
);

// ─── Auth ────────────────────────────────────────────────────────────────────

// Google OAuth — échange le token Supabase contre un JWT DELT
app.post("/api/auth/google", async (req, res) => {
  try {
    const { accessToken } = req.body ?? {};
    if (!accessToken) return res.status(400).json({ error: "accessToken requis" });

    // Vérifie le token via Supabase Auth (appel HTTP, pas pg)
    const { data: { user: sbUser }, error: sbErr } = await supabase.auth.getUser(accessToken);
    if (sbErr || !sbUser?.email) return res.status(401).json({ error: "Token invalide" });

    // Crée un user DELT minimal en mémoire (DB optionnelle)
    const user = {
      id:    sbUser.id,
      email: sbUser.email,
      plan:  "LITE"
    };

    // Si DB disponible, upsert pour persister le plan/quota
    if (process.env.DATABASE_URL) {
      try {
        const db = (await import("./lib/db.js")).getDb();
        const r = await db.query(
          `INSERT INTO users (id, email, password, plan, status, auth_provider)
           VALUES ($1, $2, '', 'LITE', 'active', 'google')
           ON CONFLICT (email) DO UPDATE SET auth_provider = 'google'
           RETURNING *`,
          [sbUser.id, sbUser.email]
        );
        Object.assign(user, { plan: r.rows[0].plan });
      } catch { /* DB non dispo, continue sans */ }
    }

    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    console.error("[google auth]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "email + password requis" });
    if (password.length < 8) return res.status(400).json({ error: "Mot de passe trop court (8 car. min)" });
    const user = await register(email, password);
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, plan: user.plan } });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Email déjà utilisé" });
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const user = await login(email, password);
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, plan: user.plan } });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await refreshUser(req.user.id, req.user);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
  res.json({ id: user.id, email: user.email, plan: user.plan, status: user.status, sub_end: user.sub_end });
});

// ─── Quota snapshot ──────────────────────────────────────────────────────────

app.get("/api/quota", requireAuth, async (req, res) => {
  try {
    const user = await refreshUser(req.user.id, req.user);
    const credits = await getCredits(user.id);
    res.json({ plan: user.plan, credits });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/catalog", (_req, res) => {
  res.json(publicCatalog());
});

// ─── Code Studio ─────────────────────────────────────────────────────────────

app.post("/api/code/session", requireAuth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "prompt requis" });
    const session = await createCodeSession(req.user.id, prompt);
    res.json(session);
  } catch (e) {
    console.error("[code/session]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/code/session/:id/edit", requireAuth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "prompt requis" });
    const session = await editCodeSession(req.user.id, req.params.id, prompt);
    res.json(session);
  } catch (e) {
    console.error("[code/edit]", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/code/session/:id.zip", requireAuth, async (req, res) => {
  try {
    const zip = await getCodeZip(req.user.id, req.params.id);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="ring-code-${req.params.id}.zip"`);
    res.send(zip);
  } catch (e) {
    console.error("[code/download]", e);
    res.status(404).json({ error: e.message });
  }
});

app.get("/api/code/session/:id/preview/*", requirePreviewAuth, async (req, res) => {
  try {
    const requestedPath = req.params[0] || "index.html";
    const file = await getCodePreviewFile(req.user.id, req.params.id, requestedPath);
    const ext = path.extname(file.path).toLowerCase();
    res.setHeader("Content-Type", PREVIEW_TYPES[ext] || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(file.target);
  } catch (e) {
    console.error("[code/preview]", e);
    res.status(404).send(e.message);
  }
});

// ─── Routage Groq ────────────────────────────────────────────────────────────

app.post("/api/route", requireAuth, async (req, res) => {
  try {
    const message = String(req.body?.message || "").slice(0, 8000);
    if (!message) return res.status(400).json({ error: "message requis" });
    const level = await groqRoute(message);
    // Mapping level → tier
    let tier = "NANO";
    if (level >= 10) tier = "EXPERT";
    else if (level >= 9) tier = "PRICE";
    else if (level >= 7) tier = "NORMAL";
    else if (level >= 4) tier = "MINI";

    const user = await refreshUser(req.user.id, req.user);
    const { tier: resolved, fellBack, from } = await resolveTier(user.id, user.plan, tier);
    res.json({ level, tier: resolved, fellBack, from, model: TIER_MODELS[resolved] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Chat ────────────────────────────────────────────────────────────────────

// Vérification d'âge pour Venice — stockée dans la DB sur le user
app.post("/api/age-verify", requireAuth, async (req, res) => {
  try {
    const { confirmed } = req.body ?? {};
    if (!confirmed) return res.status(400).json({ error: "Confirmation requise" });
    const db = (await import("./lib/db.js")).getDb();
    // Une requête paramétrée pg ne peut pas contenir plusieurs commandes SQL.
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE`);
    await db.query(`UPDATE users SET status='active', age_verified=TRUE WHERE id=$1`, [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("[age-verify]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/chat", requireAuth, async (req, res) => {
  try {
    const { messages, tier: reqTier, modelId, manual = false, ageVerified = false } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages requis" });
    }

    const selectedModel = modelId ? findModelInCatalog(modelId) : null;
    if (modelId && !selectedModel) return res.status(400).json({ error: `Modèle invalide: ${modelId}` });

    const inTier = normalizeTier(selectedModel?.tier || reqTier || "NANO");
    const requestedModelInfo = selectedModel?.model || TIER_MODELS[inTier];
    if (!requestedModelInfo) return res.status(400).json({ error: `Tier invalide: ${reqTier}` });

    // Vérif âge pour Venice / Uncensored
    if (requestedModelInfo.ageGate) {
      const db = (await import("./lib/db.js")).getDb();
      const { rows } = await db.query(`SELECT age_verified FROM users WHERE id=$1`, [req.user.id]);
      if (!rows[0]?.age_verified) {
        return res.status(403).json({ error: "age_gate", message: "Accès réservé aux +18 ans. Confirme ton âge pour continuer." });
      }
    }

    const user = await refreshUser(req.user.id, req.user);

    // Throttle anti-abus
    const { throttled, waitMs } = checkThrottle(user.id);
    if (throttled) {
      return res.status(429).json({ error: `Trop de messages. Attends ${Math.ceil(waitMs / 1000)}s.`, waitMs });
    }

    // Plan FREE → forcé sur le tier FREE uniquement
    const isFreePlan = FREE_TIER_ONLY_PLANS.has(user.plan);
    if (isFreePlan && inTier !== "FREE" && inTier !== "UNCENSORED") {
      return res.status(403).json({ error: "Ton plan gratuit donne uniquement accès aux modèles FREE. Passe à BASIC pour débloquer tous les modèles." });
    }

    const tier = inTier;
    const fellBack = false;
    const from = null;
    const modelInfo = selectedModel?.model || TIER_MODELS[tier];

    // Vérification crédits (FREE et UNCENSORED ne coûtent rien)
    const estimatedCost = computeCreditCost(tier, 1000, 500); // estimation avant appel
    if (estimatedCost > 0) {
      const ok = await hasEnoughCredits(user.id, estimatedCost);
      if (!ok) {
        const credits = await getCredits(user.id);
        return res.status(402).json({ error: `Crédits insuffisants (${credits.toFixed(1)} Cr restants). Passe à un plan supérieur.` });
      }
    }

    // Limite tokens input (50K)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.content?.length > 200000) {
      return res.status(400).json({ error: "Message trop long (limite 50K tokens)" });
    }

    // Compression contexte si > 20 messages
    const compressed = await compressIfNeeded(messages);

    // Appel OpenRouter
    const result = await chatWithFallback({
      modelId: modelInfo.id,
      messages: compressed,
      manual
    });

    // Tokens — on inclut les reasoning tokens (thinking) dans tokensOut
    const usage = result.raw?.usage ?? {};
    const tokensIn       = usage.prompt_tokens                                ?? Math.ceil(JSON.stringify(compressed).length / 4);
    const thinkingTokens = usage.completion_tokens_details?.reasoning_tokens  ?? 0;
    const tokensOut      = (usage.completion_tokens ?? Math.ceil(result.content.length / 4)) + thinkingTokens;
    const costEur        = estimateCostEur(tier, tokensIn, tokensOut);

    // Déduction crédits réels + enregistrement usage
    const creditCost = computeCreditCost(tier, tokensIn, tokensOut);
    await deductCredits(user.id, creditCost);
    await recordUsage(user.id, tier, tokensIn, tokensOut);

    const creditsLeft = await getCredits(user.id);

    res.json({
      content:    result.content,
      tier,
      fellBack,
      from,
      model:      modelInfo,
      tokensIn,
      tokensOut,
      thinkingTokens,
      costEur,
      creditCost,
      creditsLeft
    });
  } catch (e) {
    console.error("[chat]", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── PayPal ──────────────────────────────────────────────────────────────────

app.post("/api/subscribe/:plan", requireAuth, async (req, res) => {
  try {
    const plan = req.params.plan.toUpperCase();
    const paypalPlanId = PAYPAL_PLAN_IDS[plan];
    if (!paypalPlanId) return res.status(400).json({ error: `Plan invalide ou PAYPAL_PLAN_${plan} non configuré` });

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const { subscriptionId, approveUrl } = await createSubscriptionLink(
      paypalPlanId,
      `${origin}/subscribe/success?plan=${plan}`,
      `${origin}/billing`
    );
    res.json({ subscriptionId, approveUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Appelé après retour PayPal (return_url)
app.get("/api/subscribe/confirm", requireAuth, async (req, res) => {
  try {
    const { plan } = req.query;
    const sub = req.query.sub || req.query.subscription_id;
    if (!plan || !sub) return res.status(400).json({ error: "plan + sub requis" });
    await activateSubscription(req.user.id, sub, plan.toUpperCase());
    res.json({ ok: true, plan: plan.toUpperCase() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook PayPal (configurer l'URL dans le dashboard PayPal)
app.post("/api/paypal/webhook", async (req, res) => {
  try {
    const result = await handleWebhook(req.body, req.headers);
    res.json(result);
  } catch (e) {
    console.error("[paypal webhook]", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Studio Artiste ──────────────────────────────────────────────────────────

app.post("/api/image", requireAuth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim().slice(0, 4000);
    if (!prompt) return res.status(400).json({ error: "prompt requis" });

    const key = (process.env.OPENROUTER_API_KEY || "").trim();
    if (!key) return res.status(500).json({ error: "OPENROUTER_API_KEY manquante" });

    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://delt.ai",
        "X-Title": "DELT AI"
      },
      body: JSON.stringify({
        model: CREATIVE.IMAGE.model.id,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image"]
      })
    });

    if (!orRes.ok) {
      const txt = await orRes.text().catch(() => "");
      return res.status(orRes.status).json({ error: `OpenRouter ${orRes.status}: ${txt.slice(0, 300)}` });
    }
    const data = await orRes.json();
    const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    if (!url) return res.status(502).json({ error: "Réponse OpenRouter invalide", raw: data });

    res.json({
      provider: CREATIVE.IMAGE.model.id,
      model: CREATIVE.IMAGE.model,
      prompt,
      cost: CREATIVE.IMAGE.cost,
      url
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/video", requireAuth, async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim().slice(0, 4000);
  if (!prompt) return res.status(400).json({ error: "prompt requis" });
  res.json({
    provider: CREATIVE.VIDEO.model.id,
    model: CREATIVE.VIDEO.model,
    prompt,
    cost: CREATIVE.VIDEO.cost,
    estimatedEur: 12,
    warning: CREATIVE.VIDEO.model.warning,
    placeholder: true,
    note: CREATIVE.VIDEO.model.warning
  });
});

// ─── Health ──────────────────────────────────────────────────────────────────

const fp = (k) => k ? { present: true, length: k.length, prefix: k.slice(0, 6) + "…" } : { present: false };

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    groq:       !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    db:         !!process.env.DATABASE_URL,
    paypal:     !!process.env.PAYPAL_CLIENT_ID,
    fingerprints: {
      groq:       fp(process.env.GROQ_API_KEY),
      openrouter: fp(process.env.OPENROUTER_API_KEY)
    }
  });
});

// ─── Démarrage ───────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

async function start() {
  // Init DB seulement si DATABASE_URL présent
  if (process.env.DATABASE_URL) {
    try {
      await initSchema();
    } catch (e) {
      console.warn("⚠ DB non disponible :", e.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`\n╭─────────────────────────────────────────────────╮`);
    console.log(`│  DELT AI server  ⚡  http://localhost:${PORT}    │`);
    console.log(`╰─────────────────────────────────────────────────╯`);
    const g = process.env.GROQ_API_KEY;
    const o = process.env.OPENROUTER_API_KEY;
    if (!g) console.warn("⚠  GROQ_API_KEY manquante");
    else console.log(`✓ Groq        ${g.slice(0,6)}…${g.slice(-4)}`);
    if (!o) console.warn("⚠  OPENROUTER_API_KEY manquante");
    else console.log(`✓ OpenRouter  ${o.slice(0,6)}…${o.slice(-4)}`);
    if (!process.env.DATABASE_URL) console.warn("⚠  DATABASE_URL manquante (auth désactivée)");
    if (!process.env.JWT_SECRET) console.warn("⚠  JWT_SECRET manquant");
    if (!process.env.PAYPAL_CLIENT_ID) console.warn("⚠  PAYPAL_CLIENT_ID manquant");
  });
}

start();
