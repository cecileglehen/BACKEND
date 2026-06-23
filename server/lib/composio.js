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

// Vrai statut de connexion côté Composio (≠ notre base optimiste).
// Renvoie "ACTIVE" | "EXPIRED" | "INITIATED" | "FAILED" | null.
export async function getLiveConnectionStatus(userId, app) {
  try {
    const co = client();
    const list = await co.connectedAccounts.list({ userIds: [String(userId)] });
    const items = list?.items || list || [];
    const matches = items.filter((c) => String(c.toolkit?.slug || c.toolkit || c.appName || "").toLowerCase() === String(app).toLowerCase());
    const active = matches.find((c) => c.status === "ACTIVE");
    return (active || matches[0])?.status || null;
  } catch {
    return null;
  }
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
  // Évite l'erreur "Multiple connected accounts" : on supprime les comptes
  // existants de ce toolkit (expirés ou doublons) AVANT d'en créer un neuf.
  try {
    const existing = await co.connectedAccounts.list({ userIds: [entityId] });
    for (const c of (existing?.items || [])) {
      const slug = String(c.toolkit?.slug || c.toolkit || c.appName || "").toLowerCase();
      if (slug === String(app).toLowerCase()) await co.connectedAccounts.delete(c.id).catch(() => {});
    }
  } catch { /* noop : on continue même si le nettoyage échoue */ }
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

// Récupère les tools au format Chat Completions pour cet user.
//
// IMPORTANT : Composio default limit=20. Si on passe plusieurs toolkits en
// une fois, l'API retourne ~20 tools total (genre 20 Gmail + 0 Calendar →
// l'IA ne voit jamais Calendar). On fait donc UN APPEL PAR TOOLKIT avec
// limit=25 → garanti que chaque app a sa juste représentation.
//
// Outils ESSENTIELS garantis par app : Composio ne renvoie que ~25 tools/app, et
// certaines actions clés (modifier le schéma = AJOUTER UNE COLONNE) ne sont pas dans
// le top 25. On les charge explicitement par slug pour qu'elles soient toujours dispo.
const ESSENTIAL_TOOLS = {
  notion: [
    "NOTION_CREATE_DATABASE",
    "NOTION_UPDATE_SCHEMA_DATABASE",   // ajouter/renommer/retyper une colonne
    "NOTION_INSERT_ROW_DATABASE",
    "NOTION_QUERY_DATABASE",
    "NOTION_UPDATE_ROW_DATABASE",
    "NOTION_CREATE_NOTION_PAGE",
    "NOTION_FETCH_DATABASE",
    "NOTION_SEARCH_NOTION_PAGE"
  ]
};

// `appsOverride` = sous-liste d'apps activées dans le composer (sinon toutes
// les apps connectées).
export async function getToolsForUser(userId, appsOverride = null) {
  const integrations = await listUserIntegrations(userId);
  let connectedApps = integrations.filter((i) => i.connected).map((i) => i.app);
  if (appsOverride && appsOverride.length > 0) {
    connectedApps = connectedApps.filter((app) => appsOverride.includes(app));
  }
  if (connectedApps.length === 0) return [];

  const co = client();
  const TOOLS_PER_APP = 25;
  const out = [];
  const results = await Promise.all(connectedApps.map(async (app) => {
    try {
      const essentials = ESSENTIAL_TOOLS[app];
      const reqs = [co.tools.get(String(userId), { toolkits: [app], limit: TOOLS_PER_APP })];
      if (essentials) reqs.push(co.tools.get(String(userId), { tools: essentials }));
      const got = await Promise.all(reqs);
      const toArr = (t) => (Array.isArray(t) ? t : Object.values(t || {}));
      const essArr = essentials ? toArr(got[1]) : [];
      // Essentiels EN TÊTE pour survivre au cap, puis le reste du toolkit, dédupé.
      const seen = new Set();
      const merged = [];
      for (const t of [...essArr, ...toArr(got[0])]) {
        const n = (t.function || t)?.name;
        if (n && !seen.has(n)) { seen.add(n); merged.push(t); }
      }
      return merged.slice(0, TOOLS_PER_APP);
    } catch (e) {
      console.warn(`[composio] getTools fail pour ${app}:`, e.message);
      return [];
    }
  }));
  for (const arr of results) out.push(...arr);
  return out;
}

// Exécute un tool call émis par le LLM.
// Timeout 30s pour éviter que Gmail/Drive ne hang indéfiniment et bloque le SSE.
const TOOL_EXEC_TIMEOUT_MS = 30000;
export async function executeToolCall({ userId, toolName, args }) {
  try {
    const co = client();
    // BREAKING CHANGE Composio oct 2025 : il FAUT passer version OU
    // dangerouslySkipVersionCheck par appel. Le toolkitVersions au SDK init
    // n'est pas pris en compte par @composio/core 0.10. On passe les deux
    // par sécurité (le SDK peut renommer le flag entre versions mineures).
    const exec = co.tools.execute(toolName, {
      userId: String(userId),
      arguments: args || {},
      version: "latest",
      dangerouslySkipVersionCheck: true
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
