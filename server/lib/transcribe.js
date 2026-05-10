// Transcription Whisper via Groq (whisper-large-v3-turbo)
import { getDb } from "./db.js";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const FREE_LIMIT_SECONDS = 10 * 60; // 10 minutes par mois pour le plan FREE

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Lit l'usage du mois courant (reset si mois changé)
export async function getMonthlyTranscriptionSeconds(userId) {
  const db = getDb();
  const month = currentMonth();
  const { rows } = await db.query(
    `SELECT transcription_seconds, transcription_month FROM users WHERE id=$1`,
    [userId]
  );
  if (!rows[0]) return 0;
  if (rows[0].transcription_month !== month) {
    await db.query(
      `UPDATE users SET transcription_seconds = 0, transcription_month = $2 WHERE id = $1`,
      [userId, month]
    );
    return 0;
  }
  return Number(rows[0].transcription_seconds || 0);
}

export async function addTranscriptionUsage(userId, seconds) {
  const db = getDb();
  const month = currentMonth();
  await db.query(
    `UPDATE users
       SET transcription_seconds = CASE
             WHEN transcription_month = $2 THEN transcription_seconds + $3
             ELSE $3 END,
           transcription_month = $2
     WHERE id = $1`,
    [userId, month, Math.ceil(seconds)]
  );
}

// Vérifie si le user peut transcrire (limite FREE 10min/mois)
export async function canTranscribe(userId, plan) {
  if (plan !== "FREE") return { allowed: true, used: 0, limit: null };
  const used = await getMonthlyTranscriptionSeconds(userId);
  return {
    allowed: used < FREE_LIMIT_SECONDS,
    used,
    limit: FREE_LIMIT_SECONDS,
    remaining: Math.max(0, FREE_LIMIT_SECONDS - used)
  };
}

// Appelle Groq Whisper et retourne le texte
export async function transcribeAudio(audioBuffer, mimeType, filename = "audio.webm") {
  const key = (process.env.GROQ_API_KEY || "").trim();
  if (!key) throw new Error("GROQ_API_KEY manquante");

  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType || "audio/webm" });
  form.append("file", blob, filename);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq Whisper ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    text: data.text || "",
    duration: Number(data.duration || 0),
    language: data.language
  };
}
