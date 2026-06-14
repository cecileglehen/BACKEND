// Auth managée pour les apps générées par Launch (façon Base44/Lovable).
// - Utilisateurs scopés par projet (table launch_app_users), distincts des users DELT.
// - Email/mot de passe + Google via "central proxy pattern" (1 client, 1 callback fixe,
//   l'app cible encodée dans le paramètre state signé).
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db.js";

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET manquant");
  return s;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PUBLIC_API = () => (process.env.PUBLIC_API_URL || "https://deltai-backend.onrender.com").replace(/\/$/, "");

// ─── Tokens app-user ──────────────────────────────────────────────────────────
export function signAppToken(user) {
  return jwt.sign(
    { sub: user.id, pid: user.project_id, email: user.email, aud: "launch-app" },
    SECRET(),
    { expiresIn: "30d" }
  );
}

export function verifyAppToken(token) {
  const d = jwt.verify(token, SECRET());
  if (d.aud !== "launch-app") throw new Error("Token invalide");
  return d;
}

async function projectExists(projectId) {
  if (!UUID_RE.test(String(projectId))) return false;
  const { rows } = await getDb().query(`SELECT 1 FROM launch_projects WHERE id=$1`, [projectId]);
  return !!rows[0];
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name || null, provider: row.provider };
}

// ─── Email / mot de passe ─────────────────────────────────────────────────────
export async function signupAppUser(projectId, email, password, name) {
  if (!(await projectExists(projectId))) throw new Error("Projet introuvable");
  const mail = String(email || "").toLowerCase().trim();
  if (!mail || !String(password || "")) throw new Error("Email et mot de passe requis");
  const hashed = await bcrypt.hash(String(password), 12);
  const db = getDb();
  let row;
  try {
    ({ rows: [row] } = await db.query(
      `INSERT INTO launch_app_users (project_id, email, password, name, provider)
       VALUES ($1,$2,$3,$4,'email') RETURNING *`,
      [projectId, mail, hashed, String(name || "").slice(0, 80) || null]
    ));
  } catch (e) {
    if (e.code === "23505") throw new Error("Cet email est déjà utilisé.");
    throw e;
  }
  return { token: signAppToken(row), user: publicUser(row) };
}

export async function loginAppUser(projectId, email, password) {
  if (!(await projectExists(projectId))) throw new Error("Projet introuvable");
  const mail = String(email || "").toLowerCase().trim();
  const { rows: [row] } = await getDb().query(
    `SELECT * FROM launch_app_users WHERE project_id=$1 AND email=$2`,
    [projectId, mail]
  );
  if (!row || !row.password || !(await bcrypt.compare(String(password || ""), row.password))) {
    throw new Error("Identifiants invalides");
  }
  return { token: signAppToken(row), user: publicUser(row) };
}

export async function getAppUserFromToken(token) {
  const d = verifyAppToken(token);
  const { rows: [row] } = await getDb().query(`SELECT * FROM launch_app_users WHERE id=$1`, [d.sub]);
  if (!row) throw new Error("Utilisateur introuvable");
  return publicUser(row);
}

// Crée ou récupère un app-user OAuth (Google).
async function upsertOAuthUser(projectId, { email, name, provider }) {
  const mail = String(email || "").toLowerCase().trim();
  const db = getDb();
  const { rows: [existing] } = await db.query(
    `SELECT * FROM launch_app_users WHERE project_id=$1 AND email=$2`,
    [projectId, mail]
  );
  if (existing) return existing;
  const { rows: [row] } = await db.query(
    `INSERT INTO launch_app_users (project_id, email, name, provider)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [projectId, mail, String(name || "").slice(0, 80) || null, provider]
  );
  return row;
}

// ─── Google (central proxy pattern) ───────────────────────────────────────────
// state = JWT court signé { pid, redirect } → anti-CSRF + anti open-redirect
function signState(projectId, redirect) {
  return jwt.sign({ pid: projectId, redirect, t: "launch-oauth-state" }, SECRET(), { expiresIn: "10m" });
}
function verifyState(state) {
  const d = jwt.verify(state, SECRET());
  if (d.t !== "launch-oauth-state") throw new Error("State invalide");
  return d;
}

const GOOGLE_CALLBACK = () => `${PUBLIC_API()}/api/launch/auth/google/callback`;

export async function googleAuthUrl(projectId, redirect) {
  if (!(await projectExists(projectId))) throw new Error("Projet introuvable");
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID manquant");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_CALLBACK(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state: signState(projectId, redirect || "")
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Échange le code Google → infos user → crée/charge l'app-user → renvoie { token, redirect }
export async function handleGoogleCallback(code, state) {
  const { pid, redirect } = verifyState(state);
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/SECRET manquant côté serveur");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: GOOGLE_CALLBACK(),
      grant_type: "authorization_code"
    })
  });
  if (!tokenRes.ok) throw new Error(`Google token ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  if (!infoRes.ok) throw new Error(`Google userinfo ${infoRes.status}`);
  const info = await infoRes.json();
  if (!info.email) throw new Error("Email Google indisponible");

  const row = await upsertOAuthUser(pid, { email: info.email, name: info.name, provider: "google" });
  return { token: signAppToken(row), redirect };
}
