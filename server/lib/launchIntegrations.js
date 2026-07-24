// LaunchIntegrations — passerelle entre les apps Launch et les intégrations
// Composio du CRÉATEUR (scopées par son userId). V1 : Notion.
//
// Modèle : le créateur connecte Notion (page DELT /integrations), puis indique
// une page/DB Notion cible par projet (launch_projects.notion_target). À chaque
// commande payée (webhook Stripe) OU appel SDK depuis l'app, on crée une entrée.
import { getDb } from "./db.js";
import { getToolsForUser, executeToolCall, getLiveConnectionStatus } from "./composio.js";

// Découvre le nom exact de l'action « créer une page Notion » pour cet user
// (les slugs Composio peuvent varier selon la version → on cherche par motif).
const _toolCache = new Map(); // userId -> toolName
async function findNotionCreateTool(userId) {
  if (_toolCache.has(userId)) return _toolCache.get(userId);
  let name = "NOTION_CREATE_NOTION_PAGE"; // défaut documenté
  try {
    const tools = await getToolsForUser(userId, ["notion"]);
    const names = tools
      .map((t) => t?.function?.name || t?.name || t?.slug || "")
      .filter(Boolean);
    const hit = names.find((n) => /CREATE.*PAGE/i.test(n)) || names.find((n) => /NOTION.*PAGE/i.test(n));
    if (hit) name = hit;
    // On ne met en cache QUE si la découverte a marché : si Notion n'était pas
    // encore connecté au 1er appel, un défaut figé en cache aurait empêché de
    // retrouver le vrai slug après connexion (bug : logs silencieusement perdus).
    if (names.length > 0) _toolCache.set(userId, name);
  } catch { /* on garde le défaut, sans le figer */ }
  return name;
}

