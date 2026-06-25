import { useCallback, useRef, useState } from "react";
import { api } from "../lib/api.js";

const stripForLLM = (list) => list.map(({ role, content, attachments: a }) => {
  const msg = { role, content };
  if (Array.isArray(a) && a.length > 0) msg.attachments = a;
  return msg;
});

/**
 * Centralise toute la logique de streaming chat / image / video / merge / remake / parallel.
 * Retourne l'API consommée par ChatPage.
 */
export function useChatStream({ projectId, agentId, enabledTools, onCreditsUsed, onQuota, onAgeGate }) {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [routerInfo, setRouterInfo] = useState(null);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setRouterInfo(null);
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) { abortRef.current(); abortRef.current = null; }
    setBusy(false);
    setRouterInfo(null);
    setMessages((prev) => prev.map((m) =>
      m.streaming ? { ...m, streaming: false, thinking: false } : m
    ));
  }, []);

  // Stream sur un message principal OU sur une variante précise
  const sendWithTier = useCallback((tier, history, model = null, target = null) => {
    setBusy(true);
    setError(null);

    const streamId = Date.now() + Math.random();

    if (target) {
      setMessages((prev) => prev.map((m, i) => {
        if (i !== target.msgIndex) return m;
        const variants = [...(m.variants || [])];
        variants[target.variantIndex] = { content: "", _streamId: streamId, streaming: true };
        return { ...m, variants };
      }));
    } else {
      setMessages((prev) => [...prev, { role: "assistant", content: "", _streamId: streamId, streaming: true }]);
    }

    const applyUpdate = (updater) => {
      setMessages((prev) => prev.map((m, i) => {
        if (target && i === target.msgIndex) {
          const variants = [...(m.variants || [])];
          if (variants[target.variantIndex]?._streamId === streamId) {
            variants[target.variantIndex] = updater(variants[target.variantIndex]);
            return { ...m, variants };
          }
        }
        if (!target && m._streamId === streamId) return updater(m);
        return m;
      }));
    };

    abortRef.current = api.chatStream({
      messages: history,
      tier,
      modelId: model?.id,
      manual: !!model,
      projectId: projectId ?? undefined,
      agentId: agentId ?? undefined,
      enabledTools: enabledTools ? [...enabledTools] : undefined,
      onMeta: (meta) => { if (meta.quota) onQuota?.(meta.quota); applyUpdate((m) => ({ ...m, tier: meta.tier, model: meta.model, modelSwap: meta.modelSwap || m.modelSwap })); },
      onThinking: (delta) => applyUpdate((m) => ({ ...m, reasoning: (m.reasoning || "") + delta, thinking: true })),
      onWebsearch: (info) => applyUpdate((m) => ({
        ...m,
        websearchStatus: info.status,
        webResults: info.status === "found" ? info.results : (m.webResults || [])
      })),
      onDelta: (delta) => applyUpdate((m) => ({ ...m, content: (m.content || "") + delta, thinking: false })),
      onArtifact: (a) => applyUpdate((m) => ({
        ...m,
        artifacts: [...(m.artifacts || []), { filename: a.filename, content: a.content, mime: a.mime, ext: a.ext }]
      })),
      onTool: (info) => applyUpdate((m) => {
        const next = { ...m, toolCalls: [...(m.toolCalls || [])] };
        if (info.type === "tool_call") {
          next.toolCalls.push({ id: info.id, name: info.name, args: info.args, status: "pending" });
        } else if (info.type === "tool_result") {
          const idx = next.toolCalls.findIndex((t) => t.id === info.id);
          if (idx >= 0) next.toolCalls[idx] = {
            ...next.toolCalls[idx],
            status: info.ok ? "done" : "error",
            preview: info.preview,
            error: info.error || null
          };
        }
        return next;
      }),
      onImage: (info) => applyUpdate((m) => {
        if (info.type === "image") {
          // image reçue → on retire le spinner "Génération image…"
          return { ...m, imagePending: null, generatedImages: [...(m.generatedImages || []), { url: info.url, prompt: info.prompt, model: info.model }] };
        }
        if (info.type === "image_pending") {
          return { ...m, imagePending: info.prompt };
        }
        if (info.type === "image_error") {
          return { ...m, imagePending: null, imageError: info.error };
        }
        return m;
      }),
      onDone: ({ tokensOut, creditCost, costUsd }) => {
        applyUpdate((m) => ({ ...m, streaming: false, tokensOut, costUsd, creditCost }));
        onCreditsUsed?.(creditCost);
        setBusy(false);
        setRouterInfo(null);
      },
      onError: (e) => {
        if (e.message?.includes("age_gate")) {
          onAgeGate?.(() => sendWithTier(tier, history, model, target));
        } else {
          setError(e.message);
          applyUpdate((m) => ({ ...m, content: "⚠ " + e.message, error: true, streaming: false }));
        }
        setBusy(false);
        setRouterInfo(null);
      }
    });
  }, [projectId, agentId, enabledTools, onCreditsUsed, onAgeGate]);

  // Image
  const generateImage = useCallback(async (prompt, model) => {
    setBusy(true);
    const placeholderId = Date.now();
    setMessages((prev) => [...prev, {
      role: "assistant", content: "", _streamId: placeholderId, streaming: true, model, imagePending: prompt
    }]);
    try {
      const result = await api.image(prompt, model?.id);
      setMessages((prev) => prev.map((m) =>
        m._streamId === placeholderId
          ? { ...m, content: prompt, imageUrl: result.url, model: result.model || model, streaming: false, imagePending: null }
          : m
      ));
      onCreditsUsed?.();
    } catch (e) {
      setError(e.message);
      setMessages((prev) => prev.map((m) =>
        m._streamId === placeholderId ? { ...m, content: "⚠ " + e.message, error: true, streaming: false, imagePending: null } : m
      ));
    } finally { setBusy(false); }
  }, [onCreditsUsed]);

  // Video
  const generateVideo = useCallback(async (prompt, model) => {
    setBusy(true);
    const placeholderId = Date.now();
    setMessages((prev) => [...prev, {
      role: "assistant", content: "", _streamId: placeholderId, streaming: true, model
    }]);
    try {
      const result = await api.video(prompt, model?.id);
      setMessages((prev) => prev.map((m) =>
        m._streamId === placeholderId
          ? { ...m, content: prompt, videoUrl: result.url, model: result.model || model, streaming: false }
          : m
      ));
      onCreditsUsed?.();
    } catch (e) {
      setError(e.message);
      setMessages((prev) => prev.map((m) =>
        m._streamId === placeholderId ? { ...m, content: "⚠ " + e.message, error: true, streaming: false, imagePending: null } : m
      ));
    } finally { setBusy(false); }
  }, [onCreditsUsed]);

  // Parallel send (N modèles → N variantes simultanées)
  const sendParallel = useCallback((history, models) => {
    setBusy(true);
    setError(null);

    const variants = models.map((m) => ({
      content: "", _streamId: Date.now() + Math.random(), streaming: true,
      model: { id: m.id, display: m.display, brand: m.brand }, tier: m.tier
    }));

    let compMsgIndex;
    setMessages((prev) => {
      compMsgIndex = prev.length;
      return [...prev, { role: "assistant", variants }];
    });

    let pending = models.length;
    const aborts = models.map((m, idx) => api.chatStream({
      messages: history,
      tier: m.tier,
      modelId: m.id,
      manual: true,
      projectId: projectId ?? undefined,
      agentId: agentId ?? undefined,
      onMeta: (meta) => {
        setMessages((prev) => prev.map((msg, i) => {
          if (i !== compMsgIndex) return msg;
          const v = [...(msg.variants || [])];
          if (v[idx]) v[idx] = { ...v[idx], model: meta.model, tier: meta.tier };
          return { ...msg, variants: v };
        }));
      },
      onDelta: (delta) => {
        setMessages((prev) => prev.map((msg, i) => {
          if (i !== compMsgIndex) return msg;
          const v = [...(msg.variants || [])];
          if (v[idx]) v[idx] = { ...v[idx], content: (v[idx].content || "") + delta };
          return { ...msg, variants: v };
        }));
      },
      onThinking: (delta) => {
        setMessages((prev) => prev.map((msg, i) => {
          if (i !== compMsgIndex) return msg;
          const v = [...(msg.variants || [])];
          if (v[idx]) v[idx] = { ...v[idx], reasoning: (v[idx].reasoning || "") + delta, thinking: true };
          return { ...msg, variants: v };
        }));
      },
      onDone: ({ tokensOut, creditCost }) => {
        setMessages((prev) => prev.map((msg, i) => {
          if (i !== compMsgIndex) return msg;
          const v = [...(msg.variants || [])];
          if (v[idx]) v[idx] = { ...v[idx], streaming: false, tokensOut, thinking: false };
          return { ...msg, variants: v };
        }));
        onCreditsUsed?.(creditCost);
        if (--pending === 0) setBusy(false);
      },
      onError: (e) => {
        setMessages((prev) => prev.map((msg, i) => {
          if (i !== compMsgIndex) return msg;
          const v = [...(msg.variants || [])];
          if (v[idx]) v[idx] = { ...v[idx], content: "⚠ " + e.message, error: true, streaming: false };
          return { ...msg, variants: v };
        }));
        if (--pending === 0) setBusy(false);
      }
    }));
    abortRef.current = () => aborts.forEach((a) => a?.());
  }, [projectId, agentId, onCreditsUsed]);

  // Merge variants → 1 réponse synthétisée
  const mergeVariants = useCallback((msgIndex) => {
    const target = messages[msgIndex];
    if (!target?.variants || target.variants.length < 2 || busy) return;

    let userMsg = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") { userMsg = messages[i]; break; }
    }
    if (!userMsg) return;

    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, merging: true } : m));
    setBusy(true);

    const responses = target.variants
      .filter((v) => v.content && !v.error)
      .map((v) => ({ model: v.model?.display, content: v.content }));

    const streamId = Date.now();
    setMessages((prev) => [...prev, { role: "assistant", content: "", _streamId: streamId, streaming: true, isMerge: true }]);

    abortRef.current = api.mergeStream({
      question: userMsg.content,
      responses,
      projectId: projectId ?? undefined,
      onMeta: (meta) => {
        setMessages((prev) => prev.map((m) =>
          m._streamId === streamId ? { ...m, tier: meta.tier, model: meta.model } : m
        ));
      },
      onDelta: (delta) => {
        setMessages((prev) => prev.map((m) =>
          m._streamId === streamId ? { ...m, content: (m.content || "") + delta } : m
        ));
      },
      onDone: ({ tokensOut, creditCost }) => {
        setMessages((prev) => prev.map((m, i) => {
          if (m._streamId === streamId) return { ...m, streaming: false, tokensOut };
          if (i === msgIndex) return { ...m, merging: false };
          return m;
        }));
        onCreditsUsed?.(creditCost);
        setBusy(false);
      },
      onError: (e) => {
        setError(e.message);
        setMessages((prev) => prev.map((m, i) => {
          if (m._streamId === streamId) return { ...m, content: "⚠ " + e.message, error: true, streaming: false };
          if (i === msgIndex) return { ...m, merging: false };
          return m;
        }));
        setBusy(false);
      }
    });
  }, [messages, busy, projectId, onCreditsUsed]);

  const chooseVariant = useCallback((msgIndex, variantIndex) => {
    setMessages((prev) => prev.map((m, i) => {
      if (i !== msgIndex || !Array.isArray(m.variants)) return m;
      const chosen = m.variants[variantIndex];
      if (!chosen) return m;
      return {
        role: "assistant",
        content: chosen.content,
        model: chosen.model,
        tier: chosen.tier,
        tokensOut: chosen.tokensOut,
        reasoning: chosen.reasoning,
        webResults: chosen.webResults,
        websearchStatus: chosen.websearchStatus,
        error: chosen.error
      };
    }));
  }, []);

  const remake = useCallback((msgIndex, model) => {
    if (busy) return;
    const history = stripForLLM(messages.slice(0, msgIndex));
    const target = messages[msgIndex];
    if (!target || target.role !== "assistant") return;

    let variantIndex;
    setMessages((prev) => prev.map((m, i) => {
      if (i !== msgIndex) return m;
      if (m.variants && m.variants.length > 0) {
        variantIndex = m.variants.length;
        return m;
      }
      const original = {
        content: m.content, model: m.model, tier: m.tier, tokensOut: m.tokensOut,
        reasoning: m.reasoning, webResults: m.webResults, websearchStatus: m.websearchStatus,
        error: m.error, streaming: false
      };
      variantIndex = 1;
      return { role: "assistant", variants: [original] };
    }));

    if (variantIndex !== undefined) {
      sendWithTier(model.tier ?? "NANO", history, model, { msgIndex, variantIndex });
    }
  }, [messages, busy, sendWithTier]);

  return {
    messages, setMessages, busy, setBusy, error, setError, routerInfo, setRouterInfo,
    reset, stop, sendWithTier, generateImage, generateVideo, sendParallel,
    mergeVariants, chooseVariant, remake, stripForLLM
  };
}
