// ─── Missions d'agent en arrière-plan ────────────────────────────────────────
// Un VRAI agent (pattern Manus / ChatGPT Agent) : l'utilisateur donne un objectif,
// l'agent tourne en fond côté serveur avec une boucle Plan → Act → Observe →
// Verify, persiste chaque étape en DB (l'UI la suit en polling), et livre un
// résultat final. Réutilise la persona/connaissances de l'agent (agents.js) et
// les outils existants (recherche web Serper).
import { getDb } from "./db.js";
import { chatWithFallback } from "./openrouter.js";
import { searchWithQuery } from "./websearch.js";
import { buildAgentSystemMessage } from "./agents.js";
import { TIER_MODELS, computeCreditFromCost } from "../config/plans.js";
import { consumeWindow } from "./quota.js";
import { logUsage } from "./windows.js";

const MODEL_BRAIN = TIER_MODELS.MINI?.id || "openai/gpt-5.4-mini";     // plan / réflexion
const MODEL_FINAL = TIER_MODELS.NORMAL?.id || "anthropic/claude-sonnet-5"; // livrable

const MAX_ITERATIONS = 5;      // cycles Act → Observe → Reflect max
const MAX_RUNTIME_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_PER_USER = 1;

// runId → { cancelled: bool } (annulation coopérative, in-process)
const liveRuns = new Map();

function rowToRun(r) {
  if (!r) return null;
  return {
    id: r.id,
    agentId: r.agent_id,
    goal: r.goal,
    status: r.status,
    steps: r.steps || [],
    result: r.result,
    error: r.error,
    creditCost: Number(r.credit_cost) || 0,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime()
  };
}

export async function listRuns(userId, agentId, limit = 20) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM agent_runs WHERE user_id=$1 AND agent_id=$2 ORDER BY created_at DESC LIMIT $3`,
    [userId, agentId, Math.min(50, limit)]
  );
  return rows.map(rowToRun);
}

export async function getRun(userId, runId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM agent_runs WHERE id=$1 AND user_id=$2`,
    [runId, userId]
  );
  return rowToRun(rows[0]);
}

export async function cancelRun(userId, runId) {
  const live = liveRuns.get(runId);
  if (live) live.cancelled = true;
  const db = getDb();
  const { rowCount } = await db.query(
    `UPDATE agent_runs SET status='cancelled', updated_at=NOW()
     WHERE id=$1 AND user_id=$2 AND status='running'`,
    [runId, userId]
  );
  return rowCount > 0;
}

