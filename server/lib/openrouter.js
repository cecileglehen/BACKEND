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
    body: JSON.stringify({ model: modelId, messages, usage: { include: true } })
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

  // Abort upstream si le client coupe la connexion
  const upstreamCtrl = new AbortController();
  let clientAborted = false;
  const onClientClose = () => {
    clientAborted = true;
    try { upstreamCtrl.abort(); } catch {}
  };
  res.on("close", onClientClose);

  const orRes = await fetch(OR_URL, {
    method: "POST",
    headers: headers(key),
    signal: upstreamCtrl.signal,
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: true,
      // Force le provider à émettre l'objet "usage" dans le dernier chunk
      // (sinon il est absent en mode streaming et tokensOut est sous-estimé)
      stream_options: { include_usage: true },
      // Demande à OpenRouter d'inclure usage.cost dans la réponse (prix réel en $)
      usage: { include: true },
      include_reasoning: true,
      reasoning: { effort: "medium" }
    })
  });

  if (!orRes.ok) {
    res.off("close", onClientClose);
    const txt = await orRes.text().catch(() => "");
    throw new Error(`OpenRouter ${orRes.status}: ${txt.slice(0, 200)}`);
  }

  // Notification : Sonar lance une recherche web
  if (isPerplexity) {
    res.write(`data: ${JSON.stringify({ type: "websearch", status: "searching" })}\n\n`);
  }

  const reader = orRes.body.getReader();
  const decoder = new TextDecoder();
  let rawContent = "";
  let fullContent = "";
  let fullReasoning = "";
  let usage = null;
  let citations = [];
  let searchResults = [];
  let buf = "";

  try {
  while (true) {
    let chunk;
    try { chunk = await reader.read(); }
    catch (e) { if (clientAborted) break; throw e; }
    const { done, value } = chunk;
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
          rawContent += delta;
          const nextContent = stripReasoningEcho(rawContent, fullReasoning);
          const visibleDelta = nextContent.startsWith(fullContent)
            ? nextContent.slice(fullContent.length)
            : stripReasoningEcho(delta, fullReasoning);
          fullContent = nextContent;
          if (visibleDelta) {
            res.write(`data: ${JSON.stringify({ delta: visibleDelta })}\n\n`);
          }
        }
        if (json.usage) usage = json.usage;
      } catch { /* ignore malformed chunks */ }
    }
  }

  // Envoie les citations finales si Sonar a renvoyé des URLs sans search_results
  if (!clientAborted && isPerplexity && citations.length > 0 && searchResults.length === 0) {
    res.write(`data: ${JSON.stringify({ type: "websearch", status: "found", count: citations.length, results: citations.map((url) => ({ url, title: url })) })}\n\n`);
  }
  } finally {
    res.off("close", onClientClose);

    const thinkingTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    const tokensIn  = usage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4);
    const tokensOut = (usage?.completion_tokens ?? Math.ceil(fullContent.length / 4)) + thinkingTokens;
    // OpenRouter renvoie usage.cost en streaming UNIQUEMENT au dernier chunk.
    // Si le client a aborté avant ce chunk, on n'a pas le coût réel → on estime
    // depuis tokensIn/Out pour quand même facturer.
    const costUsd = Number(usage?.cost) || 0;

    onDone({
      content: fullContent,
      reasoning: fullReasoning,
      tokensIn,
      tokensOut,
      thinkingTokens,
      costUsd,
      citations,
      searchResults,
      aborted: clientAborted
    });
  }
}

function stripReasoningEcho(content, reasoning) {
  let clean = String(content || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .replace(/<thinking>[\s\S]*$/gi, "")
    .replace(/<\/think>|<\/thinking>/gi, "");

  const thought = String(reasoning || "").trim();
  if (thought.length < 24) return stripAnswerPrefix(clean);

  const left = clean.trimStart();
  if (left.startsWith(thought)) {
    clean = clean.slice(0, clean.length - left.length) + left.slice(thought.length).trimStart();
    return stripAnswerPrefix(clean);
  }

  return stripAnswerPrefix(stripCommonReasoningPrefix(clean, thought));
}

function stripCommonReasoningPrefix(content, reasoning) {
  const leadingLength = content.length - content.trimStart().length;
  const left = content.trimStart();
  const contentWords = [...left.matchAll(/\S+/g)];
  const reasoningWords = [...reasoning.matchAll(/\S+/g)];
  const max = Math.min(contentWords.length, reasoningWords.length);
  let common = 0;

  for (; common < max; common += 1) {
    const a = wordKey(contentWords[common][0]);
    const b = wordKey(reasoningWords[common][0]);
    if (!a || a !== b) break;
  }

  if (common < 8) return content;
  const cut = contentWords[common - 1].index + contentWords[common - 1][0].length;
  return content.slice(0, leadingLength) + left.slice(cut).trimStart();
}

function stripAnswerPrefix(content) {
  return content.replace(/^\s*(Réponse|Answer)\s*:\s*/i, "");
}

function wordKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}
