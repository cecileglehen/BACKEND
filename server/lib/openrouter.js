// Appel OpenRouter avec logique de fallback automatique
import { fallbackChain } from "../config/models.js";

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─── DELT 33M (modèle propriétaire interne) ─────────────────────────────────
// ⚠️ Jamais de secret en dur ici (repo public) : tout vient de l'env.
// Si non configuré, le modèle DELT 33M est simplement indisponible (le code le gère).
const DELT_INFERENCE_URL = (process.env.DELT_INFERENCE_URL || "").trim();
const DELT_INFERENCE_KEY = (process.env.DELT_INFERENCE_KEY || "").trim();
const isDeltModel = (id) => typeof id === "string" && id.startsWith("delt/");

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

const headers = (key) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${key}`,
  "HTTP-Referer": "https://delt.ai",
  "X-Title": "DELT AI"
});

// Pour DELT 33M : strip system prompts (le modèle n'est pas instruct-tuned)
// + flatten multimodal (image_url + text → text only, pas de vision)
function flattenMessages(messages) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (typeof m.content === "string") return m;
      if (Array.isArray(m.content)) {
        const text = m.content.filter((p) => p?.type === "text").map((p) => p.text || "").join("\n");
        return { ...m, content: text };
      }
      return m;
    });
}

async function callDeltModel(modelId, messages, signal) {
  if (!DELT_INFERENCE_URL) {
    const err = new Error("DELT_INFERENCE_URL non configuré");
    err.status = 503;
    err.retryable = false;
    throw err;
  }
  const res = await fetch(`${DELT_INFERENCE_URL.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(DELT_INFERENCE_KEY ? { Authorization: `Bearer ${DELT_INFERENCE_KEY}` } : {})
    },
    body: JSON.stringify({ model: modelId, messages: flattenMessages(messages), max_tokens: 256, temperature: 0.8 })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(`DELT ${res.status}: ${txt.slice(0, 200)}`);
    err.status = res.status;
    err.retryable = RETRYABLE.has(res.status);
    throw err;
  }
  return res.json();
}

// 402 "requested up to X tokens, but can only afford Y" : le compte OpenRouter
// ne couvre pas le max_tokens par défaut du modèle. On extrait Y pour retenter
// avec un plafond réduit (~90 %) au lieu de faire échouer la requête.
function affordableTokensFrom(txt) {
  const m = String(txt || "").match(/can only afford (\d+)/i);
  if (!m) return null;
  const afford = Math.floor(Number(m[1]) * 0.9);
  return afford >= 512 ? afford : null; // en-dessous, réponse inutilisable
}

async function callModel(modelId, messages, signal, extra = {}) {
  if (isDeltModel(modelId)) return callDeltModel(modelId, messages, signal);

  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");

  const doFetch = (maxTokens) => fetch(OR_URL, {
    method: "POST",
    signal,
    headers: headers(key),
    body: JSON.stringify({
      model: modelId,
      messages,
      usage: { include: true },
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...extra
    })
  });

  let res = await doFetch(null);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // Crédits OpenRouter insuffisants pour le plafond du modèle → retry réduit
    if (res.status === 402) {
      const afford = affordableTokensFrom(txt);
      if (afford) {
        console.warn(`[openrouter] 402 sur ${modelId} — retry avec max_tokens=${afford}`);
        res = await doFetch(afford);
        if (res.ok) return res.json();
      }
    }
    const err = new Error(`OpenRouter ${res.status}: ${txt.slice(0, 200)}`);
    err.status = res.status;
    err.retryable = RETRYABLE.has(res.status);
    throw err;
  }
  return res.json();
}

// Appel non-streaming avec support tools (OpenAI function calling format).
// Renvoie le message complet (avec éventuellement tool_calls) + usage.
export async function chatWithTools({ modelId, messages, tools, signal }) {
  const data = await callModel(modelId, messages, signal, tools?.length > 0 ? { tools, tool_choice: "auto" } : {});
  const choice = data?.choices?.[0];
  return {
    message: choice?.message || { role: "assistant", content: "" },
    usage: data?.usage || null,
    raw: data
  };
}

