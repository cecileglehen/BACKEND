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
import { chatWithFallback, streamChat } from "./lib/openrouter.js";
import { recordUsage, logUsage, quotaSnapshot, resolveTier } from "./lib/windows.js";
import { getCredits, deductCredits, hasEnoughCredits, grantPlanCredits, resetMonthlyCredits, getApiCredits, transferCredits, getFreeNanoTokens, deductFreeNanoTokens, FREE_NANO_MODEL_ID } from "./lib/credits.js";
import { computeCreditCost, computeCreditFromCost, FREE_TIER_ONLY_PLANS } from "./config/plans.js";
import { runDeepSearch } from "./lib/deepSearch.js";
import { checkThrottle } from "./lib/throttle.js";
import { compressIfNeeded } from "./lib/context.js";
import { createCodeSession, editCodeSession, getCodePreviewFile, getCodeZip } from "./lib/codegen.js";
import { TIER_MODELS, estimateCostEur } from "./config/plans.js";
import { brandFromAlias, CREATIVE, findModelForBrand, findModelInCatalog, isBrandAlias, normalizeTier, publicCatalog } from "./config/models.js";
import { createSubscriptionLink, activateSubscription, handleWebhook, PAYPAL_PLAN_IDS } from "./lib/paypal.js";
import { createClient } from "@supabase/supabase-js";
import { routeMessage as groqRoute } from "./lib/router.js";
import { createApiKey, listApiKeys, revokeApiKey } from "./lib/apiKeys.js";
import multer from "multer";
import { canTranscribe, addTranscriptionUsage, transcribeAudio } from "./lib/transcribe.js";
import { deleteUserData, exportUserData, recordConsent } from "./lib/privacy.js";
import { deleteConversation, getConversation, listConversations, saveConversation } from "./lib/conversations.js";
import { getUserDataKey } from "./lib/cryptoBox.js";
import v1Router from "./routes/v1.js";

const app = express();
app.set("trust proxy", 1);
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
    const { accessToken, termsAccepted = false, privacyAccepted = false } = req.body ?? {};
    if (!accessToken) return res.status(400).json({ error: "accessToken requis" });

    // Vérifie le token via Supabase Auth (appel HTTP, pas pg)
    const { data: { user: sbUser }, error: sbErr } = await supabase.auth.getUser(accessToken);
    if (sbErr || !sbUser?.email) return res.status(401).json({ error: "Token invalide" });

    // Crée un user DELT minimal en mémoire (DB optionnelle)
    const user = {
      id:    sbUser.id,
      email: sbUser.email,
      plan:  "FREE"
    };

    // Si DB disponible, upsert pour persister le plan/quota
    if (process.env.DATABASE_URL) {
      try {
        const db = (await import("./lib/db.js")).getDb();
        const existing = await db.query(`SELECT id FROM users WHERE email=$1 AND deleted_at IS NULL`, [sbUser.email]);
        if (!existing.rows[0] && (!termsAccepted || !privacyAccepted)) {
          return res.status(400).json({ error: "Tu dois accepter les CGU et la politique de confidentialité." });
        }
        const r = await db.query(
          `INSERT INTO users (id, email, password, plan, status, auth_provider)
           VALUES ($1, $2, '', 'FREE', 'active', 'google')
           ON CONFLICT (email) DO UPDATE SET auth_provider = 'google'
           RETURNING *`,
          [sbUser.id, sbUser.email]
        );
        Object.assign(user, { plan: r.rows[0].plan });
        if (!existing.rows[0]) {
          await getUserDataKey(r.rows[0].id);
          await recordConsent(r.rows[0].id, "terms", req);
          await recordConsent(r.rows[0].id, "privacy", req);
          await recordConsent(r.rows[0].id, "google_oauth_signup", req);
        }
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
    const { email, password, termsAccepted = false, privacyAccepted = false } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "email + password requis" });
    if (password.length < 8) return res.status(400).json({ error: "Mot de passe trop court (8 car. min)" });
    const user = await register(email, password, { termsAccepted, privacyAccepted, req });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, plan: user.plan } });
  } catch (e) {
    if (e.code === "CONSENT_REQUIRED") return res.status(400).json({ error: e.message });
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
  res.json({
    id: user.id, email: user.email, plan: user.plan, status: user.status, sub_end: user.sub_end,
    modelPreferences: user.model_preferences || {},
    onboardedModels: Boolean(user.onboarded_models)
  });
});

