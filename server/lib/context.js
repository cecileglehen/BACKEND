// Compression de contexte via NANO au-delà de 20 messages
import { TIER_MODELS } from "../config/plans.js";

const MAX_MESSAGES_BEFORE_COMPRESS = 20;
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function compressIfNeeded(messages) {
  if (messages.length <= MAX_MESSAGES_BEFORE_COMPRESS) return messages;

  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) return messages; // pas de clé = pas de compression

  // Garde les 4 derniers échanges intacts, résume le reste
  const tail   = messages.slice(-4);
  const toSummarize = messages.slice(0, -4);

  try {
    const res = await fetch(OR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://delt.ai",
        "X-Title": "DELT AI"
      },
      body: JSON.stringify({
        model: TIER_MODELS.NANO.id,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "Résume la conversation suivante en 3-5 phrases concises, en conservant les faits et décisions importantes. Réponds en français. Commence par 'Résumé de la conversation :'"
          },
          {
            role: "user",
            content: toSummarize
              .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.content}`)
              .join("\n\n")
          }
        ]
      })
    });
    if (!res.ok) return messages;
    const data = await res.json();
    const summary = data?.choices?.[0]?.message?.content ?? "";
    return [{ role: "system", content: summary }, ...tail];
  } catch {
    return messages;
  }
}
