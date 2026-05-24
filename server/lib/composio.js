// Wrapper Composio : OAuth handler + executor d'actions.
//
// Setup :
//   - Compte sur https://app.composio.dev → API key dans .env COMPOSIO_API_KEY
//   - Chaque user Delt AI = 1 entity Composio (entityId = userId Postgres)
//   - Apps gérés : Gmail, Drive, Calendar, Slack, Notion, GitHub, Linear,
//     Trello, Discord, Stripe — la liste s'enrichit via APPS_AVAILABLE.

import { Composio } from "composio-core";
import { getDb } from "./db.js";

const APPS_AVAILABLE = [
  { app: "gmail",        label: "Gmail",         logo: "/brands/gmail.svg",     category: "Email" },
  { app: "googledrive",  label: "Google Drive",  logo: "/brands/drive.svg",     category: "Stockage" },
  { app: "googlecalendar",label:"Google Calendar",logo: "/brands/calendar.svg", category: "Agenda" },
  { app: "slack",        label: "Slack",         logo: "/brands/slack.svg",     category: "Communication" },
  { app: "notion",       label: "Notion",        logo: "/brands/notion.svg",    category: "Productivité" },
  { app: "github",       label: "GitHub",        logo: "/brands/github.svg",    category: "Dev" },
  { app: "linear",       label: "Linear",        logo: "/brands/linear.svg",    category: "Dev" },
  { app: "trello",       label: "Trello",        logo: "/brands/trello.svg",    category: "Projet" },
  { app: "discord",      label: "Discord",       logo: "/brands/discord.svg",   category: "Communication" },
  { app: "stripe",       label: "Stripe",        logo: "/brands/stripe.svg",    category: "Paiement" }
];

let _client = null;
function client() {
  if (_client) return _client;
  const apiKey = (process.env.COMPOSIO_API_KEY || "").trim();
  if (!apiKey) throw new Error("COMPOSIO_API_KEY manquante (compte sur app.composio.dev)");
  _client = new Composio({ apiKey });
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
// l'utilisateur. Composio appelle un callback config dans son dashboard, on
// reçoit ensuite un webhook (ou on poll le status).
export async function initiateConnection({ userId, app, redirectUrl }) {
  const co = client();
  const entityId = String(userId);
  const entity = await co.getEntity(entityId);
  const connectionRequest = await entity.initiateConnection({
    appName: app,
    redirectUri: redirectUrl
  });
  return {
    redirectUrl: connectionRequest.redirectUrl,
    connectionId: connectionRequest.connectedAccountId,
    status: connectionRequest.connectionStatus || "INITIATED"
  };
}

// À appeler après que l'utilisateur revient du flow OAuth, pour persister
// la connexion en DB.
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
      await co.connectedAccounts.delete({ connectedAccountId: rows[0].connection_id });
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

// Liste des tools disponibles pour cet user (toutes apps connectées confondues).
// Format OpenAI-compatible → directement injectable dans messages[].
export async function getToolsForUser(userId) {
  const co = client();
  const entityId = String(userId);
  const integrations = await listUserIntegrations(userId);
  const connectedApps = integrations.filter((i) => i.connected).map((i) => i.app);
  if (connectedApps.length === 0) return [];
  try {
    const tools = await co.tools.get({ entityId, apps: connectedApps, limit: 50 });
    return tools || [];
  } catch (e) {
    console.warn("[composio] getTools fail:", e.message);
    return [];
  }
}

// Exécute un tool call. `action` = nom Composio (ex "GMAIL_SEND_EMAIL"),
// `params` = arguments fournis par le LLM.
export async function executeAction({ userId, action, params }) {
  const co = client();
  const entityId = String(userId);
  const result = await co.actions.execute({
    actionName: action,
    requestBody: { entityId, input: params || {} }
  });
  return result;
}
