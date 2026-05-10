import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db.js";

const JWT_SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET manquant dans .env");
  return s;
};
const JWT_EXPIRES = "30d";

export async function register(email, password) {
  const db = getDb();
  const hashed = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    `INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, plan, status`,
    [email.toLowerCase().trim(), hashed]
  );
  return rows[0];
}

export async function login(email, password) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM users WHERE email=$1`,
    [email.toLowerCase().trim()]
  );
  const user = rows[0];
  if (!user) throw new Error("Email ou mot de passe incorrect");
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error("Email ou mot de passe incorrect");
  if (user.status === "suspended") throw new Error("Compte suspendu");
  return user;
}

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, plan: user.plan }, JWT_SECRET(), {
    expiresIn: JWT_EXPIRES
  });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET());
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

// Auth via API key (sk-delt-xxx) — pour l'API publique /v1
export async function requireApiKey(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { message: "Missing API key. Pass it as 'Authorization: Bearer sk-delt-...'.", type: "authentication_error" }
    });
  }
  const rawKey = header.slice(7).trim();
  try {
    const { verifyApiKey } = await import("./apiKeys.js");
    const user = await verifyApiKey(rawKey);
    if (!user) {
      return res.status(401).json({
        error: { message: "Invalid API key.", type: "authentication_error" }
      });
    }
    req.user = user;
    next();
  } catch (e) {
    res.status(500).json({ error: { message: e.message, type: "server_error" } });
  }
}

// Recharge le user depuis la DB — fallback sur le JWT si DB indisponible
export async function refreshUser(userId, fallback = null) {
  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, email, plan, status, sub_id, sub_end FROM users WHERE id=$1`,
      [userId]
    );
    return rows[0] ?? null;
  } catch {
    // DB non disponible : retourne les infos du JWT (plan peut être décalé)
    return fallback ?? { id: userId, email: "", plan: "FREE", status: "active" };
  }
}
