import { getDb } from "./db.js";

// Mémoire inter-modèles : faits durables sur l'utilisateur que l'IA enregistre
// via l'outil write_memory. Persistés dans users.memory_profile.facts (JSONB),
// donc partagés par TOUS les modèles et toutes les conversations.

const MAX_FACTS = 60;

export async function getMemoryProfile(userId) {
  try {
    const db = getDb();
    const { rows } = await db.query(`SELECT memory_profile FROM users WHERE id=$1`, [userId]);
    return rows[0]?.memory_profile || {};
  } catch {
    return {};
  }
}

// Ajoute un fait (dédupliqué, borné). Renvoie { ok, count } ou { ok:false }.
export async function appendMemoryFact(userId, text) {
  const fact = String(text || "").trim().slice(0, 280);
  if (!fact) return { ok: false, error: "fait vide" };
  try {
    const db = getDb();
    const profile = await getMemoryProfile(userId);
    const facts = Array.isArray(profile.facts) ? profile.facts : [];
    const norm = fact.toLowerCase();
    if (facts.some((f) => String(f.text || "").toLowerCase() === norm)) {
      return { ok: true, duplicate: true, count: facts.length };
    }
    facts.push({ text: fact, at: new Date().toISOString() });
    const trimmed = facts.slice(-MAX_FACTS);
    const next = { ...profile, facts: trimmed };
    await db.query(`UPDATE users SET memory_profile=$2 WHERE id=$1`, [userId, JSON.stringify(next)]);
    return { ok: true, count: trimmed.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
