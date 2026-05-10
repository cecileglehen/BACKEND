// API publique DELT — compatible OpenAI SDK
// Les utilisateurs externes peuvent appeler avec le SDK OpenAI :
//   client = OpenAI(api_key="sk-delt-...", base_url="https://.../v1")
import express from "express";
import { requireApiKey } from "../lib/auth.js";
import { chatWithFallback, streamChat } from "../lib/openrouter.js";
import { getApiCredits, deductApiCredits } from "../lib/credits.js";
import { computeCreditCost, FREE_TIER_ONLY_PLANS } from "../config/plans.js";
import { CATEGORIES, findModelInCatalog, normalizeTier } from "../config/models.js";
import { recordUsage } from "../lib/windows.js";

const router = express.Router();

// ─── GET /v1/models — liste des modèles dispo ────────────────────────────────
router.get("/models", requireApiKey, (_req, res) => {
  const data = [];
  for (const [tier, category] of Object.entries(CATEGORIES)) {
    for (const m of category.models) {
      data.push({
        id: m.id,
        object: "model",
        owned_by: m.brand?.toLowerCase() || "delt",
        tier,
        display: m.display,
        ...(m.featuredLabel && { featured: m.featuredLabel })
      });
    }
  }
  res.json({ object: "list", data });
});

// ─── POST /v1/chat/completions — compatible OpenAI ───────────────────────────
router.post("/chat/completions", requireApiKey, async (req, res) => {
  try {
    const { model: modelId, messages, stream = false, temperature, max_tokens } = req.body ?? {};

    if (!modelId) {
      return res.status(400).json({ error: { message: "Missing required parameter: 'model'.", type: "invalid_request_error" } });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: "Missing or empty 'messages'.", type: "invalid_request_error" } });
    }

    const found = findModelInCatalog(modelId);
    if (!found) {
      return res.status(404).json({ error: { message: `The model '${modelId}' does not exist.`, type: "invalid_request_error" } });
    }
    const tier = normalizeTier(found.tier);

    // Plan FREE → restriction tier FREE/UNCENSORED uniquement
    if (FREE_TIER_ONLY_PLANS.has(req.user.plan) && tier !== "FREE" && tier !== "UNCENSORED") {
      return res.status(403).json({
        error: { message: "Your plan does not allow this model. Upgrade to BASIC or higher.", type: "permission_error" }
      });
    }

    const apiCredits = await getApiCredits(req.user.id);
    if (apiCredits <= 0) {
      return res.status(402).json({
        error: { message: "No API credits available. Transfer credits from your plan in the API tab before using the API.", type: "insufficient_quota" }
      });
    }

    // Vérification crédits (estimation)
    const estimatedCost = computeCreditCost(modelId, 1000, 500);
    if (estimatedCost > 0 && apiCredits < estimatedCost) {
      return res.status(402).json({
        error: { message: `Insufficient API credits (${apiCredits.toFixed(2)} Cr). Transfer credits from your plan in the API tab.`, type: "insufficient_quota" }
      });
    }

    // ─── Streaming ─────────────────────────────────────────────────────────
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const completionId = `chatcmpl-${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      const created = Math.floor(Date.now() / 1000);

      // Premier chunk : role
      res.write(`data: ${JSON.stringify({
        id: completionId, object: "chat.completion.chunk", created, model: modelId,
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }]
      })}\n\n`);

      // On adapte streamChat pour émettre des chunks au format OpenAI
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(process.env.OPENROUTER_API_KEY || "").trim()}`,
          "HTTP-Referer": "https://delt.ai",
          "X-Title": "DELT AI"
        },
        body: JSON.stringify({ model: modelId, messages, stream: true, ...(temperature !== undefined && { temperature }), ...(max_tokens !== undefined && { max_tokens }) })
      });

      if (!orRes.ok) {
        const txt = await orRes.text().catch(() => "");
        res.write(`data: ${JSON.stringify({ error: { message: `Upstream error: ${txt.slice(0, 200)}`, type: "api_error" } })}\n\n`);
        return res.end();
      }

      const reader = orRes.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let usage = null;
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
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullContent += delta;
              res.write(`data: ${JSON.stringify({
                id: completionId, object: "chat.completion.chunk", created, model: modelId,
                choices: [{ index: 0, delta: { content: delta }, finish_reason: null }]
              })}\n\n`);
            }
            if (json.usage) usage = json.usage;
          } catch { /* ignore */ }
        }
      }

      // Dernier chunk : finish_reason
      res.write(`data: ${JSON.stringify({
        id: completionId, object: "chat.completion.chunk", created, model: modelId,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
      })}\n\n`);
      res.write(`data: [DONE]\n\n`);

      // Comptage tokens + déduction crédits
      const thinkingTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
      const tokensIn  = usage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4);
      const tokensOut = (usage?.completion_tokens ?? Math.ceil(fullContent.length / 4)) + thinkingTokens;

      const creditCost = computeCreditCost(modelId, tokensIn, tokensOut);
      await deductApiCredits(req.user.id, creditCost);
      await recordUsage(req.user.id, tier, tokensIn, tokensOut);

      return res.end();
    }

    // ─── Non-streaming ─────────────────────────────────────────────────────
    const result = await chatWithFallback({ modelId, messages, manual: true });

    const usage = result.raw?.usage ?? {};
    const thinkingTokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;
    const tokensIn       = usage.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4);
    const tokensOut      = (usage.completion_tokens ?? Math.ceil(result.content.length / 4)) + thinkingTokens;

    const creditCost = computeCreditCost(result.modelUsed || modelId, tokensIn, tokensOut);
    await deductApiCredits(req.user.id, creditCost);
    await recordUsage(req.user.id, tier, tokensIn, tokensOut);

    res.json({
      id: `chatcmpl-${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: result.modelUsed,
      choices: [{
        index: 0,
        message: { role: "assistant", content: result.content },
        finish_reason: "stop"
      }],
      usage: {
        prompt_tokens: tokensIn,
        completion_tokens: tokensOut,
        total_tokens: tokensIn + tokensOut,
        reasoning_tokens: thinkingTokens
      },
      delt: { credit_cost: creditCost, tier }
    });
  } catch (e) {
    console.error("[v1/chat/completions]", e);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: e.message, type: "api_error" } });
    } else {
      res.write(`data: ${JSON.stringify({ error: { message: e.message } })}\n\n`);
      res.end();
    }
  }
});

export default router;
