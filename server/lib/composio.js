// Wrapper Composio (SDK v0.10+) — OAuth handler + executor d'actions.
//
// Setup :
//   - Compte sur https://app.composio.dev → API key dans .env COMPOSIO_API_KEY
//   - Chaque user Delt AI = 1 entity Composio (userId Postgres = entityId)
//   - SDK : @composio/core + @composio/openai-agents (Tool Router pattern)

import { Composio } from "@composio/core";
// OpenAIProvider = format Chat Completions standard (compatible OpenRouter).
// L'autre provider OpenAIAgentsProvider produit un format différent (Agents SDK).
import { OpenAIProvider } from "@composio/openai";
import { getDb } from "./db.js";

const APPS_AVAILABLE = [
  { app: "gmail",         label: "Gmail",          logo: "/brands/gmail.svg",     category: "Email" },
  { app: "googledrive",   label: "Google Drive",   logo: "/brands/drive.svg",     category: "Stockage" },
  { app: "googlecalendar",label: "Google Calendar",logo: "/brands/calendar.svg",  category: "Agenda" },
  { app: "slack",         label: "Slack",          logo: "/brands/slack.svg",     category: "Communication" },
  { app: "notion",        label: "Notion",         logo: "/brands/notion.svg",    category: "Productivité" },
  { app: "github",        label: "GitHub",         logo: "/brands/github.svg",    category: "Dev" },
  { app: "linear",        label: "Linear",         logo: "/brands/linear.svg",    category: "Dev" },
  { app: "trello",        label: "Trello",         logo: "/brands/trello.svg",    category: "Projet" },
  { app: "discord",       label: "Discord",        logo: "/brands/discord.svg",   category: "Communication" },
  { app: "stripe",        label: "Stripe",         logo: "/brands/stripe.svg",    category: "Paiement" }
];

let _client = null;
function client() {
  if (_client) return _client;
  const apiKey = (process.env.COMPOSIO_API_KEY || "").trim();
  if (!apiKey) throw new Error("COMPOSIO_API_KEY manquante (compte sur app.composio.dev)");
  _client = new Composio({
    apiKey,
    provider: new OpenAIProvider(),
    // BREAKING CHANGE Composio (oct 2025) : tools.execute() throw
    // "Toolkit version not specified" sans ce setting. "latest" = toujours
    // la dernière version dispo de chaque toolkit (Gmail, Drive, etc.).
    // Si on veut pin pour stabilité prod : remplacer "latest" par "20251027_00".
    toolkitVersions: APPS_AVAILABLE.reduce((acc, a) => {
      acc[a.app] = "latest";
      return acc;
    }, {})
  });
  return _client;
}

export function listAvailableApps() {
  return APPS_AVAILABLE;
}

export async function listUserIntegrations(userId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT app_name, connection_id, connected_at, status
     FROM user_integrations
     WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );
  const connectedMap = new Map(rows.map((r) => [r.app_name, r]));
  return APPS_AVAILABLE.map((a) => ({
    ...a,
    connected: connectedMap.has(a.app),
    connectedAt: connectedMap.get(a.app)?.connected_at || null
  }));
}

// Cache des authConfigId par toolkit (1 auth config par app, réutilisée pour
// tous les users). En prod, on les crée une fois la première fois qu'un user
// se connecte à cette app — Composio gère l'OAuth Google/Slack/etc. à notre
// place (mode use_composio_managed_auth).
const authConfigCache = new Map();

async function ensureAuthConfig(co, toolkit) {
  const cached = authConfigCache.get(toolkit);
  if (cached) return cached;
  // 1. Lookup existing
  try {
    const list = await co.authConfigs.list({ toolkit });
    const existing = list?.items?.[0];
    if (existing?.id) {
      authConfigCache.set(toolkit, existing.id);
      return existing.id;
    }
  } catch (e) {
    console.warn(`[composio] authConfigs.list(${toolkit}) fail:`, e.message);
  }
  // 2. Create avec OAuth managé par Composio
  const created = await co.authConfigs.create(toolkit, { type: "use_composio_managed_auth" });
  if (!created?.id) throw new Error(`Impossible de créer authConfig pour ${toolkit}`);
  authConfigCache.set(toolkit, created.id);
  console.log(`[composio] authConfig créé pour ${toolkit}: ${created.id}`);
  return created.id;
}