// Normalise l'ID Notion collé par le créateur (URL complète OU 32 hex sans tirets)
// vers le format UUID tiré 8-4-4-4-12 exigé par l'API Notion/Composio.
function notionParentId(raw) {
  const s = String(raw || "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s;
  const m = s.replace(/-/g, "").match(/[0-9a-f]{32}/i);
  if (!m) return s;
  const h = m[0];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Le créateur a-t-il connecté Notion + configuré une cible pour ce projet ?
export async function getProjectNotion(projectId) {
  const { rows } = await getDb().query(
    `SELECT p.user_id, p.notion_target, p.summary AS app_name
       FROM launch_projects p
      WHERE p.id = $1`,
    [projectId]
  );
  return rows[0] || null;
}

export async function setProjectNotion(userId, projectId, target) {
  await getDb().query(
    `UPDATE launch_projects SET notion_target = $3 WHERE id = $1 AND user_id = $2`,
    [projectId, userId, String(target || "").trim() || null]
  );
  return { ok: true };
}

// Crée une page Notion dans la cible du créateur. `title` + `markdown` (corps).
// Renvoie { ok } ou { error } — ne throw jamais (best-effort, ne casse pas un paiement).
export async function notionLog({ creatorUserId, target, title, markdown }) {
  if (!creatorUserId || !target) return { ok: false, error: "Notion non configuré" };
  try {
    const toolName = await findNotionCreateTool(creatorUserId);
    const res = await executeToolCall({
      userId: creatorUserId,
      toolName,
      args: {
        parent_id: notionParentId(target),
        title: String(title || "Commande").slice(0, 200),
        markdown: String(markdown || "")
      }
    });
    if (res?.error) return { ok: false, error: res.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Proxy d'actions Notion exposées à l'app (SDK LaunchIntegrations.notion) ──
// Whitelist : on ne laisse passer que des actions Notion sûres et utiles.
const NOTION_ACTIONS = {
  createPage:     "NOTION_CREATE_NOTION_PAGE",
  createDatabase: "NOTION_CREATE_DATABASE",
  updateSchema:   "NOTION_UPDATE_SCHEMA_DATABASE",   // ajouter/renommer/retyper une colonne
  insertRow:      "NOTION_INSERT_ROW_DATABASE",
  query:          "NOTION_QUERY_DATABASE",
  updateRow:      "NOTION_UPDATE_ROW_DATABASE"
};

export async function runNotionAction({ creatorUserId, action, args, defaultTarget }) {
  if (!creatorUserId) return { ok: false, error: "Notion non configuré" };
  const toolName = NOTION_ACTIONS[action];
  if (!toolName) return { ok: false, error: `Action Notion non autorisée: ${action}` };
  const a = { ...(args || {}) };
  // Cible par défaut = celle configurée sur le projet : l'app générée n'a
  // JAMAIS besoin de connaître l'ID de la base (l'IA ne doit pas le demander).
  if (toolName === "NOTION_CREATE_NOTION_PAGE" && !a.parent_id && defaultTarget) a.parent_id = defaultTarget;
  if (["NOTION_QUERY_DATABASE", "NOTION_INSERT_ROW_DATABASE", "NOTION_UPDATE_ROW_DATABASE", "NOTION_UPDATE_SCHEMA_DATABASE"].includes(toolName)
      && !a.database_id && defaultTarget) a.database_id = defaultTarget;
  // Normalise tous les ids en UUID tiré (l'IA/app peut coller un id sans tirets)
  for (const k of ["parent_id", "database_id", "row_id", "page_id"]) if (a[k]) a[k] = notionParentId(a[k]);
  try {
    const res = await executeToolCall({ userId: creatorUserId, toolName, args: a });
    if (res?.error) return { ok: false, error: res.error };
    return { ok: true, data: res?.data ?? res?.response_data ?? res };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Insertion typée dans une BASE Notion (remplit les vraies colonnes) ───────

// Lit le schéma d'une base : [{ name, type }]. Renvoie null si ce n'est pas une base.
export async function fetchNotionSchema(creatorUserId, target) {
  try {
    const res = await executeToolCall({
      userId: creatorUserId,
      toolName: "NOTION_FETCH_DATABASE",
      args: { database_id: notionParentId(target) }
    });
    if (res?.error) return null;
    // Composio enveloppe la réponse — on localise l'objet base (celui qui a `properties`).
    const d = res?.data ?? res?.response_data ?? res;
    const obj = d?.properties ? d
      : d?.response_data?.properties ? d.response_data
      : d?.data?.properties ? d.data : null;
    if (!obj?.properties || typeof obj.properties !== "object") return null;
    // Base en corbeille → on la traite comme inexistante (Notion renvoie quand même son schéma).
    if (obj.archived || obj.in_trash) return null;
    return Object.entries(obj.properties).map(([name, def]) => ({ name, type: def?.type || "rich_text" }));
  } catch { return null; }
}

// Formate une valeur selon le type de colonne Notion.
function formatVal(type, raw) {
  if (raw == null || raw === "") return null;
  if (type === "number") { const n = Number(raw); return Number.isFinite(n) ? String(n) : null; }
  if (type === "checkbox") return raw ? "True" : "False";
  return String(raw); // title, rich_text, select, status, date, email, url, phone_number…
}

// Mappe une commande sur le schéma réel de la base (par nom de colonne + type).
function buildRowProperties(schema, order) {
  const used = new Set();
  const out = [];
  const match = (patterns) => schema.find((p) => !used.has(p.name) && patterns.some((re) => re.test(p.name)));
  const fields = [
    { patterns: [/statut/i, /status/i, /état/i, /etat/i], raw: "Payé" },
    { patterns: [/montant/i, /amount/i, /prix/i, /price/i, /total/i], raw: order.amountNum },
    { patterns: [/code\s*postal/i, /\bcp\b/i, /zip/i], raw: order.postal },
    { patterns: [/t[ée]l[ée]phone/i, /phone/i, /\btel\b/i], raw: order.phone },
    { patterns: [/adresse/i, /address/i, /livraison/i, /shipping/i], raw: order.address },
    { patterns: [/ville/i, /city/i], raw: order.city },
    { patterns: [/pays/i, /country/i], raw: order.country },
    { patterns: [/\bnom\b/i, /\bname\b/i, /acheteur/i], raw: order.clientName },
    { patterns: [/client/i, /e-?mail/i, /customer/i], raw: order.client },
    { patterns: [/produit/i, /product/i, /article/i, /offre/i, /item/i], raw: order.label },
    { patterns: [/date/i], raw: order.dateIso }
  ];
  for (const f of fields) {
    const prop = match(f.patterns);
    if (!prop) continue;
    const v = formatVal(prop.type, f.raw);
    if (v != null) { out.push({ name: prop.name, type: prop.type, value: v }); used.add(prop.name); }
  }
  // Le titre (1 par base) est obligatoire : produit, sinon libellé générique.
  const title = schema.find((p) => p.type === "title");
  if (title && !used.has(title.name)) out.push({ name: title.name, type: "title", value: order.label || "Commande payée" });
  return out;
}

// Liste les PAGES Notion du créateur (pour choisir un parent à la création de base).
export async function searchNotionPages(creatorUserId) {
  try {
    const res = await executeToolCall({
      userId: creatorUserId,
      toolName: "NOTION_SEARCH_NOTION_PAGE",
      args: { query: "", filter_value: "page", page_size: 25 }
    });
    if (res?.error) return [];
    const d = res?.data?.response_data || res?.data || res;
    const results = d?.results || [];
    return (Array.isArray(results) ? results : [])
      // On exclut les LIGNES de base (parent = database_id) : ce sont des entrées,
      // pas des pages — on ne peut pas y créer une base.
      .filter((p) => p?.id && p?.parent?.type !== "database_id")
      .map((p) => {
        const props = p?.properties || {};
        const titleProp = props.title || Object.values(props).find((x) => x?.type === "title");
        const title = titleProp?.title?.[0]?.plain_text || p?.title || "(sans titre)";
        return { id: p.id, title };
      });
  } catch { return []; }
}

// Crée automatiquement une base « Commandes » prête à l'emploi sous une PAGE Notion,
// avec exactement les colonnes que le journal de commandes sait remplir.
export async function createOrdersDatabase(creatorUserId, parentPageId, appName) {
  if (!creatorUserId || !parentPageId) return { ok: false, error: "Page parente Notion requise" };
  try {
    const res = await executeToolCall({
      userId: creatorUserId,
      toolName: "NOTION_CREATE_DATABASE",
      args: {
        parent_id: notionParentId(parentPageId),
        title: `Commandes — ${String(appName || "App").slice(0, 40)}`,
        // Toutes les infos client possibles : l'IA (et le créateur) choisissent
        // celles qui servent — les colonnes vides ne gênent pas dans Notion.
        properties: [
          { name: "Produit",     type: "title" },
          { name: "Statut",      type: "select" },
          { name: "Montant",     type: "number" },
          { name: "Client",      type: "email" },
          { name: "Nom",         type: "rich_text" },
          { name: "Téléphone",   type: "phone_number" },
          { name: "Adresse",     type: "rich_text" },
          { name: "Ville",       type: "rich_text" },
          { name: "Code postal", type: "rich_text" },
          { name: "Pays",        type: "rich_text" },
          { name: "Date",        type: "date" }
        ]
      }
    });
    if (res?.error) return { ok: false, error: res.error };
    const d = res?.data ?? res?.response_data ?? res;
    const dbId = d?.id || d?.response_data?.id || d?.data?.id || null;
    if (!dbId) return { ok: false, error: "Base créée mais ID introuvable dans la réponse" };
    return { ok: true, databaseId: dbId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// URL publique d'un objet Notion (page ou base) à partir de son id.
export function notionUrl(id) {
  return `https://www.notion.so/${String(id || "").replace(/-/g, "")}`;
}

// Provisioning 100 % automatique : trouve une page parente, crée la base
// « Commandes » prête à l'emploi, la définit comme cible du projet et renvoie
// son lien. L'utilisateur n'a RIEN à construire dans Notion (juste l'OAuth).
export async function autoProvisionNotion(creatorUserId, projectId, appName) {
  const status = await getLiveConnectionStatus(creatorUserId, "notion").catch(() => null);
  if (status !== "ACTIVE") {
    return { ok: false, notConnected: true, error: "Notion n'est pas connecté — bouton Notion de l'IDE pour lier ton compte." };
  }
  const pages = await searchNotionPages(creatorUserId);
  if (!pages.length) {
    return { ok: false, error: "Aucune page Notion accessible : dans Notion, partage au moins une page avec l'intégration DELT (menu ••• → Connexions)." };
  }
  const created = await createOrdersDatabase(creatorUserId, pages[0].id, appName);
  if (!created.ok) return created;
  await setProjectNotion(creatorUserId, projectId, created.databaseId);
  return { ok: true, target: created.databaseId, url: notionUrl(created.databaseId), parentTitle: pages[0].title };
}

// Journalise une commande : ligne typée si c'est une BASE, sinon page markdown.
export async function notionInsertOrder({ creatorUserId, target, order }) {
  if (!creatorUserId || !target) return { ok: false, error: "Notion non configuré" };
  const schema = await fetchNotionSchema(creatorUserId, target);
  if (schema && schema.length) {
    const properties = buildRowProperties(schema, order);
    const ins = await executeToolCall({
      userId: creatorUserId,
      toolName: "NOTION_INSERT_ROW_DATABASE",
      args: { database_id: notionParentId(target), properties }
    });
    if (!ins?.error) return { ok: true, mode: "database", columns: properties.map((p) => p.name) };
    // sinon on retombe sur la page markdown
  }
  return await notionLog({ creatorUserId, target, title: order.title, markdown: order.markdown });
}

// Déclenché par le webhook Stripe quand une commande passe en « payé ».
export async function onLaunchPaymentPaid(sessionId) {
  try {
    const { rows } = await getDb().query(
      `SELECT pay.amount, pay.currency, pay.label, pay.created_at, pay.customer,
              au.email AS client_email,
              p.user_id AS creator_id, p.notion_target, p.summary AS app_name
         FROM launch_payments pay
         JOIN launch_projects p ON p.id = pay.project_id
    LEFT JOIN launch_app_users au ON au.id = pay.app_user_id
        WHERE pay.session_id = $1`,
      [sessionId]
    );
    const r = rows[0];
    if (!r || !r.notion_target) return; // Notion non configuré sur ce projet
    const created = new Date(r.created_at || Date.now());
    const amountStr = (Number(r.amount || 0) / 100).toFixed(2) + " " + String(r.currency || "eur").toUpperCase();
    // Infos client collectées par Stripe Checkout (adresse de livraison
    // prioritaire sur celle de facturation).
    const cust = typeof r.customer === "string" ? JSON.parse(r.customer || "{}") : (r.customer || {});
    const addr = cust.shipping || cust.address || {};
    const addressLine = [addr.line1, addr.line2].filter(Boolean).join(", ") || null;
    const order = {
      amountNum: (Number(r.amount || 0) / 100).toFixed(2),     // pour colonne Number
      client: cust.email || r.client_email || "invité",
      clientName: cust.name || null,
      phone: cust.phone || null,
      address: addressLine,
      city: addr.city || null,
      postal: addr.postal_code || null,
      country: addr.country || null,
      label: r.label || "Produit",
      dateIso: created.toISOString(),                          // pour colonne Date
      // fallback page markdown si la cible n'est pas une base
      title: `✅ Commande payée — ${r.label || "Produit"} (${amountStr})`,
      markdown: [
        `**Statut :** Payé`,
        `**Produit :** ${r.label || "—"}`,
        `**Montant :** ${amountStr}`,
        `**Client :** ${cust.email || r.client_email || "invité"}`,
        cust.name  ? `**Nom :** ${cust.name}` : null,
        cust.phone ? `**Téléphone :** ${cust.phone}` : null,
        addressLine ? `**Adresse :** ${addressLine}, ${[addr.postal_code, addr.city, addr.country].filter(Boolean).join(" ")}` : null,
        `**App :** ${r.app_name || "—"}`,
        `**Date :** ${created.toLocaleString("fr-FR")}`
      ].filter(Boolean).join("\n")
    };
    await notionInsertOrder({ creatorUserId: r.creator_id, target: r.notion_target, order });
  } catch (e) {
    console.warn("[launchIntegrations] onLaunchPaymentPaid:", e.message);
  }
}
