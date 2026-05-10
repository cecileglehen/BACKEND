import crypto from "node:crypto";
import { getDb } from "./db.js";

const PREFIX = "enc:v1:";
const USER_PREFIX = "enc:u1:";

function secret() {
  const value = process.env.MESSAGE_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error("MESSAGE_ENCRYPTION_KEY ou JWT_SECRET manquant pour chiffrer les conversations");
  }
  return crypto.createHash("sha256").update(value).digest();
}

function normalizeKey(key) {
  if (Buffer.isBuffer(key)) return key.length === 32 ? key : crypto.createHash("sha256").update(key).digest();
  return crypto.createHash("sha256").update(String(key)).digest();
}

function encryptWithKey(value, key, prefix) {
  const plain = String(value ?? "");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", normalizeKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${prefix}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptWithKey(value, key, prefix) {
  const [ivB64, tagB64, dataB64] = value.slice(prefix.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) return "";
  const decipher = crypto.createDecipheriv("aes-256-gcm", normalizeKey(key), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export function isEncrypted(value) {
  return typeof value === "string" && (value.startsWith(PREFIX) || value.startsWith(USER_PREFIX));
}

export function encryptText(value) {
  return encryptWithKey(value, secret(), PREFIX);
}

export function decryptText(value) {
  if (!isEncrypted(value)) return value ?? "";
  if (String(value).startsWith(USER_PREFIX)) throw new Error("Clé utilisateur requise pour déchiffrer ce contenu");
  return decryptWithKey(value, secret(), PREFIX);
}

function encryptDek(rawDek) {
  return encryptWithKey(rawDek.toString("base64"), secret(), PREFIX);
}

function decryptDek(encryptedDek) {
  return Buffer.from(decryptText(encryptedDek), "base64");
}

export async function getUserDataKey(userId, client = null) {
  const db = client ?? getDb();
  const { rows } = await db.query(`SELECT secret_key FROM users WHERE id=$1`, [userId]);
  const existing = rows[0]?.secret_key;
  if (existing) return decryptDek(existing);

  const dek = crypto.randomBytes(32);
  const encryptedDek = encryptDek(dek);
  const update = await db.query(
    `UPDATE users SET secret_key=$2 WHERE id=$1 AND secret_key IS NULL RETURNING secret_key`,
    [userId, encryptedDek]
  );
  return update.rows[0]?.secret_key ? decryptDek(update.rows[0].secret_key) : dek;
}

export function encryptForUser(value, userKey) {
  return encryptWithKey(value, userKey, USER_PREFIX);
}

export function decryptForUser(value, userKey) {
  if (!isEncrypted(value)) return value ?? "";
  if (String(value).startsWith(USER_PREFIX)) return decryptWithKey(value, userKey, USER_PREFIX);
  return decryptText(value);
}
