// Wrapper Composio (SDK v0.10+) — OAuth handler + executor d'actions.
//
// Setup :
//   - Compte sur https://app.composio.dev → API key dans .env COMPOSIO_API_KEY
//   - Chaque user Delt AI = 1 entity Composio (userId Postgres = entityId)
//   - SDK : @composio/core + @composio/openai-agents (Tool Router pattern)

import { Composio } from "@composio/core";
import { OpenAIAgentsProvider } from "@composio/openai-agents";
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
    provider: new OpenAIAgentsProvider()
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

// Initie une connexion OAuth pour une app donnée → renvoie l'URL où rediriger
// l'utilisateur. Composio gère le flow OAuth + stockage des tokens.
export async function initiateConnection({ userId, app, redirectUrl }) {
  const co = client();
  const entityId = String(userId);
  const connection = await co.connectedAccounts.initiate(entityId, {
    toolkit: app,
    callbackUrl: redirectUrl
  });
  return {
    redirectUrl: connection.redirectUrl || connection.redirectUri || connection.url,
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

// Renvoie une session Tool Router pour cet user (utilisée pour le tool calling).
// Le pattern @composio/core v0.10 : composio.create(entityId) → session, puis
// session.tools() renvoie les tools au format OpenAI Agents.
export async function getSessionForUser(userId) {
  const co = client();
  const entityId = String(userId);
  return co.create(entityId);
}

// Récupère les tools formatés OpenAI-compatible (utilisable directement dans
// messages[].tools du chat OpenRouter).
export async function getToolsForUser(userId) {
  try {
    const session = await getSessionForUser(userId);
    const tools = await session.tools();
    return tools || [];
  } catch (e) {
    console.warn("[composio] getTools fail:", e.message);
    return [];
  }
}