export async function chatWithFallback({ modelId, messages, signal, manual = false, tools, tool_choice, response_format }) {
  const chain = manual ? [modelId] : fallbackChain(modelId);
  // Passthrough function/tool calling (agents type OpenCode/DeltCLI) + JSON mode.
  const extra = {};
  if (Array.isArray(tools) && tools.length) { extra.tools = tools; extra.tool_choice = tool_choice || "auto"; }
  if (response_format) extra.response_format = response_format;
  const errors = [];
  for (const id of chain) {
    try {
      const data = await callModel(id, messages, signal, extra);
      const choice = data?.choices?.[0];
      return {
        modelUsed: id,
        content: choice?.message?.content ?? "",
        toolCalls: choice?.message?.tool_calls ?? null,
        finishReason: choice?.finish_reason ?? "stop",
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

// Streaming SSE — pipe OpenRouter (ou DELT 33M) → Express response
export async function streamChat({ modelId, messages, res, onDone }) {
  const isDelt = isDeltModel(modelId);
  const isPerplexity = /perplexity\/sonar/i.test(modelId);

  if (!isDelt) {
    const key = (process.env.OPENROUTER_API_KEY || "").trim();
    if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  } else if (!DELT_INFERENCE_URL) {
    throw new Error("DELT_INFERENCE_URL non configuré — modèle DELT 33M indisponible");
  }

  // Abort upstream si le client coupe la connexion
  const upstreamCtrl = new AbortController();
  let clientAborted = false;
  const onClientClose = () => {
    clientAborted = true;
    try { upstreamCtrl.abort(); } catch {}
  };
  res.on("close", onClientClose);

  const orRes = isDelt
    ? await fetch(`${DELT_INFERENCE_URL.replace(/\/$/, "")}/v1/chat/completions`, {
        method: "POST",
        signal: upstreamCtrl.signal,
        headers: {
          "Content-Type": "application/json",
          ...(DELT_INFERENCE_KEY ? { Authorization: `Bearer ${DELT_INFERENCE_KEY}` } : {})
        },
        body: JSON.stringify({
          model: modelId,
          messages: flattenMessages(messages),
          stream: true,
          max_tokens: 256,
          temperature: 0.8
        })
      })
    : await fetch(OR_URL, {
        method: "POST",
        headers: headers((process.env.OPENROUTER_API_KEY || "").trim()),
        signal: upstreamCtrl.signal,
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          usage: { include: true },
          include_reasoning: true,
          reasoning: { effort: "medium" },
          // Claude Fable 5 (et Anthropic 4.6+) : reasoning TOUJOURS actif en
          // adaptatif — `reasoning.effort` est un no-op silencieux, le levier
          // OpenRouter est `verbosity`.
          ...(/anthropic\/claude-(fable|opus-4\.[89]|sonnet-5)/i.test(modelId) ? { verbosity: "medium" } : {})
        })
      });

  let streamRes = orRes;
  if (!streamRes.ok) {
    const txt = await streamRes.text().catch(() => "");
    // 402 : crédits OpenRouter < max_tokens par défaut du modèle → retry
    // avec un plafond réduit plutôt que planter la conversation.
    const afford = !isDelt && streamRes.status === 402 ? affordableTokensFrom(txt) : null;
    if (afford) {
      console.warn(`[openrouter] 402 stream sur ${modelId} — retry avec max_tokens=${afford}`);
      streamRes = await fetch(OR_URL, {
        method: "POST",
        headers: headers((process.env.OPENROUTER_API_KEY || "").trim()),
        signal: upstreamCtrl.signal,
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: true,
          max_tokens: afford,
          stream_options: { include_usage: true },
          usage: { include: true },
          include_reasoning: true,
          reasoning: { effort: "medium" },
          ...(/anthropic\/claude-(fable|opus-4\.[89]|sonnet-5)/i.test(modelId) ? { verbosity: "medium" } : {})
        })
      });
    }
    if (!streamRes.ok) {
      res.off("close", onClientClose);
      const txt2 = afford ? await streamRes.text().catch(() => "") : txt;
      throw new Error(`OpenRouter ${streamRes.status}: ${txt2.slice(0, 200)}`);
    }
  }

  // Notification : Sonar lance une recherche web
  if (isPerplexity) {
    res.write(`data: ${JSON.stringify({ type: "websearch", status: "searching" })}\n\n`);
  }

  const reader = streamRes.body.getReader();
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
        // Reasoning unifié (OpenAI-like) OU blocs Anthropic (Claude Fable 5 /
        // Opus 4.8+) livrés dans delta.reasoning_details[] — types
        // reasoning.text / reasoning.summary (on ignore reasoning.encrypted).
        let reasoning = choice?.delta?.reasoning ?? choice?.delta?.reasoning_content ?? "";
        if (!reasoning && Array.isArray(choice?.delta?.reasoning_details)) {
          reasoning = choice.delta.reasoning_details
            .map((d) => d?.text ?? d?.summary ?? "")
            .join("");
        }
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
    .replace(/<\/think>|<\/thinking>/gi, "")
    // Harmony / OpenAI internal tool-call format leaks dans le content
    // (GPT-5.x sort parfois `to=functions.X ...json {...}` au lieu d'utiliser
    // le vrai mécanisme tool_calls). On strip toutes les variantes connues.
    .replace(/<\|channel\|>[^<]*?<\|message\|>/g, "")
    .replace(/<\|[a-z_]+\|>/gi, "")
    .replace(/to=functions\.[A-Z0-9_]+\s*[\s\S]*?\{[\s\S]*?\}\s*/gi, "")
    // <tool_call>, <toolcall>, <function_call> XML utilisés par Qwen/Hermes
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<toolcall>[\s\S]*?<\/toolcall>/gi, "")
    .replace(/<function_call>[\s\S]*?<\/function_call>/gi, "")
    .replace(/^\s*(commentary|analysis)\s*\n/gim, "")
    // Spam/garbage tokens : suites CJK ou cyrillique aléatoires de 2+ chars
    // (souvent injectées entre tool calls par OpenRouter sur certains modèles)
    .replace(/[\u4e00-\u9fff\u3000-\u303f]{2,}/g, "")
    .replace(/[\u0400-\u04ff]{4,}/g, "");

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
