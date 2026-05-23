// One-shot : décrypte tous les messages/titres chiffrés dans la DB
// et les remet en clair. À exécuter UNE FOIS, puis ENCRYPT_CONVERSATIONS
// reste à `false` pour de bon.
//
// Utilisation :
//   cd server && node scripts/decrypt-all-messages.js
//
// Variables requises (.env) :
//   DATABASE_URL              — Postgres Supabase (pooler)
//   MESSAGE_ENCRYPTION_KEY ou JWT_SECRET  — la même clé qu'à l'époque du chiffrement
//
// Idempotent : un message déjà en clair est ignoré.

import "dotenv/config";
import pg from "pg";
import { decryptForUser, getUserDataKey, isEncrypted } from "../lib/cryptoBox.js";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const stats = {
  usersScanned: 0,
  usersFailed: 0,
  convsTitlesDecrypted: 0,
  messagesDecrypted: 0,
  messagesFailed: 0
};

async function decryptUser(client, userId) {
  let userKey;
  try {
    userKey = await getUserDataKey(userId, client);
  } catch (e) {
    console.warn(`  ⚠ user ${userId} : pas de clé (${e.message})`);
    stats.usersFailed++;
    return;
  }

  // Titres conversations
  const { rows: convs } = await client.query(
    `SELECT id, title FROM conversations WHERE user_id = $1 AND title LIKE 'enc:%'`,
    [userId]
  );
  for (const conv of convs) {
    try {
      const plain = decryptForUser(conv.title, userKey);
      await client.query(`UPDATE conversations SET title = $1 WHERE id = $2`, [plain, conv.id]);
      stats.convsTitlesDecrypted++;
    } catch (e) {
      console.warn(`  ⚠ conv ${conv.id} title fail: ${e.message}`);
    }
  }

  // Messages
  const { rows: messages } = await client.query(
    `SELECT id, content FROM messages WHERE user_id = $1 AND content LIKE 'enc:%'`,
    [userId]
  );
  for (const msg of messages) {
    try {
      const plain = decryptForUser(msg.content, userKey);
      await client.query(`UPDATE messages SET content = $1 WHERE id = $2`, [plain, msg.id]);
      stats.messagesDecrypted++;
    } catch (e) {
      stats.messagesFailed++;
      if (stats.messagesFailed < 5) console.warn(`  ⚠ msg ${msg.id} fail: ${e.message}`);
    }
  }
}

async function run() {
  console.log("→ Connexion DB…");
  const client = await pool.connect();
  try {
    const { rows: users } = await client.query(`
      SELECT DISTINCT user_id FROM (
        SELECT user_id FROM messages WHERE content LIKE 'enc:%'
        UNION
        SELECT user_id FROM conversations WHERE title LIKE 'enc:%'
      ) sub
    `);
    console.log(`→ ${users.length} utilisateur(s) avec du contenu chiffré`);

    for (const { user_id } of users) {
      stats.usersScanned++;
      process.stdout.write(`  ${stats.usersScanned}/${users.length} ${user_id.slice(0, 8)}… `);
      await decryptUser(client, user_id);
      console.log("OK");
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log("\n──── Bilan ────");
  console.log(`Utilisateurs scannés     : ${stats.usersScanned}`);
  console.log(`Utilisateurs failed      : ${stats.usersFailed}`);
  console.log(`Titres décryptés         : ${stats.convsTitlesDecrypted}`);
  console.log(`Messages décryptés       : ${stats.messagesDecrypted}`);
  console.log(`Messages échec décrypt   : ${stats.messagesFailed}`);
  console.log("\nTu peux maintenant retirer ENCRYPT_CONVERSATIONS de Render (ou laisser à false).");
}

run().catch((e) => {
  console.error("\n💥 Échec :", e);
  process.exit(1);
});