// ─── Projets ─────────────────────────────────────────────────────────────────
app.get("/api/projects", requireAuth, async (req, res) => {
  try {
    const { listProjects } = await import("./lib/projects.js");
    const projects = await listProjects(req.user.id);
    res.json({ projects });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const { getProject } = await import("./lib/projects.js");
    const p = await getProject(req.user.id, req.params.id);
    if (!p) return res.status(404).json({ error: "Projet introuvable" });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/projects", requireAuth, async (req, res) => {
  try {
    const { createProject } = await import("./lib/projects.js");
    const project = await createProject(req.user.id, req.body || {});
    res.json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const { updateProject } = await import("./lib/projects.js");
    const project = await updateProject(req.user.id, req.params.id, req.body || {});
    if (!project) return res.status(404).json({ error: "Projet introuvable" });
    res.json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const { deleteProject } = await import("./lib/projects.js");
    const ok = await deleteProject(req.user.id, req.params.id);
    res.json({ deleted: ok });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/conversations/:id/project", requireAuth, async (req, res) => {
  try {
    const { attachConversationToProject } = await import("./lib/projects.js");
    const ok = await attachConversationToProject(req.user.id, req.params.id, req.body?.projectId || null);
    res.json({ ok });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Mémoire utilisateur (nom, intérêts, prefs IA) ───────────────────────────
app.get("/api/memory", requireAuth, async (req, res) => {
  try {
    const { getDb } = await import("./lib/db.js");
    const { rows } = await getDb().query(
      `SELECT display_name, memory_profile FROM users WHERE id=$1`, [req.user.id]
    );
    res.json({
      displayName: rows[0]?.display_name || null,
      profile: rows[0]?.memory_profile || {}
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/memory", requireAuth, async (req, res) => {
  try {
    const { displayName, profile } = req.body ?? {};
    const cleanName = displayName ? String(displayName).slice(0, 60).trim() : null;
    const cleanProfile = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
    const { getDb } = await import("./lib/db.js");
    await getDb().query(
      `UPDATE users SET display_name=$2, memory_profile=$3 WHERE id=$1`,
      [req.user.id, cleanName, JSON.stringify(cleanProfile)]
    );
    res.json({ displayName: cleanName, profile: cleanProfile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Préférences modèles par tier (mode auto) ────────────────────────────────
app.get("/api/preferences/models", requireAuth, async (req, res) => {
  try {
    const { getDb } = await import("./lib/db.js");
    const { rows } = await getDb().query(
      `SELECT model_preferences, onboarded_models FROM users WHERE id=$1`, [req.user.id]
    );
    res.json({
      preferences: rows[0]?.model_preferences || {},
      onboarded: Boolean(rows[0]?.onboarded_models)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/preferences/models", requireAuth, async (req, res) => {
  try {
    const prefs = req.body?.preferences;
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
      return res.status(400).json({ error: "preferences object requis" });
    }
    // Valide : chaque entrée doit être un modèle existant
    const cleaned = {};
    for (const [tier, modelId] of Object.entries(prefs)) {
      if (!modelId) continue;
      const found = findModelInCatalog(String(modelId));
      if (found && normalizeTier(found.tier) === normalizeTier(tier)) {
        cleaned[normalizeTier(tier)] = found.model.id;
      }
    }
    const { getDb } = await import("./lib/db.js");
    await getDb().query(
      `UPDATE users SET model_preferences=$2, onboarded_models=TRUE WHERE id=$1`,
      [req.user.id, JSON.stringify(cleaned)]
    );
    res.json({ preferences: cleaned, onboarded: true });
  } catch (e) {
    console.error("[preferences]", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── RGPD : droits utilisateur ───────────────────────────────────────────────

app.get("/api/privacy/export", requireAuth, async (req, res) => {
  try {
    const data = await exportUserData(req.user.id, req);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="delt-data-export-${req.user.id}.json"`);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/privacy/account", requireAuth, async (req, res) => {
  try {
    const result = await deleteUserData(req.user.id, req);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Quota snapshot ──────────────────────────────────────────────────────────

function buildProjectSystemMessage(project) {
  if (!project) return null;
  const lines = [
    `Tu es dans le projet "${project.name}".`,
    "Utilise le contexte de ce projet pour répondre de façon cohérente dans ce chat."
  ];
  if (project.systemPrompt) {
    lines.push("");
    lines.push(project.systemPrompt);
  }
  const pm = project.memory || {};
  const knowledge = [];
  if (pm.keyFacts?.length) knowledge.push(`Faits clés : ${pm.keyFacts.join(" · ")}`);
  if (pm.context) knowledge.push(`Contexte : ${pm.context}`);
  if (knowledge.length > 0) {
    lines.push("");
    lines.push("Contexte du projet :");
    lines.push(...knowledge);
  }
  return { role: "system", content: lines.join("\n") };
}

function resolveRequestedModel(modelId, tier) {
  if (!modelId) return null;
  if (isBrandAlias(modelId)) {
    const brand = brandFromAlias(modelId);
    return findModelForBrand(brand, tier);
  }
  return findModelInCatalog(modelId);
}

// ─── Mode Débat — multi-agent séquentiel ───────────────────────────────────
// Phases : propose → critique → optimize → synthesize
// Chaque agent voit le contexte des précédents.
app.post("/api/chat/debate", requireAuth, async (req, res) => {
  try {
    const { question, agents, debateMode, rounds } = req.body ?? {};
    if (!question || !Array.isArray(agents) || agents.length < 2) {
      return res.status(400).json({ error: "question + agents (≥2) requis" });
    }
    const user = await refreshUser(req.user.id, req.user);
    if (FREE_TIER_ONLY_PLANS.has(user.plan)) {
      return res.status(403).json({ error: "Le mode débat nécessite un plan payant." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Description des rôles
    const ROLE_PROMPTS = {
      propose:    "Tu es chargé de PROPOSER une réponse complète et structurée à la question. Sois précis, donne des exemples concrets.",
      critique:   "Tu es CRITIQUE. Lis attentivement la proposition ci-dessous et identifie : (1) ce qui est juste, (2) ce qui est faux/incomplet/approximatif, (3) ce qui manque. Sois constructif mais rigoureux. Format : courte évaluation puis liste structurée.",
      optimize:   "Tu es OPTIMISEUR. À partir de la proposition initiale et de la critique, produis une VERSION AMÉLIORÉE de la réponse. Corrige les erreurs, complète les manques, garde le bon. Ne dis pas 'voici la version améliorée', réponds simplement comme si tu répondais à la question d'origine.",
      synthesize: "Tu es SYNTHÉTISEUR. Tu vois la question d'origine et le travail des autres agents. Produis la RÉPONSE FINALE ultime — claire, complète, structurée, sans mentionner le processus. C'est ce que l'utilisateur va lire."
    };
    const ITERATIVE_PROMPTS = {
      propose: "Tu participes à un débat. Donne une première réponse en 3 à 6 phrases, concrète, sans tout développer.",
      critique: "Tu participes à un débat. Commence naturellement par reconnaître ce qui va, puis expose les failles, angles morts ou corrections. 3 à 6 phrases.",
      optimize: "Tu participes à un débat. Améliore la réponse précédente en intégrant les critiques. 3 à 7 phrases, précis.",
      synthesize: "Tu clos le débat. Produit la réponse finale parfaite, claire et structurée, sans raconter le débat."
    };

    const transcripts = []; // [{role, model, content}]
    const debateRounds = Math.max(4, Math.min(12, Number(rounds) || 10));
    const baseAgents = debateMode === "iterative" ? agents.slice(0, 3) : agents;
    const turns = debateMode === "iterative"
      ? Array.from({ length: debateRounds }, (_, index) => {
          let role = "critique";
          if (index === 0) role = "propose";
          else if (index === debateRounds - 1) role = "synthesize";
          else if (index % 3 === 2) role = "optimize";
          return { agent: baseAgents[index % baseAgents.length], role };
        })
      : baseAgents.map((agent, i) => ({
          agent,
          role: agent.role || (i === 0 ? "propose" : i === baseAgents.length - 1 ? "synthesize" : i === 1 ? "critique" : "optimize")
        }));

    for (let i = 0; i < turns.length; i++) {
      const { agent: a, role } = turns[i];
      const found = resolveRequestedModel(a.modelId, a.tier || "NORMAL");
      if (!found) {
        res.write(`data: ${JSON.stringify({ type: "agent_error", index: i, error: `Modèle introuvable: ${a.modelId}` })}\n\n`);
        continue;
      }

      // Construit le prompt pour cet agent
      const sysPrompt = debateMode === "iterative"
        ? (ITERATIVE_PROMPTS[role] || ITERATIVE_PROMPTS.propose)
        : (ROLE_PROMPTS[role] || ROLE_PROMPTS.propose);
      const userPrompt = [
        `QUESTION DE L'UTILISATEUR :\n${question}`,
        ...transcripts.map((t, j) => `\n— Tour ${j + 1} (${t.role} · ${t.modelDisplay}) —\n${t.content}`),
        ``,
        debateMode === "iterative"
          ? `Réponds au tour ${i + 1} comme dans une vraie discussion.`
          : `Maintenant, en tant que ${role.toUpperCase()}, réponds.`
      ].join("\n");

      // Notifie le client : démarrage de cette étape
      res.write(`data: ${JSON.stringify({
        type: "agent_start",
        index: i,
        role,
        model: { id: found.model.id, display: found.model.display, brand: found.model.brand },
        tier: found.tier
      })}\n\n`);

      let agentContent = "";
      let agentReasoning = "";
      await new Promise((resolve) => {
        streamChat({
          modelId: found.model.id,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt }
          ],
          // Adapte res.write pour préfixer chaque delta avec l'index agent
          res: {
            write: (chunk) => {
              // Parse "data: {...}\n\n"
              const m = chunk.match(/^data: (.+)\n\n$/);
              if (!m) return res.write(chunk);
              try {
                const msg = JSON.parse(m[1]);
                if (msg.type === "thinking") {
                  agentReasoning += msg.delta || "";
                  res.write(`data: ${JSON.stringify({ type: "agent_thinking", index: i, delta: msg.delta || "" })}\n\n`);
                  return;
                }
                if (msg.delta !== undefined) {
                  agentContent += msg.delta;
                  res.write(`data: ${JSON.stringify({ type: "agent_delta", index: i, delta: msg.delta })}\n\n`);
                }
              } catch { /* */ }
            },
            setHeader: () => {}, flushHeaders: () => {}, end: () => {}
          },
          onDone: async ({ tokensIn, tokensOut, thinkingTokens, costUsd }) => {
            const creditCost = computeCreditFromCost({
              costUsd: Number(costUsd) || 0,
              modelId: found.model.id,
              tokensIn,
              tokensOut
            });
            const creditsLeft = await deductCredits(user.id, creditCost);
            await Promise.allSettled([
              recordUsage(user.id, found.tier, tokensIn, tokensOut),
              logUsage({ userId: user.id, modelId: found.model.id, tier: found.tier, tokensIn, tokensOut, costCr: creditCost, source: "debate" })
            ]);
            transcripts.push({
              role,
              modelDisplay: found.model.display,
              content: agentContent
            });
            res.write(`data: ${JSON.stringify({
              type: "agent_done",
              index: i,
              tokensOut,
              thinkingTokens,
              creditCost,
              creditsLeft
            })}\n\n`);
            resolve();
          }
        }).catch((e) => {
          res.write(`data: ${JSON.stringify({ type: "agent_error", index: i, error: e.message })}\n\n`);
          resolve();
        });
      });
    }

    res.write(`data: ${JSON.stringify({ type: "debate_done" })}\n\n`);
    res.end();
  } catch (e) {
    console.error("[debate]", e);
    if (!res.headersSent) return res.status(500).json({ error: e.message });
    res.write(`data: ${JSON.stringify({ type: "error", error: e.message })}\n\n`);
    res.end();
  }
});

// ─── Fusion intelligente de plusieurs réponses ──────────────────────────────
app.post("/api/chat/merge", requireAuth, async (req, res) => {
  try {
    const { question, responses, modelId, projectId } = req.body ?? {};
    if (!question || !Array.isArray(responses) || responses.length < 2) {
      return res.status(400).json({ error: "question + responses (≥2) requis" });
    }

    const user = await refreshUser(req.user.id, req.user);
    const isFreePlan = FREE_TIER_ONLY_PLANS.has(user.plan);
    if (isFreePlan) {
      return res.status(403).json({ error: "La fusion nécessite un plan payant." });
    }

    // Modèle synthétiseur : par défaut Claude Sonnet 4.5 (excellent pour la synthèse)
    const fusionModel = modelId || "anthropic/claude-sonnet-4-5";
    const found = findModelInCatalog(fusionModel);
    if (!found) return res.status(400).json({ error: "Modèle de fusion invalide" });

    let project = null;
    if (projectId) {
      const { getProject } = await import("./lib/projects.js");
      project = await getProject(req.user.id, projectId);
    }

    const systemPrompt = [
      "Tu es un synthétiseur expert. Tu reçois la question d'un utilisateur et plusieurs réponses générées par différents modèles d'IA.",
      "Ta mission : produire UNE réponse fusionnée optimale qui :",
      "1. Garde le meilleur de chaque réponse (faits, nuances, exemples).",
      "2. Élimine les contradictions en privilégiant les faits vérifiables et le consensus.",
      "3. Reste concise mais complète, structurée si nécessaire.",
      "4. Ne dis JAMAIS 'le modèle A dit X' — produis une réponse unifiée comme si tu répondais toi-même.",
      "5. Réponds dans la langue de la question."
    ].join("\n");

    const userPrompt = [
      `QUESTION ORIGINALE :\n${question}`,
      ``,
      `RÉPONSES À FUSIONNER :`,
      ...responses.map((r, i) => `\n— Réponse ${i + 1} (${r.model || "modèle inconnu"}) —\n${r.content}`),
      ``,
      `Produis maintenant la réponse fusionnée optimale.`
    ].join("\n");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: "meta", model: found.model, tier: found.tier })}\n\n`);

    await streamChat({
      modelId: found.model.id,
      messages: [
        ...(project ? [buildProjectSystemMessage(project)] : []),
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt }
      ],
      res,
      onDone: async ({ tokensIn, tokensOut }) => {
        const creditCost = computeCreditCost(found.model.id, tokensIn, tokensOut);
        deductCredits(user.id, creditCost).catch(() => {});
        recordUsage(user.id, found.tier, tokensIn, tokensOut).catch(() => {});
        logUsage({ userId: user.id, modelId: found.model.id, tier: found.tier, tokensIn, tokensOut, costCr: creditCost, source: "merge" });
        res.write(`data: ${JSON.stringify({ type: "done", tokensIn, tokensOut, creditCost })}\n\n`);
        res.end();
      }
    });
  } catch (e) {
    console.error("[chat/merge]", e);
    if (!res.headersSent) return res.status(500).json({ error: e.message });
    res.write(`data: ${JSON.stringify({ type: "error", error: e.message })}\n\n`);
    res.end();
  }
});

app.get("/api/usage", requireAuth, async (req, res) => {
  try {
    const period = String(req.query.period || "30d");
    const intervalDays = period === "7d" ? 7 : period === "90d" ? 90 : period === "all" ? 3650 : 30;
    const { getDb } = await import("./lib/db.js");
    const db = getDb();

    const [byModel, byDay, totals, recent] = await Promise.all([
      // Agrégation par modèle
      db.query(
        `SELECT model_id, tier,
                SUM(tokens_in)  AS tokens_in,
                SUM(tokens_out) AS tokens_out,
                SUM(cost_cr)    AS cost_cr,
                COUNT(*)        AS calls,
                MAX(created_at) AS last_used
         FROM usage_log
         WHERE user_id = $1 AND created_at > NOW() - ($2 || ' days')::interval
         GROUP BY model_id, tier
         ORDER BY cost_cr DESC`,
        [req.user.id, String(intervalDays)]
      ),
      // Série temporelle par jour
      db.query(
        `SELECT DATE(created_at) AS day,
                SUM(tokens_in)  AS tokens_in,
                SUM(tokens_out) AS tokens_out,
                SUM(cost_cr)    AS cost_cr,
                COUNT(*)        AS calls
         FROM usage_log
         WHERE user_id = $1 AND created_at > NOW() - ($2 || ' days')::interval
         GROUP BY DATE(created_at)
         ORDER BY day ASC`,
        [req.user.id, String(intervalDays)]
      ),
      // Totaux globaux
      db.query(
        `SELECT
           SUM(tokens_in)  AS tokens_in,
           SUM(tokens_out) AS tokens_out,
           SUM(cost_cr)    AS cost_cr,
           COUNT(*)        AS calls,
           COUNT(DISTINCT model_id) AS unique_models
         FROM usage_log
         WHERE user_id = $1 AND created_at > NOW() - ($2 || ' days')::interval`,
        [req.user.id, String(intervalDays)]
      ),
      // 20 derniers appels
      db.query(
        `SELECT model_id, tier, tokens_in, tokens_out, cost_cr, source, created_at
         FROM usage_log
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [req.user.id]
      )
    ]);

    res.json({
      period,
      byModel: byModel.rows,
      byDay: byDay.rows,
      totals: totals.rows[0] || { tokens_in: 0, tokens_out: 0, cost_cr: 0, calls: 0, unique_models: 0 },
      recent: recent.rows
    });
  } catch (e) {
    console.error("[usage]", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/quota", requireAuth, async (req, res) => {
  try {
    const user = await refreshUser(req.user.id, req.user);
    const credits = await getCredits(user.id);
    const apiCredits = await getApiCredits(user.id);
    res.json({ plan: user.plan, credits, apiCredits });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Transfert plan ↔ API
app.post("/api/credits/transfer", requireAuth, async (req, res) => {
  try {
    const { amount, direction = "to_api" } = req.body ?? {};
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ error: "Montant invalide" });
    }
    const result = await transferCredits(req.user.id, n, direction === "to_api");
    res.json({
      ok: true,
      credits: Number(result.credits),
      apiCredits: Number(result.api_credits)
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/catalog", (_req, res) => {
  res.json(publicCatalog());
});

// ─── Conversations chiffrées ────────────────────────────────────────────────

app.get("/api/conversations", requireAuth, async (req, res) => {
  try {
    const conversations = await listConversations(req.user.id);
    res.json({ conversations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/conversations/:id", requireAuth, async (req, res) => {
  try {
    const conversation = await getConversation(req.user.id, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation introuvable" });
    res.json(conversation);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/conversations/:id", requireAuth, async (req, res) => {
  try {
    const result = await saveConversation(req.user.id, req.params.id, req.body?.messages);
    // Attache au projet si fourni
    if (req.body?.projectId !== undefined) {
      const { attachConversationToProject } = await import("./lib/projects.js");
      await attachConversationToProject(req.user.id, req.params.id, req.body.projectId || null);
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/conversations/:id", requireAuth, async (req, res) => {
  try {
    const ok = await deleteConversation(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: "Conversation introuvable" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Code Studio ─────────────────────────────────────────────────────────────

app.post("/api/code/session", requireAuth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "prompt requis" });
    const modelId = String(req.body?.modelId || "").trim() || undefined;
    const session = await createCodeSession(req.user.id, prompt, modelId);
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
    const modelId = String(req.body?.modelId || "").trim() || undefined;
    const session = await editCodeSession(req.user.id, req.params.id, prompt, modelId);
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
    if (level >= 9) tier = "EXPERT";
    else if (level >= 7) tier = "NORMAL";
    else if (level >= 4) tier = "MINI";

    const user = await refreshUser(req.user.id, req.user);
    const { tier: resolved, fellBack, from } = await resolveTier(user.id, user.plan, tier);
    res.json({ level, tier: resolved, fellBack, from, model: TIER_MODELS[resolved] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Deep Search ─────────────────────────────────────────────────────────────

app.post("/api/deep-search", requireAuth, async (req, res) => {
  try {
    const { prompt, maxSources = 10, language = "fr" } = req.body ?? {};
    const question = String(prompt || "").trim();
    if (!question) return res.status(400).json({ error: "prompt requis" });

    const user = await refreshUser(req.user.id, req.user);
    if (FREE_TIER_ONLY_PLANS.has(user.plan)) {
      return res.status(403).json({ error: "Deep Search est réservé aux plans BASIC et supérieurs." });
    }

    const minStartCost = 1;
    const ok = await hasEnoughCredits(user.id, minStartCost);
    if (!ok) {
      const credits = await getCredits(user.id);
      return res.status(402).json({ error: `Crédits insuffisants (${Number(credits).toFixed(2)} Cr).` });
    }

    const report = await runDeepSearch({
      userId: user.id,
      prompt: question,
      maxSources,
      language
    });

    const creditsLeft = await deductCredits(user.id, report.creditCost);
    await Promise.allSettled([
      recordUsage(user.id, "NORMAL", report.tokensIn || 0, report.tokensOut || 0),
      logUsage({
        userId: user.id,
        modelId: "deep-search",
        tier: "NORMAL",
        tokensIn: report.tokensIn || 0,
        tokensOut: report.tokensOut || 0,
        costCr: report.creditCost || 0,
        source: "deep_search"
      })
    ]);

    res.json({ ...report, creditsLeft });
  } catch (e) {
    console.error("[deep-search]", e);
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
    const { messages, tier: reqTier, modelId, manual = false, ageVerified = false, projectId } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages requis" });
    }

    let project = null;
    if (projectId) {
      const { getProject } = await import("./lib/projects.js");
      project = await getProject(req.user.id, projectId);
    }
    const effectiveModelId = modelId || project?.defaultModel || null;
    const selectedModel = effectiveModelId ? resolveRequestedModel(effectiveModelId, reqTier || "NANO") : null;
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
    let modelInfo = selectedModel?.model;
    if (!modelInfo) {
      const prefs = user?.model_preferences || {};
      const preferredId = prefs[tier];
      if (preferredId) {
        const pref = findModelInCatalog(preferredId);
        if (pref && normalizeTier(pref.tier) === tier) modelInfo = pref.model;
      }
    }
    if (!modelInfo) modelInfo = TIER_MODELS[tier];

    // Vérification crédits (FREE et UNCENSORED ne coûtent rien)
    const estimatedCost = computeCreditCost(modelInfo.id, 1000, 500); // estimation avant appel
    if (estimatedCost > 0) {
      const ok = await hasEnoughCredits(user.id, estimatedCost);
      if (!ok) {
        const credits = await getCredits(user.id);
        return res.status(402).json({ error: `Crédits insuffisants (${Number(credits).toFixed(2)} Cr restants). Passe à un plan supérieur.` });
      }
    }

    // Limite tokens input (50K)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.content?.length > 200000) {
      return res.status(400).json({ error: "Message trop long (limite 50K tokens)" });
    }

    // Compression contexte si > 20 messages
    let compressed = await compressIfNeeded(messages);
    if (project) {
      const projectSystem = buildProjectSystemMessage(project);
      if (projectSystem) compressed = [projectSystem, ...compressed];
    }

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
    const costUsd        = Number(usage.cost) || 0;
    const costEur        = estimateCostEur(tier, tokensIn, tokensOut);

    // Déduction crédits : on utilise le coût réel OpenRouter avec marge si dispo,
    // sinon fallback sur la grille tier
    const creditCost = computeCreditFromCost({
      costUsd,
      modelId: result.modelUsed || modelInfo.id,
      tokensIn, tokensOut
    });
    const creditsLeft = await deductCredits(user.id, creditCost);
    await recordUsage(user.id, tier, tokensIn, tokensOut);
    logUsage({ userId: user.id, modelId: result.modelUsed || modelInfo.id, tier, tokensIn, tokensOut, costCr: creditCost, source: "chat" });

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

// ─── Chat streaming SSE ──────────────────────────────────────────────────────

app.post("/api/chat/stream", requireAuth, async (req, res) => {
  try {
    const { messages, tier: reqTier, modelId, manual = false, projectId } = req.body ?? {};
    let project = null;
    if (projectId) {
      const { getProject } = await import("./lib/projects.js");
      project = await getProject(req.user.id, projectId);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages requis" });
    }

    // Si un projet a un défaut model et qu'aucun modèle n'est forcé, utilise-le
    const effectiveModelId = modelId || project?.defaultModel || null;
    const selectedModel = effectiveModelId ? resolveRequestedModel(effectiveModelId, reqTier || "NANO") : null;
    const inTier = normalizeTier(selectedModel?.tier || reqTier || "NANO");

    const user = await refreshUser(req.user.id, req.user);

    // En mode auto (pas de modelId), regarde la préférence user pour ce tier
    let modelInfo = selectedModel?.model || null;
    if (!modelInfo) {
      const prefs = user?.model_preferences || {};
      const preferredId = prefs[inTier];
      if (preferredId) {
        const pref = findModelInCatalog(preferredId);
        if (pref && normalizeTier(pref.tier) === inTier) modelInfo = pref.model;
      }
    }
    if (!modelInfo) modelInfo = TIER_MODELS[inTier];
    if (!modelInfo) return res.status(400).json({ error: `Tier invalide: ${reqTier}` });

    // ─── Traitement des pièces jointes ──────────────────────────────────────
    // Vérifie la limite par conversation et convertit chaque message qui en a
    const { getPlanLimits } = await import("./config/plans.js");
    const { buildMessageContent } = await import("./lib/attachments.js");
    const planLimits = getPlanLimits(user.plan);
    const totalAttachments = messages.reduce((sum, m) => sum + (Array.isArray(m.attachments) ? m.attachments.length : 0), 0);
    if (totalAttachments > planLimits.attachmentsPerConv) {
      return res.status(403).json({
        error: `Limite de pièces jointes dépassée (${totalAttachments}/${planLimits.attachmentsPerConv} pour le plan ${user.plan}). Passe à un plan supérieur pour plus.`
      });
    }

    // Reconstruit les messages avec le format multimodal si attachments présents
    for (const m of messages) {
      if (Array.isArray(m.attachments) && m.attachments.length > 0) {
        m.content = buildMessageContent(m.content || "", m.attachments);
        delete m.attachments;
      }
    }

    const isFreePlan = FREE_TIER_ONLY_PLANS.has(user.plan);
    const isFreeNanoModel = modelInfo.id === FREE_NANO_MODEL_ID;
    if (isFreePlan && inTier !== "FREE" && inTier !== "UNCENSORED" && !isFreeNanoModel) {
      return res.status(403).json({ error: "Plan gratuit : accès aux modèles FREE uniquement. Mistral Small 4 est offert (10K tokens/mois)." });
    }
    if (isFreePlan && isFreeNanoModel) {
      const remaining = await getFreeNanoTokens(user.id);
      if (remaining <= 0) {
        return res.status(403).json({ error: "Tes 10 000 tokens gratuits Mistral Small 4 sont épuisés ce mois-ci. Passe à BASIC pour continuer." });
      }
    }

    const { throttled, waitMs } = checkThrottle(user.id);
    if (throttled) return res.status(429).json({ error: `Attends ${Math.ceil(waitMs / 1000)}s.`, waitMs });

    const estimatedCost = isFreeNanoModel && isFreePlan ? 0 : computeCreditCost(modelInfo.id, 1000, 500);
    if (estimatedCost > 0) {
      const ok = await hasEnoughCredits(user.id, estimatedCost);
      if (!ok) {
        const credits = await getCredits(user.id);
        return res.status(402).json({ error: `Crédits insuffisants (${Number(credits).toFixed(2)} Cr).` });
      }
    }

    let compressed = await compressIfNeeded(messages);

    // ─── Injection system prompt projet (en premier) ────────────────────────
    if (project) {
      const projectSystem = buildProjectSystemMessage(project);
      if (projectSystem) compressed = [projectSystem, ...compressed];
    }

    // ─── Injection mémoire utilisateur (system prompt) ──────────────────────
    if (user.display_name || (user.memory_profile && Object.keys(user.memory_profile).length > 0)) {
      const mem = user.memory_profile || {};
      const memLines = [];
      if (user.display_name) memLines.push(`L'utilisateur s'appelle ${user.display_name}.`);
      if (mem.interests?.length) memLines.push(`Ses centres d'intérêt : ${mem.interests.join(", ")}.`);
      if (mem.role) memLines.push(`Son rôle / métier : ${mem.role}.`);
      if (mem.tone) memLines.push(`Préfère un ton ${mem.tone}.`);
      if (mem.lang) memLines.push(`Langue préférée : ${mem.lang}.`);
      if (mem.context) memLines.push(`Contexte personnel : ${mem.context}`);
      if (memLines.length > 0) {
        compressed = [
          { role: "system", content: `À propos de l'utilisateur (à garder en tête) :\n${memLines.join("\n")}` },
          ...compressed
        ];
      }
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Envoie les métadonnées initiales
    res.write(`data: ${JSON.stringify({ type: "meta", tier: inTier, model: modelInfo })}\n\n`);

    // ─── Détection auto de recherche web ───────────────────────────────────
    const isSonar = /perplexity\/sonar/i.test(modelInfo.id);
    const userLastMsg = [...compressed].reverse().find((m) => m.role === "user")?.content || "";
    const hasSerperKey = Boolean((process.env.SERPER_API_KEY || "").trim());

    const { shouldSearchHeuristic, performWebSearch, buildSearchSystemPrompt } = await import("./lib/websearch.js");
    const decision = shouldSearchHeuristic(userLastMsg);

    console.log("[websearch] decision:", {
      isSonar,
      hasSerperKey,
      userMsgPreview: userLastMsg.slice(0, 80),
      decision
    });

    if (!isSonar && decision.needsSearch && hasSerperKey) {
      console.log("[websearch] → lancement Serper pour:", userLastMsg.slice(0, 100));
      res.write(`data: ${JSON.stringify({ type: "websearch", status: "searching" })}\n\n`);

      const searchData = await performWebSearch(userLastMsg);
      console.log("[websearch] résultats:", searchData?.results?.length ?? 0);

      if (searchData?.results?.length > 0) {
        res.write(`data: ${JSON.stringify({
          type: "websearch",
          status: "found",
          count: searchData.results.length,
          results: searchData.results.slice(0, 8).map((r) => ({ title: r.title, url: r.url, snippet: r.snippet }))
        })}\n\n`);

        const systemPrompt = buildSearchSystemPrompt(searchData.contextText);
        compressed = [
          { role: "system", content: systemPrompt },
          ...compressed
        ];
        console.log("[websearch] system prompt injecté (longueur:", systemPrompt.length, "chars)");
      }
    } else if (decision.needsSearch && !hasSerperKey) {
      console.warn("[websearch] ⚠ Détection positive mais SERPER_API_KEY absente — search skippée");
    }

    await streamChat({
      modelId: modelInfo.id,
      messages: compressed,
      res,
      onDone: async ({ content, tokensIn, tokensOut, thinkingTokens, costUsd }) => {
        // 1. Calcule le coût SANS appel DB (instantané) — basé sur le coût réel OpenRouter
        const creditCost = (isFreePlan && isFreeNanoModel)
          ? 0
          : computeCreditFromCost({ costUsd, modelId: modelInfo.id, tokensIn, tokensOut });
        const costEur = estimateCostEur(inTier, tokensIn, tokensOut);

        // 2. Envoie immédiatement les tokens à l'UI (creditsLeft suit après)
        res.write(`data: ${JSON.stringify({
          type: "done", tokensIn, tokensOut, thinkingTokens, creditCost, costEur
        })}\n\n`);
        res.end();

        // 3. Déduit les crédits + enregistre l'usage en arrière-plan (parallèle)
        Promise.allSettled([
          isFreePlan && isFreeNanoModel
            ? deductFreeNanoTokens(user.id, tokensIn + tokensOut)
            : deductCredits(user.id, creditCost),
          recordUsage(user.id, inTier, tokensIn, tokensOut),
          logUsage({ userId: user.id, modelId: modelInfo.id, tier: inTier, tokensIn, tokensOut, costCr: creditCost, source: "chat" })
        ]).catch((e) => console.error("[chat/stream] DB background:", e));
      }
    });
  } catch (e) {
    console.error("[chat/stream]", e);
    if (!res.headersSent) return res.status(500).json({ error: e.message });
    res.write(`data: ${JSON.stringify({ type: "error", error: e.message })}\n\n`);
    res.end();
  }
});

// ─── PayPal ──────────────────────────────────────────────────────────────────

// IMPORTANT : routes spécifiques AVANT la route paramétrée /:plan
// Activate via JS SDK (popup) — pas de redirect
app.post("/api/subscribe/activate", requireAuth, async (req, res) => {
  try {
    const { plan, subscriptionId } = req.body ?? {};
    if (!plan || !subscriptionId) return res.status(400).json({ error: "plan + subscriptionId requis" });
    await activateSubscription(req.user.id, subscriptionId, plan.toUpperCase());
    const { grantPlanCredits } = await import("./lib/credits.js");
    await grantPlanCredits(req.user.id, plan.toUpperCase());
    res.json({ ok: true, plan: plan.toUpperCase() });
  } catch (e) {
    console.error("[subscribe/activate]", e);
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
    const { grantPlanCredits } = await import("./lib/credits.js");
    await grantPlanCredits(req.user.id, plan.toUpperCase());
    res.json({ ok: true, plan: plan.toUpperCase() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Création de subscription via redirect (legacy fallback)
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

// Config publique PayPal pour le frontend (clientId + plan IDs selon le mode)
app.get("/api/paypal/config", (_req, res) => {
  const isSandbox = process.env.PAYPAL_MODE === "sandbox";
  const prefix = isSandbox ? "SAND_PAYPAL_" : "PAYPAL_";
  res.json({
    clientId: process.env[`${prefix}CLIENT_ID`] || null,
    mode: isSandbox ? "sandbox" : "live",
    plans: {
      BASIC: process.env[`${prefix}PLAN_BASIC`] || null,
      PLUS:  process.env[`${prefix}PLAN_PLUS`]  || null,
      PRO:   process.env[`${prefix}PLAN_PRO`]   || null,
      ULTRA: process.env[`${prefix}PLAN_ULTRA`] || null
    }
  });
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

    const requestedModelId = String(req.body?.modelId || "").trim();
    const imageModels = CREATIVE.IMAGE.models;
    const chosenModel = imageModels.find((m) => m.id === requestedModelId) || imageModels[0];
    const cost = chosenModel.cost ?? 8;

    // Vérification crédits avant appel
    const ok = await hasEnoughCredits(req.user.id, cost);
    if (!ok) {
      const credits = await getCredits(req.user.id);
      return res.status(402).json({
        error: `Crédits insuffisants (${Number(credits).toFixed(1)} Cr restants, requis : ${cost} Cr).`
      });
    }

    let url = null;
    if (chosenModel.provider === "fal") {
      // fal.ai (FLUX, etc.)
      const { falGenerateImage } = await import("./lib/fal.js");
      const result = await falGenerateImage(chosenModel.id, prompt);
      url = result.url;
    } else {
      // OpenRouter (Gemini, etc.)
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
          model: chosenModel.id,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image"]
        })
      });
      if (!orRes.ok) {
        const txt = await orRes.text().catch(() => "");
        return res.status(orRes.status).json({ error: `OpenRouter ${orRes.status}: ${txt.slice(0, 300)}` });
      }
      const data = await orRes.json();
      url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    }

    if (!url) return res.status(502).json({ error: "Réponse provider invalide" });

    // Déduit le coût en crédits sur le pool plan
    try { await deductCredits(req.user.id, cost); } catch { /* ignore */ }

    res.json({
      provider: chosenModel.provider,
      model: chosenModel,
      prompt,
      cost,
      url
    });
  } catch (e) {
    console.error("[image]", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Transcription vocale (Groq Whisper) ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 Mo (limite Whisper)
});

// Upload pour pièces jointes (max 100 MB, on filtre par plan ensuite)
const uploadAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.post("/api/upload", requireAuth, uploadAttachment.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Fichier requis" });
    const user = await refreshUser(req.user.id, req.user);
    const { parseAttachment } = await import("./lib/attachments.js");
    const parsed = await parseAttachment(req.file.buffer, req.file, user.plan);
    res.json(parsed);
  } catch (e) {
    console.error("[upload]", e);
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/transcribe", requireAuth, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Fichier audio requis" });

    const user = await refreshUser(req.user.id, req.user);
    const check = await canTranscribe(user.id, user.plan);
    if (!check.allowed) {
      return res.status(403).json({
        error: "Limite mensuelle atteinte (10 min). Passe au plan BASIC ou plus pour la dictée illimitée.",
        used: check.used,
        limit: check.limit
      });
    }

    const result = await transcribeAudio(req.file.buffer, req.file.mimetype, req.file.originalname);

    if (user.plan === "FREE") {
      await addTranscriptionUsage(user.id, result.duration || 0);
    }

    res.json({
      text: result.text,
      duration: result.duration,
      language: result.language,
      remaining: user.plan === "FREE" ? Math.max(0, (check.remaining || 0) - (result.duration || 0)) : null
    });
  } catch (e) {
    console.error("[transcribe]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/video", requireAuth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim().slice(0, 4000);
    if (!prompt) return res.status(400).json({ error: "prompt requis" });

    const requestedModelId = String(req.body?.modelId || "").trim();
    const videoModels = CREATIVE.VIDEO.models;
    const chosenModel = videoModels.find((m) => m.id === requestedModelId) || videoModels[0];
    const duration = Math.max(1, Math.min(10, Number(req.body?.duration) || 5));
    const cost = Math.ceil((chosenModel.crPerSecond720p ?? 50) * duration);

    const ok = await hasEnoughCredits(req.user.id, cost);
    if (!ok) {
      const credits = await getCredits(req.user.id);
      return res.status(402).json({
        error: `Crédits insuffisants (${Number(credits).toFixed(1)} Cr restants, requis : ${cost} Cr).`
      });
    }

    if (chosenModel.provider !== "fal") {
      return res.status(400).json({ error: "Provider vidéo non supporté" });
    }

    const { falGenerateVideo } = await import("./lib/fal.js");
    const result = await falGenerateVideo(chosenModel.id, prompt, { duration, resolution: "720p" });

    try { await deductCredits(req.user.id, cost); } catch { /* ignore */ }

    res.json({
      provider: chosenModel.provider,
      model: chosenModel,
      prompt,
      duration,
      cost,
      url: result.url
    });
  } catch (e) {
    console.error("[video]", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Musique (Suno) ──────────────────────────────────────────────────────────
app.post("/api/music", requireAuth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim().slice(0, 3000);
    if (!prompt) return res.status(400).json({ error: "prompt requis" });

    const musicModel = CREATIVE.MUSIC.models[0];
    const cost = musicModel.cost;

    const ok = await hasEnoughCredits(req.user.id, cost);
    if (!ok) {
      const credits = await getCredits(req.user.id);
      return res.status(402).json({
        error: `Crédits insuffisants (${Number(credits).toFixed(1)} Cr restants, requis : ${cost} Cr).`
      });
    }

    const { sunoGenerate } = await import("./lib/suno.js");
    const result = await sunoGenerate({
      customMode:         req.body?.customMode ?? true,
      instrumental:       Boolean(req.body?.instrumental),
      model:              req.body?.model || "V5_5",
      prompt,
      style:              req.body?.style || "Pop",
      title:              req.body?.title || prompt.slice(0, 60),
      personaId:          req.body?.personaId,
      personaModel:       req.body?.personaModel,
      negativeTags:       req.body?.negativeTags,
      vocalGender:        req.body?.vocalGender,
      styleWeight:        req.body?.styleWeight,
      weirdnessConstraint:req.body?.weirdnessConstraint,
      audioWeight:        req.body?.audioWeight
    });

    try { await deductCredits(req.user.id, cost); } catch { /* ignore */ }

    res.json({
      provider: "suno",
      model: musicModel,
      taskId: result.taskId,
      tracks: result.tracks,
      cost
    });
  } catch (e) {
    console.error("[music]", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── API Keys (dashboard) ────────────────────────────────────────────────────

app.get("/api/keys", requireAuth, async (req, res) => {
  try {
    const keys = await listApiKeys(req.user.id);
    res.json({ keys });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/keys", requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().slice(0, 100) || null;
    const key = await createApiKey(req.user.id, name);
    res.json(key);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/keys/:id", requireAuth, async (req, res) => {
  try {
    const ok = await revokeApiKey(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: "Clé introuvable" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API publique /v1 (compatible OpenAI) ────────────────────────────────────
app.use("/v1", v1Router);

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
