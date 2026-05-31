import { getDb } from "./db.js";
import { getAgentLimit } from "../config/plans.js";

// Capacités par défaut d'un agent (ce qu'un bon agent IA sait faire).
const DEFAULT_CAPABILITIES = {
  webSearch: true,    // recherche web + deep search
  toolUse: true,      // appeler les intégrations Composio cochées
  fileGen: true,      // écrire des fichiers téléchargeables (skills %%)
  imageGen: false,    // générer des images inline (coûte des crédits)
  memory: true        // exploiter sa base de connaissances
};

function rowToAgent(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    icon: r.icon,
    instructions: r.instructions,
    defaultModel: r.default_model,
    tools: r.tools || [],
    capabilities: { ...DEFAULT_CAPABILITIES, ...(r.capabilities || {}) },
    knowledge: r.knowledge || {},
    starters: r.starters || [],
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime()
  };
}

export async function listAgents(userId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM agents WHERE user_id=$1 ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map(rowToAgent);
}

export async function getAgent(userId, agentId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM agents WHERE id=$1 AND user_id=$2`,
    [agentId, userId]
  );
  return rowToAgent(rows[0]);
}

export async function countAgents(userId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM agents WHERE user_id=$1`,
    [userId]
  );
  return rows[0]?.n || 0;
}

// Renvoie { limit, used, remaining, canCreate } pour le plan donné.
export async function getAgentQuota(userId, plan) {
  const limit = getAgentLimit(plan);
  const used = await countAgents(userId);
  return { limit, used, remaining: Math.max(0, limit - used), canCreate: used < limit };
}

function sanitizeTools(tools) {
  if (!Array.isArray(tools)) return [];
  return tools.map((t) => String(t).toLowerCase().slice(0, 40)).slice(0, 20);
}

function sanitizeStarters(starters) {
  if (!Array.isArray(starters)) return [];
  return starters.map((s) => String(s).slice(0, 200)).filter(Boolean).slice(0, 6);
}

function sanitizeKnowledge(k) {
  const kn = k && typeof k === "object" ? k : {};
  const keyFacts = Array.isArray(kn.keyFacts)
    ? kn.keyFacts.map((f) => String(f).slice(0, 300)).filter(Boolean).slice(0, 30)
    : [];
  const context = kn.context ? String(kn.context).slice(0, 4000) : "";
  return { keyFacts, context };
}

function sanitizeCapabilities(c) {
  const cap = c && typeof c === "object" ? c : {};
  return {
    webSearch: cap.webSearch !== false,
    toolUse:   cap.toolUse !== false,
    fileGen:   cap.fileGen !== false,
    imageGen:  cap.imageGen === true,
    memory:    cap.memory !== false
  };
}

