// Appel OpenRouter avec logique de fallback automatique
import { fallbackChain } from "../config/models.js";

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

async function callModel(modelId, messages, signal) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");

  const res = await fetch(OR_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://delt.ai",
      "X-Title": "DELT AI"
    },
    body: JSON.stringify({
      model: modelId,
      messages
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(`OpenRouter ${res.status}: ${txt.slice(0, 200)}`);
    err.status = res.status;
    err.retryable = RETRYABLE.has(res.status);
    throw err;
  }
  return res.json();
}

// manual=true → aucun fallback, on échoue immédiatement si le modèle ne répond pas
export async function chatWithFallback({ modelId, messages, signal, manual = false }) {
  const chain = manual ? [modelId] : fallbackChain(modelId);
  const errors = [];
  for (const id of chain) {
    try {
      const data = await callModel(id, messages, signal);
      return {
        modelUsed: id,
        content: data?.choices?.[0]?.message?.content ?? "",
        raw: data,
        attempts: errors.length + 1,
        fallbackTrace: errors
      };
    } catch (e) {
      errors.push({ model: id, status: e.status, message: e.message });
      if (!e.retryable) {
        // Tentative de fallback même sur 4xx non-429 (ex: modèle indisponible)
        if (e.status && e.status !== 401 && e.status !== 403) continue;
        throw Object.assign(new Error("Erreur non-récupérable"), {
          fallbackTrace: errors
        });
      }
      // sinon on enchaîne sur le suivant
    }
  }
  const err = new Error("Tous les modèles de cette catégorie ont échoué");
  err.fallbackTrace = errors;
  throw err;
}
