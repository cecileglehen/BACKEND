// Appel OpenRouter avec logique de fallback automatique
import { fallbackChain } from "../config/models.js";

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

const headers = (key) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${key}`,
  "HTTP-Referer": "https://delt.ai",
  "X-Title": "DELT AI"
});

async function callModel(modelId, messages, signal) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");

  const res = await fetch(OR_URL, {
    method: "POST",
    signal,
    headers: headers(key),
    body: JSON.stringify({ model: modelId, messages })
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
        if (e.status && e.status !== 401 && e.status !== 403) continue;
        throw Object.assign(new Error("Erreur non-récupérable"), { fallbackTrace: errors });
      }
    }
  }
  const err = new Error("Tous les modèles de cette catégorie ont échoué");
  err.fallbackTrace = errors;
  throw err;
}

// Streaming SSE — pipe OpenRouter → Express response
export async function streamChat({ modelId, messages, res, onDone }) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");

  const isPerplexity = /perplexity\/sonar/i.test(modelId);

  const orRes = await fetch(OR_URL, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: true,
      include_reasoning: true,
      reasoning: { effort: "medium" }
    })
  });

  if (!orRes.ok) {
    const txt = await orRes.text().catch(() => "");
    throw new Error(`OpenRouter ${orRes.status}: ${txt.slice(0, 200)}`);
  }

  // Notification : Sonar lance une recherche web
  if (isPerplexity) {
    res.write(`data: ${JSON.stringify({ type: "websearch", status: "searching" })}\n\n`);
  }

  const reader = orRes.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let fullReasoning = "";
  let usage = null;
  let citations = [];
  let searchResults = [];
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      try {
        const json = JSON.parse(data);
        const choice = json.choices?.[0];
        const reasoning = choice?.delta?.reasoning ?? choice?.delta?.reasoning_content ?? "";
        const delta = choice?.delta?.content ?? "";

        // Capture citations (Perplexity Sonar) — peut être top-level ou dans message
        const chunkCitations = json.citations ?? choice?.message?.citations ?? choice?.delta?.citations;
        if (Array.isArray(chunkCitations) && chunkCitations.length > 0) {
          citations = chunkCitations;
        }
        const chunkSearchResults = json.search_results ?? choice?.message?.search_results;
        if (Array.isArray(chunkSearchResults) && chunkSearchResults.length > 0) {
          searchResults = chunkSearchResults;
          // Notifie le frontend des sources trouvées (les premières)
          res.write(`data: ${JSON.stringify({ type: "websearch", status: "found", count: searchResults.length, results: searchResults.slice(0, 5) })}\n\n`);
        }

        if (reasoning) {
          fullReasoning += reasoning;
          res.write(`data: ${JSON.stringify({ type: "thinking", delta: reasoning })}\n\n`);
        }
        if (delta) {
          fullContent += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
        if (json.usage) usage = json.usage;
      } catch { /* ignore malformed chunks */ }
    }
  }

  // Envoie les citations finales si Sonar a renvoyé des URLs sans search_results
  if (isPerplexity && citations.length > 0 && searchResults.length === 0) {
    const fallback = citations.map((url) => ({ url, title: url }));
    res.write(`data: ${JSON.stringify({ type: "websearch", status: "found", count: fallback.length, results: fallback })}\n\n`);
  }

  const thinkingTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  const tokensIn  = usage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4);
  const tokensOut = (usage?.completion_tokens ?? Math.ceil(fullContent.length / 4)) + thinkingTokens;

  onDone({ content: fullContent, reasoning: fullReasoning, tokensIn, tokensOut, thinkingTokens, citations, searchResults });
}