export async function createAgent(userId, plan, data) {
  // Enforcement de la limite plan AVANT insertion
  const quota = await getAgentQuota(userId, plan);
  if (!quota.canCreate) {
    const err = new Error(
      quota.limit === 0
        ? "Les agents IA nécessitent un abonnement payant (BASIC 10€ = 1 agent)."
        : `Limite d'agents atteinte (${quota.used}/${quota.limit} pour le plan ${plan}). Passe à un plan supérieur pour en créer plus.`
    );
    err.status = 403;
    err.code = "agent_limit";
    err.quota = quota;
    throw err;
  }

  const db = getDb();
  const { rows } = await db.query(
    `INSERT INTO agents (user_id, name, description, color, icon, instructions, default_model, tools, capabilities, knowledge, starters)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      userId,
      String(data.name || "Nouvel agent").slice(0, 80),
      data.description ? String(data.description).slice(0, 500) : null,
      data.color || "#6366f1",
      data.icon || "🤖",
      data.instructions ? String(data.instructions).slice(0, 8000) : null,
      data.defaultModel || null,
      JSON.stringify(sanitizeTools(data.tools)),
      JSON.stringify(sanitizeCapabilities(data.capabilities)),
      JSON.stringify(sanitizeKnowledge(data.knowledge)),
      JSON.stringify(sanitizeStarters(data.starters))
    ]
  );
  return rowToAgent(rows[0]);
}

export async function updateAgent(userId, agentId, data) {
  const db = getDb();
  const sets = [];
  const params = [agentId, userId];
  let i = 3;
  const apply = (col, val) => { sets.push(`${col} = $${i}`); params.push(val); i++; };

  if (data.name !== undefined) apply("name", String(data.name).slice(0, 80));
  if (data.description !== undefined) apply("description", data.description ? String(data.description).slice(0, 500) : null);
  if (data.color !== undefined) apply("color", data.color);
  if (data.icon !== undefined) apply("icon", data.icon);
  if (data.instructions !== undefined) apply("instructions", data.instructions ? String(data.instructions).slice(0, 8000) : null);
  if (data.defaultModel !== undefined) apply("default_model", data.defaultModel || null);
  if (data.tools !== undefined) apply("tools", JSON.stringify(sanitizeTools(data.tools)));
  if (data.capabilities !== undefined) apply("capabilities", JSON.stringify(sanitizeCapabilities(data.capabilities)));
  if (data.knowledge !== undefined) apply("knowledge", JSON.stringify(sanitizeKnowledge(data.knowledge)));
  if (data.starters !== undefined) apply("starters", JSON.stringify(sanitizeStarters(data.starters)));

  sets.push(`updated_at = NOW()`);
  if (sets.length === 1) return getAgent(userId, agentId);

  const { rows } = await db.query(
    `UPDATE agents SET ${sets.join(", ")} WHERE id=$1 AND user_id=$2 RETURNING *`,
    params
  );
  return rowToAgent(rows[0]);
}

export async function deleteAgent(userId, agentId) {
  const db = getDb();
  const { rowCount } = await db.query(
    `DELETE FROM agents WHERE id=$1 AND user_id=$2`,
    [agentId, userId]
  );
  return rowCount > 0;
}

// Construit le message system d'un agent (persona + capacités + connaissances).
export function buildAgentSystemMessage(agent) {
  if (!agent) return null;
  const cap = agent.capabilities || {};
  const lines = [
    `Tu es « ${agent.name} », un agent IA spécialisé créé par l'utilisateur sur Delt AI.`
  ];
  if (agent.description) lines.push(agent.description);

  if (agent.instructions) {
    lines.push("");
    lines.push("=== TES INSTRUCTIONS (à suivre en priorité absolue) ===");
    lines.push(agent.instructions);
  }

  // Connaissances injectées (RAG-lite)
  const kn = agent.knowledge || {};
  const know = [];
  if (cap.memory !== false) {
    if (kn.keyFacts?.length) know.push(`Faits de référence :\n- ${kn.keyFacts.join("\n- ")}`);
    if (kn.context) know.push(`Contexte / base de connaissances :\n${kn.context}`);
  }
  if (know.length) {
    lines.push("");
    lines.push("=== TA BASE DE CONNAISSANCES ===");
    lines.push(know.join("\n\n"));
    lines.push("Utilise ces informations en priorité. Si une réponse contredit ces faits, signale-le.");
  }

  // Capacités déclarées
  const caps = [];
  if (cap.webSearch !== false) caps.push("rechercher sur le web (Deep Search) pour des infos récentes/factuelles");
  if (cap.toolUse !== false && agent.tools?.length) caps.push(`utiliser des intégrations : ${agent.tools.join(", ")}`);
  if (cap.fileGen !== false) caps.push("produire des fichiers téléchargeables (code, docs, CSV, PowerPoint)");
  if (cap.imageGen === true) caps.push("générer des images");
  if (caps.length) {
    lines.push("");
    lines.push("=== TES CAPACITÉS ===");
    lines.push(`Tu peux : ${caps.join(" ; ")}.`);
    lines.push("Sois proactif : si une tâche nécessite une de ces capacités, utilise-la sans demander la permission (sauf action destructive/envoi externe → confirme d'abord).");
  }

  lines.push("");
  lines.push("Reste fidèle à ton rôle. Si on te demande quelque chose hors de ton domaine, tu peux aider mais rappelle ta spécialité.");
  return { role: "system", content: lines.join("\n") };
}