// Initie une connexion OAuth pour une app donnée → renvoie l'URL où rediriger
// l'utilisateur. Composio gère le flow OAuth + stockage des tokens.
export async function initiateConnection({ userId, app, redirectUrl }) {
  const co = client();
  const entityId = String(userId);
  const authConfigId = await ensureAuthConfig(co, app);
  // Note : .initiate() est DEPRECATED pour les auth configs managées par
  // Composio (depuis fin 2025). On utilise .link() qui est la nouvelle API.
  const connection = await co.connectedAccounts.link(entityId, authConfigId, {
    callbackUrl: redirectUrl
  });
  return {
    redirectUrl: connection.redirectUrl || connection.redirectUri || connection.url || null,
    connectionId: connection.id || connection.connectionId || connection.connectedAccountId,
    status: connection.status || "INITIATED"
  };
}

export async function confirmConnection({ userId, app, connectionId }) {
  const db = getDb();
  await db.query(
    `INSERT INTO user_integrations (user_id, app_name, connection_id, entity_id, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (user_id, app_name)
     DO UPDATE SET connection_id = EXCLUDED.connection_id,
                   status = 'active',
                   connected_at = NOW(),
                   revoked_at = NULL`,
    [userId, app, connectionId, String(userId)]
  );
}

export async function revokeIntegration({ userId, app }) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT connection_id FROM user_integrations WHERE user_id = $1 AND app_name = $2 AND status = 'active'`,
    [userId, app]
  );
  if (rows[0]?.connection_id) {
    try {
      const co = client();
      await co.connectedAccounts.delete(rows[0].connection_id);
    } catch (e) {
      console.warn("[composio] revoke API fail:", e.message);
    }
  }
  await db.query(
    `UPDATE user_integrations SET status='revoked', revoked_at=NOW()
     WHERE user_id=$1 AND app_name=$2`,
    [userId, app]
  );
}

// Récupère les tools au format Chat Completions pour cet user, filtrés par
// les apps connectées (toolkits Composio).
export async function getToolsForUser(userId) {
  const integrations = await listUserIntegrations(userId);
  const connectedApps = integrations.filter((i) => i.connected).map((i) => i.app);
  if (connectedApps.length === 0) return [];
  try {
    const co = client();
    const tools = await co.tools.get(String(userId), { toolkits: connectedApps });
    if (!tools) return [];
    // co.tools.get peut renvoyer un array ou un object { name: tool }
    if (Array.isArray(tools)) return tools;
    return Object.values(tools);
  } catch (e) {
    console.warn("[composio] getTools fail:", e.message);
    return [];
  }
}

// Exécute un tool call émis par le LLM.
// Timeout 30s pour éviter que Gmail/Drive ne hang indéfiniment et bloque le SSE.
const TOOL_EXEC_TIMEOUT_MS = 30000;
export async function executeToolCall({ userId, toolName, args }) {
  try {
    const co = client();
    const exec = co.tools.execute(toolName, {
      userId: String(userId),
      arguments: args || {}
    });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool ${toolName} timeout après ${TOOL_EXEC_TIMEOUT_MS / 1000}s`)), TOOL_EXEC_TIMEOUT_MS)
    );
    return await Promise.race([exec, timeout]);
  } catch (e) {
    // Extraction explicite : Composio peut renvoyer e.message, e.error,
    // e.response.data.message, etc. selon la couche qui throw.
    const detail =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.body?.message ||
      e?.error?.message ||
      e?.message ||
      String(e);
    console.warn(`[composio] executeToolCall(${toolName}) fail:`, detail);
    return { error: detail, tool: toolName };
  }
}