async function countRunning(userId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM agent_runs WHERE user_id=$1 AND status='running'`,
    [userId]
  );
  return rows[0]?.n || 0;
}

// Lance une mission : crée la ligne en DB et démarre la boucle SANS l'attendre.
export async function startAgentRun({ user, agent, goal, language = "fr" }) {
  const cleanGoal = String(goal || "").trim().slice(0, 4000);
  if (!cleanGoal) { const e = new Error("Objectif requis"); e.status = 400; throw e; }

  const running = await countRunning(user.id);
  if (running >= MAX_CONCURRENT_PER_USER) {
    const e = new Error("Une mission est déjà en cours — attends qu'elle se termine (ou annule-la).");
    e.status = 429;
    throw e;
  }

  const db = getDb();
  const { rows } = await db.query(
    `INSERT INTO agent_runs (user_id, agent_id, goal, status, steps)
     VALUES ($1, $2, $3, 'running', '[]'::jsonb) RETURNING *`,
    [user.id, agent.id, cleanGoal]
  );
  const run = rowToRun(rows[0]);
  liveRuns.set(run.id, { cancelled: false });

  // Fire-and-forget : la boucle tourne en fond, l'UI suit via GET /api/agent-runs/:id
  runLoop({ runId: run.id, user, agent, goal: cleanGoal, language }).catch(async (e) => {
    console.error("[agent-run] loop crash:", e);
    await db.query(
      `UPDATE agent_runs SET status='failed', error=$2, updated_at=NOW() WHERE id=$1 AND status='running'`,
      [run.id, String(e.message || e).slice(0, 500)]
    ).catch(() => {});
  }).finally(() => liveRuns.delete(run.id));

  return run;
}

// ─── La boucle agentique ─────────────────────────────────────────────────────
async function runLoop({ runId, user, agent, goal, language }) {
  const db = getDb();
  const startedAt = Date.now();
  const usage = [];
  const steps = [];
  const findings = [];   // observations accumulées (résultats d'outils)

  const persist = async () => {
    await db.query(
      `UPDATE agent_runs SET steps=$2::jsonb, updated_at=NOW() WHERE id=$1`,
      [runId, JSON.stringify(steps)]
    );
  };
  const step = async (label, status = "running", note = null) => {
    const existing = steps.find((s) => s.label === label);
    if (existing) { existing.status = status; if (note) existing.note = note; }
    else steps.push({ label, status, note, ts: Date.now() });
    await persist();
  };
  const isCancelled = () =>
    liveRuns.get(runId)?.cancelled || Date.now() - startedAt > MAX_RUNTIME_MS;

  const persona = buildAgentSystemMessage(agent);
  const canSearch = agent.capabilities?.webSearch !== false;

  const callJson = async (messages) => {
    const r = await chatWithFallback({ modelId: MODEL_BRAIN, messages, manual: false });
    usage.push(usageOf(r));
    return parseJson(r.content);
  };

  // ── 1. PLAN ────────────────────────────────────────────────────────────────
  await step("Plan de mission");
  const plan = await callJson([
    persona,
    { role: "system", content: [
      "Tu prépares une MISSION AUTONOME que tu vas exécuter en arrière-plan.",
      "Décompose l'objectif en 2 à 5 sous-tâches concrètes et vérifiables.",
      'Réponds en JSON strict : {"subTasks":["...", "..."], "needsWeb": true|false}'
    ].join("\n") },
    { role: "user", content: `Objectif de la mission (langue: ${language}) : ${goal}` }
  ]);
  const subTasks = Array.isArray(plan?.subTasks)
    ? plan.subTasks.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 5)
    : [goal];
  await step("Plan de mission", "done", subTasks.join(" · ").slice(0, 300));

  // ── 2. BOUCLE ACT → OBSERVE → REFLECT ─────────────────────────────────────
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    if (isCancelled()) return finish("cancelled");

    const reflLabel = `Réflexion ${i}`;
    await step(reflLabel);
    const decision = await callJson([
      persona,
      { role: "system", content: [
        "Tu es en train d'exécuter une mission autonome. Décide de ta PROCHAINE action.",
        canSearch
          ? "Outil disponible : web_search (recherche Google temps réel)."
          : "Aucun outil web — travaille sur tes connaissances.",
        "Règles : si tu as assez d'éléments pour livrer un résultat complet → done=true.",
        "Sinon propose 1-3 requêtes web PRÉCISES qui comblent ce qui manque (jamais des redites).",
        `Itération ${i}/${MAX_ITERATIONS} — à la dernière, arrête-toi si l'essentiel est couvert.`,
        'JSON strict : {"reasoning":"1-2 phrases","done":true|false,"queries":["..."]}'
      ].join("\n") },
      { role: "user", content: [
        `Objectif : ${goal}`,
        `Sous-tâches : ${JSON.stringify(subTasks)}`,
        `Observations déjà collectées (${findings.length}) :`,
        findings.map((f, j) => `[${j + 1}] ${f.slice(0, 500)}`).join("\n") || "(aucune)"
      ].join("\n") }
    ]);
    const queries = (canSearch && Array.isArray(decision?.queries) ? decision.queries : [])
      .map((q) => String(q || "").trim()).filter(Boolean).slice(0, 3);
    await step(reflLabel, "done", String(decision?.reasoning || "").slice(0, 200));

    if (decision?.done || !queries.length) break;
    if (isCancelled()) return finish("cancelled");

    const actLabel = `Recherche ${i}`;
    await step(actLabel);
    let observed = 0;
    for (const q of queries) {
      try {
        const r = await searchWithQuery(q, 5);
        const text = String(r?.contextText || r?.text || JSON.stringify(r?.results || r || "")).slice(0, 3000);
        if (text) { findings.push(`Recherche « ${q} » :\n${text}`); observed++; }
      } catch { /* une requête qui rate ne tue pas la mission */ }
    }
    await step(actLabel, "done", `${queries.length} requête(s), ${observed} observation(s)`);
    if (!observed) break; // plus rien de neuf → on livre
  }

  if (isCancelled()) return finish("cancelled");

  // ── 3. VERIFY ──────────────────────────────────────────────────────────────
  await step("Vérification");
  const verify = await callJson([
    persona,
    { role: "system", content: [
      "Contrôle qualité avant livraison : les sous-tâches sont-elles couvertes par les observations ?",
      'JSON strict : {"coverage":"ok|partial","missing":["..."]}'
    ].join("\n") },
    { role: "user", content: `Objectif: ${goal}\nSous-tâches: ${JSON.stringify(subTasks)}\nObservations:\n${findings.join("\n---\n").slice(0, 8000) || "(aucune)"}` }
  ]);
  await step("Vérification", "done", verify?.coverage === "ok" ? "Couverture complète" : `Partiel : ${(verify?.missing || []).join(", ").slice(0, 150)}`);

  // ── 4. DELIVER ─────────────────────────────────────────────────────────────
  await step("Livrable final");
  const final = await chatWithFallback({
    modelId: agent.defaultModel || MODEL_FINAL,
    manual: false,
    messages: [
      persona,
      { role: "system", content: [
        "Rédige maintenant le LIVRABLE FINAL de ta mission, en Markdown structuré et actionnable.",
        `Langue : ${language}. Appuie-toi sur les observations (cite les faits, pas d'invention).`,
        verify?.coverage !== "ok" ? "Signale honnêtement en fin de livrable les points non couverts." : ""
      ].filter(Boolean).join("\n") },
      { role: "user", content: `Mission : ${goal}\n\nSous-tâches : ${JSON.stringify(subTasks)}\n\nObservations collectées :\n${findings.join("\n---\n").slice(0, 16000) || "(travail sur connaissances internes)"}` }
    ]
  });
  usage.push(usageOf(final));
  await step("Livrable final", "done");

  return finish("done", final.content || "");

  async function finish(status, result = null) {
    // Facturation : coût réel cumulé → crédits → barre de conso (fenêtre 3h)
    const costUsd = usage.reduce((n, u) => n + (u.costUsd || 0), 0);
    const tokensIn = usage.reduce((n, u) => n + (u.tokensIn || 0), 0);
    const tokensOut = usage.reduce((n, u) => n + (u.tokensOut || 0), 0);
    const creditCost = computeCreditFromCost({ costUsd, modelId: MODEL_BRAIN, tokensIn, tokensOut });
    try {
      await consumeWindow(user.id, creditCost);
      logUsage({ userId: user.id, modelId: agent.defaultModel || MODEL_BRAIN, tier: "AGENT", tokensIn, tokensOut, costCr: creditCost, source: "agent_run" });
    } catch { /* ignore */ }
    await db.query(
      `UPDATE agent_runs SET status=$2, steps=$3::jsonb, result=$4, credit_cost=$5, updated_at=NOW() WHERE id=$1`,
      [runId, status, JSON.stringify(steps), result, creditCost]
    );
  }
}

function usageOf(result) {
  const u = result?.raw?.usage || {};
  return {
    tokensIn: u.prompt_tokens || 0,
    tokensOut: (u.completion_tokens || 0) + (u.completion_tokens_details?.reasoning_tokens || 0),
    costUsd: Number(u.cost) || 0
  };
}

function parseJson(content) {
  const raw = String(content || "").trim();
  try { return JSON.parse(raw); } catch { /* continue */ }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) { try { return JSON.parse(fenced.trim()); } catch { /* continue */ } }
  const obj = raw.match(/\{[\s\S]*\}/)?.[0];
  if (obj) { try { return JSON.parse(obj); } catch { /* continue */ } }
  return {};
}
